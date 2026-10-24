import { sampleDist } from '../kernel/dist';
import { Heap } from '../kernel/heap';
import { compileExpr, type CompiledExpr } from '../kernel/expr';
import { mulberry32 } from '../kernel/rng';
import { DAY, makeBizCalendar, parseHM } from '../kernel/time';
import { AUTO_ACTOR } from '../model';
import type {
  CompanyDef,
  OrgEvent,
  OrgMetrics,
  OrgProcessDef,
  OrgSimOptions,
  OrgSimResult,
  OrgStageDef,
  PersonDef,
  PersonState,
  UnitDef,
} from '../model';

interface Win {
  s: number;
  e: number;
}
interface Blk extends Win {
  kind: 'break' | 'meeting';
}
interface DayInfo {
  absent: boolean;
  shiftS: number;
  shiftE: number;
  windows: Win[];
  blocks: Blk[];
}

interface PersonRT {
  def: PersonDef;
  idx: number;
  ancestors: string[]; // unidad de la persona y sus ancestros
  speed: number;
  errorRate: number;
  state: PersonState;
  busy: CaseRT | null;
  stage: StageRT | null;
  remaining: number;
  segStart: number;
  worked: number;
  tasks: number;
  stages: StageRT[];
}

interface StageRT {
  key: string;
  proc: OrgProcessDef;
  def: OrgStageDef;
  order: number;
  eligible: PersonRT[];
  queue: Array<{ c: CaseRT; since: number }>;
  rules?: Array<{ test: CompiledExpr | null; to: string }>;
  waitSum: number;
  started: number;
}

interface CaseRT {
  id: string;
  proc: OrgProcessDef;
  attrs: Record<string, number>;
  createdAt: number;
  stage: StageRT | null;
  enteredAt: number;
  visit: number;
  done: boolean;
}

function collectUnits(list: UnitDef[], trail: string[], out: Map<string, string[]>) {
  for (const u of list) {
    const t = [u.id, ...trail];
    out.set(u.id, t);
    if (u.children) collectUnits(u.children, t, out);
  }
}

export function simulateCompany(def: CompanyDef, options: OrgSimOptions): OrgSimResult {
  const { seed, horizonDays } = options;
  const horizon = horizonDays * DAY;
  const rng = mulberry32(seed);
  const events: OrgEvent[] = [];
  const heap = new Heap();
  let seq = 0;
  let now = 0;
  const schedule = (t: number, run: () => void) => heap.push({ t, seq: seq++, run });
  const emit = (e: OrgEvent) => events.push(e);

  const cal = def.calendar;
  const bizStart = parseHM(cal.hours.start)!;
  const bizEnd = parseHM(cal.hours.end)!;
  // plazos (SLA), tiempos de ciclo y esperas no cuentan las pausas de la empresa (almuerzo, descansos)
  const bizBreaks = (cal.breaks ?? []).map((b) => [parseHM(b.start)!, parseHM(b.end)!] as const);
  const biz = makeBizCalendar(cal.workDays, bizStart, bizEnd, bizBreaks);
  // los casos llegan a lo largo de toda la jornada; la tasa «por hora hábil» no cambia por tener una pausa
  const bizArrivals = makeBizCalendar(cal.workDays, bizStart, bizEnd);
  const workDays = new Set(cal.workDays);
  const travelCfg = { sameTeam: 0, sameArea: 2, crossArea: 5, ...(def.travel ?? {}) };

  // ---------- unidades ----------
  const unitTrail = new Map<string, string[]>();
  collectUnits(def.units, [], unitTrail);
  const topArea = (unit: string) => unitTrail.get(unit)![unitTrail.get(unit)!.length - 1];
  const travelMinutes = (from: string, to: string) =>
    from === to ? travelCfg.sameTeam : topArea(from) === topArea(to) ? travelCfg.sameArea : travelCfg.crossArea;

  // ---------- personas ----------
  const people: PersonRT[] = def.people.map((p, idx) => ({
    def: p,
    idx,
    ancestors: unitTrail.get(p.unit)!,
    speed: p.speed ?? 1,
    errorRate: p.errorRate ?? 0,
    state: 'off',
    busy: null,
    stage: null,
    remaining: 0,
    segStart: 0,
    worked: 0,
    tasks: 0,
    stages: [],
  }));

  // ---------- etapas ----------
  const stagesByKey = new Map<string, StageRT>();
  let order = 0;
  for (const proc of def.processes) {
    for (const s of proc.stages) {
      const st: StageRT = {
        key: `${proc.id}.${s.id}`,
        proc,
        def: s,
        order: order++,
        eligible: [],
        queue: [],
        waitSum: 0,
        started: 0,
      };
      if (Array.isArray(s.next))
        st.rules = s.next.map((r) => ({ test: r.otherwise ? null : compileExpr(r.when!), to: r.to }));
      if (s.unit && !s.automated) {
        st.eligible = people.filter(
          (p) =>
            p.ancestors.includes(s.unit!) &&
            (s.role === undefined || p.def.role === s.role) &&
            (s.skill === undefined || (p.def.skills ?? []).includes(s.skill)),
        );
        for (const p of st.eligible) p.stages.push(st);
      }
      stagesByKey.set(st.key, st);
    }
  }

  // ---------- calendario por persona ----------
  const dayCache = new Map<number, DayInfo>();
  const scenarioAbsent = new Map<string, Set<number>>();
  for (const a of def.scenario?.absences ?? []) scenarioAbsent.set(a.person, new Set(a.days));

  const isAbsent = (p: PersonRT, day: number): boolean => {
    if (scenarioAbsent.get(p.def.id)?.has(day)) return true;
    const rate = p.def.absenteeism ?? cal.absenteeism ?? 0;
    if (rate <= 0) return false;
    const h = (seed ^ Math.imul(p.idx + 1, 0x9e3779b1) ^ Math.imul(day + 1, 0x85ebca6b)) >>> 0;
    return mulberry32(h)() < rate;
  };

  const dayInfo = (p: PersonRT, day: number): DayInfo => {
    const key = p.idx * 100000 + day;
    let info = dayCache.get(key);
    if (info) return info;
    if (!workDays.has(day % 7)) {
      info = { absent: false, shiftS: 0, shiftE: 0, windows: [], blocks: [] };
    } else {
      const sched = p.def.schedule ? def.schedules![p.def.schedule] : cal;
      const shiftS = day * DAY + parseHM(sched.hours.start)!;
      const shiftE = day * DAY + parseHM(sched.hours.end)!;
      if (isAbsent(p, day)) info = { absent: true, shiftS, shiftE, windows: [], blocks: [] };
      else {
        const raw: Blk[] = (sched.breaks ?? []).map((b) => ({
          s: day * DAY + parseHM(b.start)!,
          e: day * DAY + parseHM(b.end)!,
          kind: 'break' as const,
        }));
        for (const m of def.meetings ?? []) {
          if (!p.ancestors.includes(m.unit)) continue;
          if (!(m.days ?? cal.workDays).includes(day % 7)) continue;
          const s = day * DAY + parseHM(m.start)!;
          raw.push({ s, e: s + m.minutes, kind: 'meeting' });
        }
        const blocks: Blk[] = [];
        for (const b of raw.sort((a, c) => a.s - c.s)) {
          const s = Math.max(b.s, shiftS);
          const e = Math.min(b.e, shiftE);
          if (e <= s) continue;
          const last = blocks[blocks.length - 1];
          if (last && s <= last.e) last.e = Math.max(last.e, e);
          else blocks.push({ s, e, kind: b.kind });
        }
        const windows: Win[] = [];
        let cursor = shiftS;
        for (const b of blocks) {
          if (b.s > cursor) windows.push({ s: cursor, e: b.s });
          cursor = Math.max(cursor, b.e);
        }
        if (cursor < shiftE) windows.push({ s: cursor, e: shiftE });
        info = { absent: false, shiftS, shiftE, windows, blocks };
      }
    }
    dayCache.set(key, info);
    return info;
  };

  const currentWindow = (p: PersonRT, t: number): Win | null =>
    dayInfo(p, Math.floor(t / DAY)).windows.find((w) => w.s <= t && t < w.e) ?? null;

  const nextWindowStart = (p: PersonRT, t: number): number | null => {
    for (let d = Math.floor(t / DAY); d <= Math.floor(t / DAY) + 30; d++)
      for (const w of dayInfo(p, d).windows) if (w.e > t) return Math.max(w.s, t);
    return null;
  };

  const restState = (p: PersonRT, t: number): PersonState => {
    const info = dayInfo(p, Math.floor(t / DAY));
    if (info.absent && t >= info.shiftS && t < info.shiftE) return 'absent';
    if (info.windows.some((w) => w.s <= t && t < w.e)) return 'idle';
    for (const b of info.blocks) if (b.s <= t && t < b.e) return b.kind;
    return 'off';
  };

  const setState = (p: PersonRT, state: PersonState, caseId?: string) => {
    if (p.state === state) return;
    p.state = state;
    emit({ t: now, type: 'person.state', person: p.def.id, state, ...(caseId ? { caseId } : {}) });
  };

  // ---------- métricas acumuladas ----------
  let created = 0;
  let completed = 0;
  const caseSeq = new Map<string, number>();
  const procStats = new Map<string, { created: number; completed: number; cycles: number[]; breaches: number }>();
  for (const p of def.processes) procStats.set(p.id, { created: 0, completed: 0, cycles: [], breaches: 0 });

  // ---------- flujo de casos ----------
  function enterStage(c: CaseRT, st: StageRT) {
    c.stage = st;
    c.enteredAt = now;
    c.visit++;
    emit({ t: now, type: 'stage.entered', caseId: c.id, process: c.proc.id, stage: st.def.id });

    if (st.def.sla) {
      const visit = c.visit;
      const at = biz.addBiz(now, st.def.sla.maxMinutes);
      schedule(at, () => {
        if (!c.done && c.stage === st && c.visit === visit) {
          procStats.get(c.proc.id)!.breaches++;
          emit({ t: now, type: 'sla.breached', caseId: c.id, stage: st.def.id });
        }
      });
    }

    if (st.def.automated) return startAuto(c, st);
    if (!st.def.duration && !st.def.unit) {
      // etapa de cierre inmediato
      if (st.def.terminal) return complete(c, st);
    }
    st.queue.push({ c, since: now });
    dispatchStage(st);
  }

  /** Etapa automatizada: la hace un sistema, sin cola ni personas, con capacidad ilimitada. */
  function startAuto(c: CaseRT, st: StageRT) {
    st.started++;
    emit({ t: now, type: 'work.started', caseId: c.id, stage: st.def.id, person: AUTO_ACTOR });
    const d = st.def.duration ? sampleDist(st.def.duration, rng) : 0;
    schedule(now + d, () => {
      emit({ t: now, type: 'work.finished', caseId: c.id, stage: st.def.id, person: AUTO_ACTOR });
      afterWork(c, st, null);
    });
  }

  /** Procesos que dependen (con "dispara") de cada proceso de origen. */
  const triggers = new Map<string, Array<{ target: OrgProcessDef; atStage?: string; probability: number; toStage?: string; inherit?: boolean }>>();
  for (const proc of def.processes)
    for (const d of proc.dependsOn ?? []) {
      if (d.kind !== 'dispara') continue;
      const l = triggers.get(d.process) ?? [];
      l.push({ target: proc, atStage: d.atStage, probability: d.probability ?? 1, toStage: d.toStage, inherit: d.inherit });
      triggers.set(d.process, l);
    }
  /** Dispara los procesos dependientes: al terminar la etapa `stageId`, o al completarse el caso (`stageId` null). */
  function fire(c: CaseRT, stageId: string | null) {
    for (const t of triggers.get(c.proc.id) ?? [])
      if ((t.atStage ?? null) === stageId && (t.probability >= 1 || rng() < t.probability))
        createCase(t.target, c.id, { entry: t.toStage, inherit: t.inherit ? c.attrs : undefined });
  }

  function complete(c: CaseRT, st: StageRT) {
    c.done = true;
    completed++;
    const ps = procStats.get(c.proc.id)!;
    ps.completed++;
    ps.cycles.push(biz.bizBetween(c.createdAt, now));
    emit({ t: now, type: 'case.completed', caseId: c.id, stage: st.def.id });
    fire(c, null);
  }

  const canTake = (p: PersonRT) => !p.busy && currentWindow(p, now) !== null;

  function dispatchStage(st: StageRT) {
    while (st.queue.length) {
      let best: PersonRT | null = null;
      for (const p of st.eligible)
        if (canTake(p) && (best === null || p.worked < best.worked)) best = p;
      if (!best) return;
      startWork(best, st.queue.shift()!.c, st);
    }
  }

  function dispatchPerson(p: PersonRT) {
    if (!canTake(p)) return;
    let best: StageRT | null = null;
    for (const st of p.stages) {
      if (!st.queue.length) continue;
      if (best === null || st.queue[0].since < best.queue[0].since) best = st;
    }
    if (best) startWork(p, best.queue.shift()!.c, best);
  }

  function startWork(p: PersonRT, c: CaseRT, st: StageRT) {
    st.waitSum += biz.bizBetween(c.enteredAt, now);
    st.started++;
    p.busy = c;
    p.stage = st;
    p.remaining = (st.def.duration ? sampleDist(st.def.duration, rng) : 0) / p.speed;
    emit({ t: now, type: 'work.started', caseId: c.id, stage: st.def.id, person: p.def.id });
    setState(p, 'working', c.id);
    p.segStart = now;
    runSegment(p);
  }

  function runSegment(p: PersonRT) {
    const w = currentWindow(p, now)!;
    const avail = w.e - now;
    if (p.remaining <= avail + 1e-9) schedule(now + p.remaining, () => finishWork(p));
    else {
      p.remaining -= avail;
      schedule(w.e, () => pauseWork(p));
    }
  }

  function pauseWork(p: PersonRT) {
    p.worked += now - p.segStart;
    emit({ t: now, type: 'work.paused', caseId: p.busy!.id, person: p.def.id });
    setState(p, restState(p, now) === 'idle' ? 'off' : restState(p, now), p.busy!.id);
    const next = nextWindowStart(p, now);
    if (next !== null) schedule(next, () => resumeWork(p));
  }

  function resumeWork(p: PersonRT) {
    emit({ t: now, type: 'work.resumed', caseId: p.busy!.id, person: p.def.id });
    setState(p, 'working', p.busy!.id);
    p.segStart = now;
    runSegment(p);
  }

  function finishWork(p: PersonRT) {
    const c = p.busy!;
    const st = p.stage!;
    p.worked += now - p.segStart;
    p.tasks++;
    p.busy = null;
    p.stage = null;
    emit({ t: now, type: 'work.finished', caseId: c.id, stage: st.def.id, person: p.def.id });
    setState(p, restState(p, now));
    afterWork(c, st, p);
    dispatchPerson(p);
  }

  function moveTo(c: CaseRT, from: StageRT, toId: string, extraDelay = 0) {
    const to = stagesByKey.get(`${c.proc.id}.${toId}`)!;
    const travel = from.def.unit && to.def.unit ? travelMinutes(from.def.unit, to.def.unit) : 0;
    const delay = travel + extraDelay;
    if (travel > 0)
      emit({ t: now, type: 'handoff.started', caseId: c.id, fromUnit: from.def.unit!, toUnit: to.def.unit!, minutes: travel });
    if (delay > 0) schedule(now + delay, () => enterStage(c, to));
    else enterStage(c, to);
  }

  function afterWork(c: CaseRT, st: StageRT, p: PersonRT | null) {
    if (p && p.errorRate > 0 && rng() < p.errorRate) {
      emit({ t: now, type: 'exception', caseId: c.id, stage: st.def.id, exceptionId: `error:${p.def.id}`, target: st.def.id });
      return enterStage(c, st);
    }
    for (const ex of st.def.exceptions ?? []) {
      if (rng() < ex.probability) {
        emit({ t: now, type: 'exception', caseId: c.id, stage: st.def.id, exceptionId: ex.id, target: ex.target });
        return moveTo(c, st, ex.target, ex.penaltyMinutes ?? 0);
      }
    }
    fire(c, st.def.id);
    if (st.def.terminal) return complete(c, st);
    if (typeof st.def.next === 'string') return moveTo(c, st, st.def.next);
    const scope = { case: c.attrs };
    const rule = st.rules!.find((r) => r.test === null || Boolean(r.test(scope)))!;
    moveTo(c, st, rule.to);
  }

  // ---------- llegadas ----------
  /** Crea un caso del proceso; `cause` es el caso que lo disparó, si lo hubo. */
  function createCase(proc: OrgProcessDef, cause?: string, opt?: { entry?: string; inherit?: Record<string, number> }) {
    const n = (caseSeq.get(proc.id) ?? 0) + 1;
    caseSeq.set(proc.id, n);
    const attrs: Record<string, number> = {};
    for (const [k, d] of Object.entries(proc.attributes ?? {})) attrs[k] = Math.round(sampleDist(d, rng) * 100) / 100;
    // un caso que continúa desde otro proceso trae los datos del caso de origen
    if (opt?.inherit) Object.assign(attrs, opt.inherit);
    const c: CaseRT = { id: `${proc.id}#${n}`, proc, attrs, createdAt: now, stage: null, enteredAt: now, visit: 0, done: false };
    created++;
    procStats.get(proc.id)!.created++;
    emit({ t: now, type: 'case.created', caseId: c.id, process: proc.id, attrs, ...(cause ? { cause } : {}) });
    enterStage(c, stagesByKey.get(`${proc.id}.${opt?.entry ?? proc.stages[0].id}`)!);
  }

  // minutos hábiles de un día; con `arrivalsPerDay` ninguna proceso recibe más casos propios por día que ese tope
  const bizMinutesPerDay = bizEnd - bizStart;
  const cap = options.arrivalsPerDay && options.arrivalsPerDay > 0 ? options.arrivalsPerDay : undefined;
  for (const proc of def.processes) {
    const interval = () => {
      if (proc.arrivals.type === 'poisson') {
        const perHour = cap ? Math.min(proc.arrivals.ratePerHour, cap / (bizMinutesPerDay / 60)) : proc.arrivals.ratePerHour;
        return sampleDist({ dist: 'exponential', mean: 60 / perHour }, rng);
      }
      return cap ? Math.max(proc.arrivals.everyMinutes, bizMinutesPerDay / cap) : proc.arrivals.everyMinutes;
    };

    const arrive = () => {
      createCase(proc);
      const next = bizArrivals.addBiz(now, interval());
      if (next <= horizon) schedule(next, arrive);
    };
    const first = bizArrivals.addBiz(0, interval());
    if (first <= horizon) schedule(first, arrive);
  }

  // ---------- fronteras de jornada, pausas y reuniones ----------
  for (const p of people) {
    for (let day = 0; day <= horizonDays; day++) {
      const info = dayInfo(p, day);
      if (info.absent) {
        // también si tiene un caso pausado de la víspera: ese día no está
        schedule(info.shiftS, () => setState(p, 'absent', p.busy?.id));
        schedule(info.shiftE, () => setState(p, 'off', p.busy?.id));
        continue;
      }
      for (const w of info.windows) {
        schedule(w.s, () => {
          if (p.busy) return;
          setState(p, 'idle');
          dispatchPerson(p);
        });
        schedule(w.e, () => {
          if (!p.busy) setState(p, restState(p, now));
        });
      }
    }
  }

  while (heap.size) {
    const ev = heap.pop();
    if (ev.t > horizon) break;
    now = ev.t;
    ev.run();
  }

  // trabajo en curso al final: contar el último tramo
  for (const p of people) if (p.busy && p.state === 'working') p.worked += horizon - p.segStart;

  // ---------- métricas ----------
  const available = (p: PersonRT) => {
    let total = 0;
    for (let d = 0; d <= horizonDays; d++)
      for (const w of dayInfo(p, d).windows) total += Math.max(0, Math.min(w.e, horizon) - Math.min(w.s, horizon));
    return total;
  };
  const avail = new Map(people.map((p) => [p.idx, available(p)]));
  const util = (p: PersonRT) => (avail.get(p.idx)! > 0 ? Math.min(1, p.worked / avail.get(p.idx)!) : 0);

  const byUnit: OrgMetrics['byUnit'] = {};
  for (const [id] of unitTrail) {
    const members = people.filter((p) => p.ancestors.includes(id));
    const w = members.reduce((s, p) => s + p.worked, 0);
    const a = members.reduce((s, p) => s + avail.get(p.idx)!, 0);
    byUnit[id] = { headcount: members.length, utilization: a > 0 ? Math.min(1, w / a) : 0, tasks: members.reduce((s, p) => s + p.tasks, 0) };
  }

  const metrics: OrgMetrics = {
    horizonDays,
    created,
    completed,
    inFlight: created - completed,
    byProcess: Object.fromEntries(
      [...procStats].map(([id, s]) => {
        const sorted = [...s.cycles].sort((a, b) => a - b);
        return [
          id,
          {
            created: s.created,
            completed: s.completed,
            cycleAvg: sorted.length ? sorted.reduce((x, y) => x + y, 0) / sorted.length : 0,
            cycleP90: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))] : 0,
            slaBreaches: s.breaches,
          },
        ];
      }),
    ),
    byStage: Object.fromEntries(
      [...stagesByKey]
        .filter(([, st]) => st.def.unit)
        .map(([k, st]) => [k, { waitAvg: st.started ? st.waitSum / st.started : 0, started: st.started, queueAtEnd: st.queue.length }]),
    ),
    byPerson: Object.fromEntries(people.map((p) => [p.def.id, { utilization: util(p), workedMinutes: p.worked, tasks: p.tasks }])),
    byUnit,
  };
  return { options, events, metrics };
}
