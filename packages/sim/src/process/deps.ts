import type { CompanyDef, DependencyKind, OrgProcessDef, Procedure } from '../model';

export interface DepEdge {
  /** proceso de origen (del que se depende) */
  from: string;
  /** proceso que depende */
  to: string;
  kind: DependencyKind;
  atStage?: string;
  probability: number;
  /** etapa del proceso que depende por la que entra el caso nuevo (si no, la primera) */
  toStage?: string;
  inherit?: boolean;
  note?: string;
}

export const DEP_KIND_LABEL: Record<DependencyKind, string> = {
  dispara: 'dispara',
  requiere: 'requiere',
};

/** Todas las dependencias entre procesos de la empresa, del origen al que depende. */
export function dependencyEdges(def: CompanyDef): DepEdge[] {
  const ids = new Set(def.processes.map((p) => p.id));
  const out: DepEdge[] = [];
  for (const p of def.processes)
    for (const d of p.dependsOn ?? [])
      if (ids.has(d.process)) out.push({ from: d.process, to: p.id, kind: d.kind, atStage: d.atStage, probability: d.probability ?? 1, toStage: d.toStage, inherit: d.inherit, note: d.note });
  return out;
}

/** Procesos de los que depende (directamente) el proceso `id`. */
export const upstreamOf = (def: CompanyDef, id: string) => dependencyEdges(def).filter((e) => e.to === id);
/** Procesos que dependen (directamente) del proceso `id`. */
export const downstreamOf = (def: CompanyDef, id: string) => dependencyEdges(def).filter((e) => e.from === id);

/**
 * Columna de cada proceso en el mapa: 0 para los que no dependen de nadie y, para el resto,
 * una más que la mayor columna de sus orígenes. Tolera ciclos (los ignora al encontrarlos).
 */
export function dependencyLevels(def: CompanyDef): Map<string, number> {
  const edges = dependencyEdges(def);
  const level = new Map<string, number>();
  const visit = (id: string, trail: Set<string>): number => {
    if (level.has(id)) return level.get(id)!;
    if (trail.has(id)) return 0;
    trail.add(id);
    const lv = Math.max(-1, ...edges.filter((e) => e.to === id).map((e) => visit(e.from, trail))) + 1;
    trail.delete(id);
    level.set(id, lv);
    return lv;
  };
  for (const p of def.processes) visit(p.id, new Set());
  return level;
}

/** Cuántos procesos conectados tiene (sirve para saber si vale la pena mostrar el mapa). */
export function connectedProcesses(def: CompanyDef): Set<string> {
  const s = new Set<string>();
  for (const e of dependencyEdges(def)) {
    s.add(e.from);
    s.add(e.to);
  }
  return s;
}

export function dependencyText(def: CompanyDef, e: DepEdge, perspective: 'to' | 'from' = 'to'): string {
  const name = (id: string) => def.processes.find((p) => p.id === id)?.name ?? id;
  const stage = (pid: string, sid?: string) =>
    sid ? (def.processes.find((p) => p.id === pid)?.stages.find((s) => s.id === sid)?.label ?? sid) : undefined;
  const when = e.atStage ? `al terminar «${stage(e.from, e.atStage)}»` : 'al completarse un caso';
  const prob = e.probability < 1 ? ` (en el ${Math.round(e.probability * 100)} % de los casos)` : '';
  const entry = e.toStage ? ` y entra por «${stage(e.to, e.toStage)}»` : '';
  const inh = e.inherit ? ', con los datos del caso de origen' : '';
  if (perspective === 'to')
    return e.kind === 'dispara'
      ? `Nace de «${name(e.from)}» ${when}${prob}${entry}${inh}`
      : `Requiere el resultado de «${name(e.from)}»${e.atStage ? ` (${stage(e.from, e.atStage)})` : ''}`;
  return e.kind === 'dispara' ? `Dispara «${name(e.to)}» ${when}${prob}${entry}${inh}` : `Alimenta a «${name(e.to)}», que lo requiere`;
}

// ---------- procedimientos ----------

/** Publicado = aprobado y con los 5 pasos de levantamiento completos (igual que `procedureStatus`). */
export const isPublished = (pc: Procedure) => !!pc.approvedAt && Object.values(pc.done).filter(Boolean).length === 5;

export interface ProcRef {
  proc: OrgProcessDef;
  pc: Procedure;
}

export function allProcedures(def: CompanyDef): ProcRef[] {
  return def.processes.flatMap((proc) => (proc.procedures ?? []).map((pc) => ({ proc, pc })));
}

/** Requisitos de un procedimiento, ya resueltos (los que no existen se omiten). */
export function prerequisitesOf(def: CompanyDef, pc: Procedure): ProcRef[] {
  const all = allProcedures(def);
  return (pc.prerequisites ?? []).map((id) => all.find((r) => r.pc.id === id)).filter((r): r is ProcRef => !!r);
}

/** Procedimientos que tienen a `pc` como requisito. */
export function dependentsOf(def: CompanyDef, pc: Procedure): ProcRef[] {
  return allProcedures(def).filter((r) => r.pc.prerequisites?.includes(pc.id));
}

/** Requisitos (directos e indirectos) que aún no están publicados, en orden de ejecución. */
export function unpublishedPrerequisites(def: CompanyDef, pc: Procedure): ProcRef[] {
  const seen = new Set<string>([pc.id]);
  const out: ProcRef[] = [];
  const walk = (p: Procedure) => {
    for (const r of prerequisitesOf(def, p)) {
      if (seen.has(r.pc.id)) continue;
      seen.add(r.pc.id);
      walk(r.pc);
      if (!isPublished(r.pc)) out.push(r);
    }
  };
  walk(pc);
  return out;
}

/** Al borrar un proceso o procedimiento: quita las referencias que quedarían colgando. */
export function dropDanglingDependencies(def: CompanyDef): void {
  const pids = new Set(def.processes.map((p) => p.id));
  const stages = new Map(def.processes.map((p) => [p.id, new Set(p.stages.map((s) => s.id))]));
  const pcs = new Set(allProcedures(def).map((r) => r.pc.id));
  for (const p of def.processes) {
    if (p.dependsOn) {
      p.dependsOn = p.dependsOn.filter((d) => pids.has(d.process));
      for (const d of p.dependsOn) {
        if (d.atStage && !stages.get(d.process)!.has(d.atStage)) delete d.atStage;
        if (d.toStage && !stages.get(p.id)!.has(d.toStage)) delete d.toStage;
      }
      if (!p.dependsOn.length) delete p.dependsOn;
    }
    for (const pc of p.procedures ?? []) {
      if (pc.prerequisites) {
        pc.prerequisites = pc.prerequisites.filter((r) => pcs.has(r));
        if (!pc.prerequisites.length) delete pc.prerequisites;
      }
    }
  }
}
