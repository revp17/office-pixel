import { defaultNext, dropDanglingDependencies, eliminateStages, type CompanyDef, type MeetingDef, type OrgProcessDef, type PersonDef } from '@office-pixel/sim';
import { findUnit, flatUnits, removePerson, subtreeIds } from './model';

export type RetireEffect = 'reconecta' | 'inicio' | 'cierre';

export interface RetirePlan {
  name: string;
  /** la unidad y todas sus subunidades */
  unitIds: string[];
  people: PersonDef[];
  meetings: MeetingDef[];
  /** etapas que hoy usan esa área, y qué les pasaría si se elimina */
  stages: Array<{ proc: string; procName: string; stage: string; label: string; effect: RetireEffect }>;
  /** procesos que quedarían sin ninguna etapa de trabajo y se borrarían */
  removedProcesses: string[];
  procedures: number;
}

const EFFECT_TEXT: Record<RetireEffect, string> = {
  reconecta: 'se elimina y el flujo se reconecta con la etapa siguiente',
  inicio: 'se elimina y la etapa siguiente pasa a ser la primera',
  cierre: 'queda como cierre sin área (ya no tiene personas ni duración)',
};
export const effectText = (e: RetireEffect) => EFFECT_TEXT[e];

/** Qué contiene un área o subárea y qué pasaría con ello si se elimina. */
export function retirePlan(def: CompanyDef, unitId: string): RetirePlan {
  const unit = findUnit(def.units, unitId)!;
  const ids = new Set(subtreeIds(unit));
  const stages: RetirePlan['stages'] = [];
  let procedures = 0;
  for (const p of def.processes) {
    const gone = new Set<string>();
    p.stages.forEach((s, i) => {
      if (!s.unit || !ids.has(s.unit)) return;
      gone.add(s.id);
      stages.push({ proc: p.id, procName: p.name ?? p.id, stage: s.id, label: s.label ?? s.id, effect: s.terminal ? 'cierre' : i === 0 ? 'inicio' : 'reconecta' });
    });
    procedures += (p.procedures ?? []).filter((pc) => pc.stageId && gone.has(pc.stageId)).length;
  }
  const dry = structuredClone(def);
  applyRetire(dry, unitId, { mode: 'delete' });
  const before = new Set(def.processes.map((p) => p.id));
  const after = new Set(dry.processes.map((p) => p.id));
  return {
    name: unit.name ?? unit.id,
    unitIds: [...ids],
    people: def.people.filter((p) => ids.has(p.unit)),
    meetings: (def.meetings ?? []).filter((m) => ids.has(m.unit)),
    stages,
    removedProcesses: [...before].filter((id) => !after.has(id)),
    procedures,
  };
}

/** Unidades a las que se pueden mover las personas y etapas (todas menos la unidad y sus subunidades). */
export function moveTargets(def: CompanyDef, unitId: string) {
  const ids = new Set(subtreeIds(findUnit(def.units, unitId)!));
  return flatUnits(def.units).filter((f) => !ids.has(f.unit.id));
}

/** Entre las etapas que quedan, ¿alguna hace trabajo? (si no, el proceso no tiene sentido) */
const hasWork = (p: OrgProcessDef) => p.stages.some((s) => !s.terminal);

function dropStages(def: CompanyDef, ids: Set<string>) {
  for (const p of [...def.processes]) {
    for (const sid of p.stages.filter((s) => s.unit && ids.has(s.unit)).map((s) => s.id)) {
      const st = p.stages.find((s) => s.id === sid);
      if (!st) continue;
      if (st.terminal) {
        // un cierre sin trabajo sigue siendo válido: queda sin área, persona ni duración
        for (const k of ['unit', 'role', 'skill', 'duration', 'sla', 'automated'] as const) delete st[k];
        continue;
      }
      const succ = defaultNext(st);
      if (!succ || succ === sid) {
        def.processes = def.processes.filter((q) => q.id !== p.id);
        break;
      }
      // la primera etapa es la entrada del proceso: la siguiente pasa a serlo antes de quitarla
      if (p.stages[0].id === sid) {
        const at = p.stages.findIndex((s) => s.id === succ);
        if (at > 0) p.stages.unshift(...p.stages.splice(at, 1));
      }
      const { doc, optimization } = p;
      const next = eliminateStages(p, [sid]);
      Object.assign(p, next, {});
      if (doc) p.doc = doc;
      if (optimization) p.optimization = optimization;
    }
  }
  def.processes = def.processes.filter((p) => hasWork(p));
  for (const p of def.processes) {
    const have = new Set(p.stages.map((s) => s.id));
    for (const pc of p.procedures ?? []) if (pc.stageId && !have.has(pc.stageId)) delete pc.stageId;
  }
}

/**
 * Quita un área o subárea (con sus subáreas).
 * - mover: sus personas, etapas y reuniones pasan a otra unidad.
 * - eliminar: se borran sus personas y reuniones, y sus etapas se quitan reconectando el flujo.
 */
export function applyRetire(def: CompanyDef, unitId: string, opt: { mode: 'move'; to: string } | { mode: 'delete' }) {
  const ids = new Set(subtreeIds(findUnit(def.units, unitId)!));
  if (opt.mode === 'move') {
    for (const p of def.people) if (ids.has(p.unit)) p.unit = opt.to;
    for (const pr of def.processes) for (const s of pr.stages) if (s.unit && ids.has(s.unit)) s.unit = opt.to;
    for (const m of def.meetings ?? []) if (ids.has(m.unit)) m.unit = opt.to;
  } else {
    for (const p of def.people.filter((q) => ids.has(q.unit))) removePerson(def, p.id);
    if (def.meetings) def.meetings = def.meetings.filter((m) => !ids.has(m.unit));
    dropStages(def, ids);
  }
  const strip = (list: typeof def.units): typeof def.units =>
    list.filter((u) => u.id !== unitId).map((u) => (u.children ? { ...u, children: strip(u.children) } : u));
  def.units = strip(def.units);
  dropDanglingDependencies(def);
}
