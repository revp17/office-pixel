import { sampleDist } from '../kernel/dist';
import { compileExpr, type CompiledExpr } from '../kernel/expr';
import { Heap } from '../kernel/heap';
import { mulberry32 } from '../kernel/rng';
import type { Metrics, ProcessDef, SimEvent, SimOptions, SimResult, StageDef } from './types';

interface Case {
  id: string;
  attrs: Record<string, number>;
  createdAt: number;
  stage: string;
  enteredAt: number;
  visit: number;
  done: boolean;
}

interface ResourceState {
  count: number;
  busy: number;
  busyMinutes: number;
  queue: Array<() => void>;
}

export function simulate(def: ProcessDef, options: SimOptions): SimResult {
  const { seed, horizonMinutes: horizon } = options;
  const rng = mulberry32(seed);
  const events: SimEvent[] = [];
  const heap = new Heap();
  let seq = 0;
  let now = 0;
  const schedule = (t: number, run: () => void) => heap.push({ t, seq: seq++, run });
  const emit = (e: SimEvent) => events.push(e);

  const stages = new Map<string, StageDef>(def.stages.map((s) => [s.id, s]));
  const rules = new Map<string, Array<{ test: CompiledExpr | null; to: string }>>();
  for (const s of def.stages) {
    if (Array.isArray(s.next))
      rules.set(
        s.id,
        s.next.map((r) => ({ test: r.otherwise ? null : compileExpr(r.when!), to: r.to })),
      );
  }
  const resources = new Map<string, ResourceState>(
    (def.resources ?? []).map((r) => [r.id, { count: r.count, busy: 0, busyMinutes: 0, queue: [] }]),
  );
  const activeWork = new Map<string, { resource?: string; start: number }>();

  let created = 0;
  let completed = 0;
  let slaBreaches = 0;
  const cycleTimes: number[] = [];
  const exceptionCounts: Record<string, number> = {};
  const waits: Record<string, { sum: number; count: number }> = {};

  function enterStage(c: Case, stageId: string) {
    const st = stages.get(stageId)!;
    c.stage = stageId;
    c.enteredAt = now;
    c.visit++;
    emit({ t: now, type: 'stage.entered', caseId: c.id, stage: stageId });

    if (st.sla) {
      const visit = c.visit;
      schedule(now + st.sla.maxMinutes, () => {
        if (!c.done && c.stage === stageId && c.visit === visit) {
          slaBreaches++;
          emit({ t: now, type: 'sla.breached', caseId: c.id, stage: stageId });
        }
      });
    }

    if (st.resource) {
      const r = resources.get(st.resource)!;
      const start = () => beginWork(c, st);
      if (r.busy < r.count) {
        r.busy++;
        start();
      } else r.queue.push(start);
    } else beginWork(c, st);
  }

  function beginWork(c: Case, st: StageDef) {
    if (!st.resource && !st.duration) return afterWork(c, st);
    if (st.resource) {
      const w = (waits[st.id] ??= { sum: 0, count: 0 });
      w.sum += now - c.enteredAt;
      w.count++;
    }
    emit({ t: now, type: 'work.started', caseId: c.id, stage: st.id, resource: st.resource });
    activeWork.set(c.id, { resource: st.resource, start: now });
    const d = st.duration ? sampleDist(st.duration, rng) : 0;
    schedule(now + d, () => {
      const aw = activeWork.get(c.id)!;
      activeWork.delete(c.id);
      emit({ t: now, type: 'work.finished', caseId: c.id, stage: st.id, resource: st.resource });
      if (st.resource) {
        const r = resources.get(st.resource)!;
        r.busyMinutes += now - aw.start;
        r.busy--;
        const nextStart = r.queue.shift();
        if (nextStart) {
          r.busy++;
          nextStart();
        }
      }
      afterWork(c, st);
    });
  }

  function afterWork(c: Case, st: StageDef) {
    for (const ex of st.exceptions ?? []) {
      if (rng() < ex.probability) {
        exceptionCounts[ex.id] = (exceptionCounts[ex.id] ?? 0) + 1;
        emit({ t: now, type: 'exception', caseId: c.id, stage: st.id, exceptionId: ex.id, target: ex.target });
        schedule(now + (ex.penaltyMinutes ?? 0), () => enterStage(c, ex.target));
        return;
      }
    }
    if (st.terminal) {
      c.done = true;
      completed++;
      cycleTimes.push(now - c.createdAt);
      emit({ t: now, type: 'case.completed', caseId: c.id, stage: st.id });
      return;
    }
    if (typeof st.next === 'string') return enterStage(c, st.next);
    const scope = { case: c.attrs };
    const rule = rules.get(st.id)!.find((r) => r.test === null || Boolean(r.test(scope)))!;
    enterStage(c, rule.to);
  }

  const entry = def.stages[0].id;
  const interArrival = () =>
    def.arrivals.type === 'poisson'
      ? sampleDist({ dist: 'exponential', mean: 60 / def.arrivals.ratePerHour }, rng)
      : def.arrivals.everyMinutes;

  function arrive() {
    const attrs: Record<string, number> = {};
    for (const [k, d] of Object.entries(def.attributes ?? {})) attrs[k] = Math.round(sampleDist(d, rng) * 100) / 100;
    const c: Case = {
      id: `c${++created}`,
      attrs,
      createdAt: now,
      stage: '',
      enteredAt: now,
      visit: 0,
      done: false,
    };
    emit({ t: now, type: 'case.created', caseId: c.id, attrs });
    enterStage(c, entry);
    const nextT = now + interArrival();
    if (nextT <= horizon) schedule(nextT, arrive);
  }

  const first = interArrival();
  if (first <= horizon) schedule(first, arrive);

  while (heap.size) {
    const ev = heap.pop();
    if (ev.t > horizon) break;
    now = ev.t;
    ev.run();
  }

  // Trabajo aún en curso al final: contar su ocupación hasta el horizonte.
  for (const aw of activeWork.values()) {
    if (aw.resource) resources.get(aw.resource)!.busyMinutes += horizon - aw.start;
  }

  const sorted = [...cycleTimes].sort((a, b) => a - b);
  const avg = sorted.length ? sorted.reduce((s, v) => s + v, 0) / sorted.length : 0;
  const metrics: Metrics = {
    horizonMinutes: horizon,
    created,
    completed,
    inFlight: created - completed,
    throughputPerHour: horizon > 0 ? completed / (horizon / 60) : 0,
    cycleTimeAvg: avg,
    cycleTimeP90: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))] : 0,
    slaBreaches,
    exceptions: exceptionCounts,
    waitByStage: Object.fromEntries(
      Object.entries(waits).map(([k, w]) => [k, { avg: w.count ? w.sum / w.count : 0, count: w.count }]),
    ),
    utilization: Object.fromEntries(
      [...resources.entries()].map(([k, r]) => [k, horizon > 0 ? Math.min(1, r.busyMinutes / (r.count * horizon)) : 0]),
    ),
  };
  return { options, events, metrics };
}
