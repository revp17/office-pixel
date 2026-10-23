import type { DistSpec } from '../types';
import { simulateCompany } from './engine';
import type {
  Baseline,
  CompanyDef,
  Optimization,
  OrgProcessDef,
  OrgStageDef,
  PhaseKey,
  ProcessDoc,
  StepKey,
  UnitDef,
} from './types';
import { validateCompany } from './validate';

// ---------- metadatos de las fases y los pasos ----------

export const PHASES: Array<{ key: PhaseKey; n: number; title: string; summary: string }> = [
  { key: 'alcance', n: 1, title: 'Planificación y definición del alcance', summary: 'Qué proceso es, para qué, hasta dónde llega y quiénes están involucrados.' },
  { key: 'campo', n: 2, title: 'Recopilación de información (trabajo de campo)', summary: 'Entrevistas, observación en sitio, documentos y datos reales de cómo se hace hoy.' },
  { key: 'asis', n: 3, title: 'Modelado y diagramación (As-Is)', summary: 'El proceso tal como funciona hoy, modelado y medido con el simulador.' },
  { key: 'validacion', n: 4, title: 'Validación con los involucrados', summary: 'Cada involucrado confirma que el modelo refleja la realidad.' },
  { key: 'ficha', n: 5, title: 'Documentación final y fichas de proceso', summary: 'Ficha de proceso aprobada y versionada.' },
];

/** Los 5 pasos de optimización, en orden estricto. */
export const STEPS: Array<{ key: StepKey; n: number; title: string; rule: string; summary: string }> = [
  {
    key: '1',
    n: 1,
    title: 'Hacer el requerimiento menos tonto',
    rule: 'Cuestionar y simplificar cada especificación inicial.',
    summary: 'Cada requerimiento viene de una persona (no de un departamento). Pregúntale por qué existe y si de verdad hace falta.',
  },
  {
    key: '2',
    n: 2,
    title: 'Eliminar cualquier parte o proceso innecesario',
    rule: 'Borrar todo lo que no afecte críticamente el resultado.',
    summary: 'Si no tuviste que volver a añadir al menos un 10 % de lo borrado, es que no borraste lo suficiente.',
  },
  {
    key: '3',
    n: 3,
    title: 'Simplificar u optimizar el diseño',
    rule: 'Mejorar el producto solo después de haber reducido sus componentes.',
    summary: 'Rediseña lo que quedó: fusiona etapas, reduce traspasos, simplifica las reglas.',
  },
  {
    key: '4',
    n: 4,
    title: 'Acelerar el tiempo de ciclo',
    rule: 'Incrementar la velocidad de los procesos que ya fueron depurados.',
    summary: 'Solo ahora se acelera, y solo lo que sobrevivió a los pasos anteriores.',
  },
  {
    key: '5',
    n: 5,
    title: 'Automatizar',
    rule: 'Diseñar robots y sistemas autónomos únicamente al final de la cadena de optimización.',
    summary: 'Automatizar un proceso mal diseñado solo hace más rápido el error.',
  },
];

// ---------- creación y utilidades ----------

export function ensureDoc(proc: OrgProcessDef): ProcessDoc {
  proc.doc ??= { scope: { stakeholders: [] }, fieldwork: [], validations: [], phases: {} };
  return proc.doc;
}

export function ensureOptimization(proc: OrgProcessDef): Optimization {
  proc.optimization ??= { reqReview: {}, eliminated: [], speed: {}, auto: {}, steps: {} };
  return proc.optimization;
}

/** Copia del proceso sin la ficha ni la optimización (solo su definición ejecutable). */
export function cloneProcess(p: OrgProcessDef): OrgProcessDef {
  const { doc: _d, optimization: _o, ...rest } = p;
  return structuredClone(rest) as OrgProcessDef;
}

const filled = (s: string | undefined, min = 1) => (s?.trim().length ?? 0) >= min;

export function unitPath(def: CompanyDef, id: string | undefined): string {
  if (!id) return '—';
  const trail = (list: UnitDef[], path: string[]): string[] | undefined => {
    for (const u of list) {
      const p = [...path, u.name ?? u.id];
      if (u.id === id) return p;
      const r = u.children && trail(u.children, p);
      if (r) return r;
    }
  };
  return (trail(def.units, []) ?? [id]).join(' › ');
}

// ---------- distribuciones ----------

const TIME_KEYS = ['value', 'minutes', 'mean', 'meanMinutes', 'sd', 'sdMinutes', 'median', 'medianMinutes'];

/** Multiplica los parámetros de tiempo de una distribución (no la dispersión `sigma`). */
export function scaleDist(spec: DistSpec, factor: number): DistSpec {
  const out: DistSpec = { ...spec };
  for (const k of TIME_KEYS) if (typeof out[k] === 'number') out[k] = Math.round((out[k] as number) * factor * 100) / 100;
  return out;
}

/** Duración típica en minutos (media). */
export function meanOfDist(spec: DistSpec | undefined): number {
  if (!spec) return 0;
  const n = (...keys: string[]) => {
    for (const k of keys) if (typeof spec[k] === 'number') return spec[k] as number;
    return 0;
  };
  switch (spec.dist) {
    case 'fixed':
      return n('value', 'minutes');
    case 'normal':
    case 'exponential':
      return n('mean', 'meanMinutes');
    case 'lognormal': {
      const sigma = n('sigma');
      return n('median', 'medianMinutes') * Math.exp((sigma * sigma) / 2);
    }
  }
}

/** Texto corto de una duración: «~35 min». */
export function describeDuration(spec: DistSpec | undefined): string {
  if (!spec) return '—';
  const m = meanOfDist(spec);
  return m >= 90 ? `~${(m / 60).toFixed(1)} h` : `~${Math.round(m)} min`;
}

// ---------- paso 2, 4 y 5: transformaciones del proceso ----------

/** Etapa a la que va un caso por defecto (la fija o la regla «en cualquier otro caso»). */
function defaultNext(s: OrgStageDef): string | undefined {
  if (typeof s.next === 'string') return s.next;
  if (Array.isArray(s.next)) return s.next.find((r) => r.otherwise)?.to ?? s.next[s.next.length - 1]?.to;
  return undefined;
}

/** ¿Se puede eliminar? Nunca la primera etapa ni las de cierre. */
export function isRemovable(p: OrgProcessDef, id: string): boolean {
  const s = p.stages.find((x) => x.id === id);
  return !!s && s !== p.stages[0] && !s.terminal;
}

/** Elimina etapas y reconecta el flujo: quien apuntaba a la etapa borrada apunta a lo que venía después. */
export function eliminateStages(p: OrgProcessDef, ids: string[]): OrgProcessDef {
  const out = cloneProcess(p);
  for (const id of ids) {
    if (!isRemovable(out, id)) continue;
    const st = out.stages.find((s) => s.id === id)!;
    const successor = defaultNext(st);
    if (!successor || successor === id) continue;
    for (const s of out.stages) {
      if (s.id === id) continue;
      if (s.next === id) s.next = successor;
      if (Array.isArray(s.next)) for (const r of s.next) if (r.to === id) r.to = successor;
      if (s.exceptions) s.exceptions = s.exceptions.map((e) => (e.target === id ? { ...e, target: successor } : e)).filter((e) => e.target !== s.id);
      if (!s.exceptions?.length) delete s.exceptions;
    }
    out.stages = out.stages.filter((s) => s.id !== id);
  }
  // reglas que ya mandan todo al mismo sitio se simplifican a «siempre a la misma etapa»
  for (const s of out.stages) {
    if (Array.isArray(s.next) && new Set(s.next.map((r) => r.to)).size === 1) s.next = s.next[0].to;
  }
  return out;
}

/** Paso 4: multiplica la duración de las etapas indicadas (factor 0,1–1). */
export function applySpeed(p: OrgProcessDef, speed: Record<string, number>): OrgProcessDef {
  const out = cloneProcess(p);
  for (const s of out.stages) {
    const f = speed[s.id];
    if (s.duration && typeof f === 'number' && f > 0 && f < 1 && !s.automated) s.duration = scaleDist(s.duration, f);
  }
  return out;
}

/** Paso 5: automatiza las etapas indicadas; su duración pasa a ser `factor` veces la actual. */
export function applyAuto(p: OrgProcessDef, auto: Record<string, number>): OrgProcessDef {
  const out = cloneProcess(p);
  for (const s of out.stages) {
    const f = auto[s.id];
    if (typeof f === 'number' && f > 0 && s.duration && s.unit && !s.terminal) {
      s.automated = true;
      s.duration = scaleDist(s.duration, Math.min(f, 1));
    }
  }
  return out;
}

export type VariantKey = 'asis' | 'step2' | 'step3' | 'step4' | 'step5';

/** El proceso en cada punto del camino: As-Is y el resultado acumulado tras los pasos 2 a 5. */
export function buildVariants(proc: OrgProcessDef): Record<VariantKey, OrgProcessDef> {
  const opt = proc.optimization;
  const asis = cloneProcess(proc);
  const step2 = eliminateStages(asis, opt?.eliminated ?? []);
  const step3 = opt?.design ? cloneProcess(opt.design) : step2;
  const step4 = applySpeed(step3, opt?.speed ?? {});
  const step5 = applyAuto(step4, opt?.auto ?? {});
  return { asis, step2, step3, step4, step5 };
}

// ---------- ciclo de documentación: listas de comprobación ----------

export interface CheckItem {
  label: string;
  done: boolean;
}

export function docChecklist(def: CompanyDef, proc: OrgProcessDef, phase: PhaseKey): CheckItem[] {
  const doc = proc.doc ?? { scope: { stakeholders: [] }, fieldwork: [], validations: [], phases: {} };
  const sc = doc.scope;
  switch (phase) {
    case 'alcance':
      return [
        { label: 'Objetivo del proceso', done: filled(sc.objective, 5) },
        { label: 'Qué entra y qué sale (entradas y salidas)', done: filled(sc.inputs) && filled(sc.outputs) },
        { label: 'Qué está dentro y fuera del alcance', done: filled(sc.inScope) && filled(sc.outOfScope) },
        { label: 'Dueño del proceso', done: filled(sc.owner) },
        { label: 'Criterios de éxito', done: filled(sc.successCriteria, 5) },
        { label: 'Al menos un involucrado', done: sc.stakeholders.length > 0 },
      ];
    case 'campo':
      return [
        { label: 'Al menos un registro de trabajo de campo', done: doc.fieldwork.length > 0 },
        { label: 'Hallazgos anotados en al menos un registro', done: doc.fieldwork.some((f) => filled(f.findings, 3)) },
        { label: 'Al menos una entrevista u observación en sitio', done: doc.fieldwork.some((f) => f.type === 'entrevista' || f.type === 'observacion') },
      ];
    case 'asis': {
      const valid = validateCompany(def).errors.length === 0;
      return [
        { label: 'El proceso tiene al menos 2 etapas', done: proc.stages.length >= 2 },
        { label: 'El modelo de la empresa no tiene problemas', done: valid },
        { label: 'Línea base medida con el simulador', done: !!doc.baseline },
      ];
    }
    case 'validacion': {
      const status = (id: string) => doc.validations.find((v) => v.stakeholderId === id)?.status ?? 'pendiente';
      return [
        { label: 'Hay involucrados que validar', done: sc.stakeholders.length > 0 },
        { label: 'Todos los involucrados aprobaron el modelo', done: sc.stakeholders.length > 0 && sc.stakeholders.every((s) => status(s.id) === 'aprobado') },
      ];
    }
    case 'ficha':
      return [
        { label: 'Las 4 fases anteriores están completadas', done: (['alcance', 'campo', 'asis', 'validacion'] as PhaseKey[]).every((k) => !!doc.phases[k]) },
      ];
  }
}

export function phaseCompleted(proc: OrgProcessDef, phase: PhaseKey): boolean {
  return !!proc.doc?.phases[phase];
}

export function phasesDone(proc: OrgProcessDef): number {
  return PHASES.filter((p) => phaseCompleted(proc, p.key)).length;
}

// ---------- optimización: orden estricto ----------

export function stepCompleted(proc: OrgProcessDef, n: number): boolean {
  return !!proc.optimization?.steps[String(n) as StepKey];
}

/** Un paso solo se abre cuando el anterior está completado. */
export function stepUnlocked(proc: OrgProcessDef, n: number): boolean {
  return n === 1 || stepCompleted(proc, n - 1);
}

/** El primer paso sin completar (el que toca), o null si están todos. */
export function currentStep(proc: OrgProcessDef): number | null {
  for (let n = 1; n <= 5; n++) if (!stepCompleted(proc, n)) return n;
  return null;
}

/** Etapas que tienen trabajo (las que se cuestionan en el paso 1). */
export function reviewableStages(proc: OrgProcessDef): OrgStageDef[] {
  return proc.stages.filter((s) => s.unit || s.duration);
}

export function stepChecklist(proc: OrgProcessDef, n: number): CheckItem[] {
  const opt = proc.optimization ?? { reqReview: {}, eliminated: [], speed: {}, auto: {}, steps: {} };
  switch (n) {
    case 1:
      return reviewableStages(proc).map((s) => {
        const r = opt.reqReview[s.id];
        return {
          label: `«${s.label ?? s.id}»: quién lo pidió, por qué existe y si es necesario`,
          done: !!r && filled(r.requestedBy, 2) && filled(r.reason, 3) && !!r.needed,
        };
      });
    case 2: {
      const justified = filled(opt.eliminationNotes, 15);
      const pendingNo = reviewableStages(proc).filter((s) => opt.reqReview[s.id]?.needed === 'no' && !opt.eliminated.includes(s.id) && isRemovable(proc, s.id));
      return [
        { label: 'Eliminé algo, o expliqué por qué no se puede eliminar nada', done: opt.eliminated.length > 0 || justified },
        {
          label:
            pendingNo.length === 0
              ? 'Todo lo marcado como «no necesario» en el paso 1 está eliminado'
              : `Falta eliminar (o justificar) lo marcado como «no necesario»: ${pendingNo.map((s) => s.label ?? s.id).join(', ')}`,
          done: pendingNo.length === 0 || justified,
        },
      ];
    }
    case 3: {
      const base = eliminateStages(proc, opt.eliminated);
      const changed = !!opt.design && JSON.stringify(opt.design) !== JSON.stringify(base);
      return [
        { label: 'Rediseñé lo que quedó, o expliqué por qué el diseño ya es el mínimo', done: changed || filled(opt.designNotes, 10) },
      ];
    }
    case 4: {
      const sped = Object.values(opt.speed).some((f) => f < 1);
      return [{ label: 'Aceleré al menos una etapa, o expliqué por qué aún no', done: sped || filled(opt.speedNotes, 10) }];
    }
    case 5: {
      const autom = Object.keys(opt.auto).length > 0;
      return [{ label: 'Automaticé al menos una etapa, o expliqué por qué aún no', done: autom || filled(opt.autoNotes, 10) }];
    }
  }
  return [];
}

export function completeStep(proc: OrgProcessDef, n: number, now: string): { ok: boolean; reason?: string } {
  if (n < 1 || n > 5) return { ok: false, reason: 'Paso inexistente.' };
  if (!stepUnlocked(proc, n)) return { ok: false, reason: `Antes hay que completar el paso ${n - 1}. El orden es estricto.` };
  const open = stepChecklist(proc, n).filter((c) => !c.done);
  if (open.length) return { ok: false, reason: `Falta: ${open[0].label}` };
  const opt = ensureOptimization(proc);
  if (n === 2) opt.design = eliminateStages(proc, opt.eliminated); // desde aquí se rediseña esta copia
  opt.steps[String(n) as StepKey] = { completedAt: now };
  return { ok: true };
}

/** Reabre un paso: como el orden es estricto, también se reabren todos los posteriores. */
export function reopenStep(proc: OrgProcessDef, n: number) {
  const opt = ensureOptimization(proc);
  for (let k = n; k <= 5; k++) delete opt.steps[String(k) as StepKey];
  if (n <= 2) delete opt.design;
}

// ---------- impacto: simular cada variante ----------

export interface VariantRow {
  key: VariantKey;
  label: string;
  stages: number;
  completed: number;
  cycleAvg: number;
  cycleP90: number;
  slaBreaches: number;
  waitPerCase: number;
  error?: string;
}

export interface CompareOptions {
  seeds: number[];
  days: number;
}

const VARIANT_LABEL: Record<VariantKey, string> = {
  asis: 'As-Is (hoy)',
  step2: 'Paso 2 · Eliminar',
  step3: 'Paso 3 · Simplificar el diseño',
  step4: 'Paso 4 · Acelerar',
  step5: 'Paso 5 · Automatizar',
};

function withProcess(def: CompanyDef, id: string, variant: OrgProcessDef): CompanyDef {
  const stages = new Set(variant.stages.map((s) => s.id));
  return {
    ...def,
    processes: def.processes.map((p) => {
      if (p.id === id) {
        // los procedimientos de una etapa eliminada quedan sin etapa en la variante
        const procedures = variant.procedures?.map((pc) => (pc.stageId && !stages.has(pc.stageId) ? { ...pc, stageId: undefined } : pc));
        return { ...variant, id, name: p.name, ...(procedures ? { procedures } : {}) };
      }
      // si la variante eliminó la etapa que disparaba a otro proceso, ahora dispara al completarse el caso
      if (!p.dependsOn?.some((d) => d.process === id && d.atStage && !stages.has(d.atStage))) return p;
      return { ...p, dependsOn: p.dependsOn.map((d) => (d.process === id && d.atStage && !stages.has(d.atStage) ? { ...d, atStage: undefined } : d)) };
    }),
  };
}

/** La empresa con una variante del proceso en lugar del proceso actual (para verla en el plano). */
export function variantCompany(def: CompanyDef, procId: string, key: VariantKey): CompanyDef {
  const proc = def.processes.find((p) => p.id === procId)!;
  return withProcess(def, procId, buildVariants(proc)[key]);
}

/** Simula una variante del proceso con varias semillas y promedia las métricas del proceso. */
export function measureVariant(def: CompanyDef, procId: string, variant: OrgProcessDef, o: CompareOptions): Omit<VariantRow, 'key' | 'label'> {
  const company = withProcess(def, procId, variant);
  const errors = validateCompany(company).errors;
  const empty = { stages: variant.stages.length, completed: 0, cycleAvg: 0, cycleP90: 0, slaBreaches: 0, waitPerCase: 0 };
  if (errors.length) return { ...empty, error: errors[0] };
  let completed = 0;
  let cycleAvg = 0;
  let cycleP90 = 0;
  let sla = 0;
  let wait = 0;
  for (const seed of o.seeds) {
    const m = simulateCompany(company, { seed, horizonDays: o.days }).metrics;
    const pm = m.byProcess[procId];
    completed += pm.completed;
    cycleAvg += pm.cycleAvg;
    cycleP90 += pm.cycleP90;
    sla += pm.slaBreaches;
    let w = 0;
    for (const [k, st] of Object.entries(m.byStage)) if (k.startsWith(`${procId}.`)) w += st.waitAvg * st.started;
    wait += pm.completed ? w / pm.completed : 0;
  }
  const n = o.seeds.length;
  return { stages: variant.stages.length, completed: completed / n, cycleAvg: cycleAvg / n, cycleP90: cycleP90 / n, slaBreaches: sla / n, waitPerCase: wait / n };
}

/** Compara el As-Is con cada paso ya completado y con el paso en curso. */
export function compareVariants(def: CompanyDef, procId: string, o: CompareOptions): VariantRow[] {
  const proc = def.processes.find((p) => p.id === procId)!;
  const v = buildVariants(proc);
  const last = currentStep(proc) ?? 5;
  const keys: VariantKey[] = ['asis'];
  if (last >= 2) keys.push('step2');
  if (last >= 3 && proc.optimization?.design) keys.push('step3');
  if (last >= 4) keys.push('step4');
  if (last >= 5) keys.push('step5');
  return keys.map((key) => ({ key, label: VARIANT_LABEL[key], ...measureVariant(def, procId, v[key], o) }));
}

/** Mide el As-Is y lo deja como línea base de la ficha. */
export function captureBaseline(def: CompanyDef, procId: string, o: CompareOptions, now: string): Baseline {
  const proc = def.processes.find((p) => p.id === procId)!;
  const m = measureVariant(def, procId, cloneProcess(proc), o);
  return {
    capturedAt: now,
    seeds: o.seeds,
    days: o.days,
    stages: m.stages,
    completed: m.completed,
    cycleAvg: m.cycleAvg,
    cycleP90: m.cycleP90,
    slaBreaches: m.slaBreaches,
    waitPerCase: m.waitPerCase,
  };
}
