import { PHASES, STEPS, describeDuration, ensureDoc, meanOfDist, phasesDone, stepCompleted, unitPath, type VariantRow } from './manage';
import { procedureCoverage, procedureStatus } from './procedures';
import type { CompanyDef, OrgProcessDef, OrgStageDef, ValidationStatus } from './types';

const cell = (s: string | undefined) => (s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '—';
const text = (s: string | undefined) => (s?.trim() ? s.trim() : '_Sin definir_');
const pct = (x: number) => `${Math.round(x * 100)} %`;
const mins = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);
const cond = (when: string | undefined) => (when ?? '').replace(/\bcase\./g, '');

const STATUS_TEXT: Record<ValidationStatus, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', observado: 'Con observaciones' };
const FIELD_TEXT = { entrevista: 'Entrevista', observacion: 'Observación', documento: 'Documento', datos: 'Datos' } as const;

function nextText(p: OrgProcessDef, s: OrgStageDef): string {
  const name = (id: string) => p.stages.find((x) => x.id === id)?.label ?? id;
  if (s.terminal) return 'Fin del proceso';
  if (typeof s.next === 'string') return name(s.next);
  if (Array.isArray(s.next))
    return s.next.map((r) => (r.otherwise ? `en otro caso → ${name(r.to)}` : `si ${cond(r.when)} → ${name(r.to)}`)).join('; ');
  return '—';
}

export function stageRows(def: CompanyDef, p: OrgProcessDef): string[] {
  const name = (id: string) => p.stages.find((x) => x.id === id)?.label ?? id;
  return p.stages.map((s, i) => {
    const who = s.automated ? '⚙ Sistema (automatizada)' : s.role ?? '—';
    const exc = (s.exceptions ?? []).map((e) => `${e.id} (${pct(e.probability)}) → ${name(e.target)}`).join('; ');
    const sla = s.sla ? mins(s.sla.maxMinutes) : '—';
    return `| ${i + 1} | ${cell(s.label ?? s.id)} | ${cell(s.unit ? unitPath(def, s.unit) : '—')} | ${cell(who)} | ${s.duration ? describeDuration(s.duration) : '—'} | ${sla} | ${cell(nextText(p, s))} | ${cell(exc)} |`;
  });
}

/** Ficha de proceso en Markdown: identificación, alcance, involucrados, campo, As-Is, validación y optimización. */
export function fichaMarkdown(def: CompanyDef, proc: OrgProcessDef, impact?: VariantRow[]): string {
  const doc = ensureDocReadonly(proc);
  const sc = doc.scope;
  const owner = def.people.find((p) => p.id === sc.owner)?.name ?? sc.owner;
  const name = proc.name ?? proc.id;
  const out: string[] = [];

  out.push(`# Ficha de proceso — ${name}`);
  out.push('');
  out.push(`> Versión ${doc.version ?? 'borrador'}${doc.approvedAt ? ` · aprobada el ${doc.approvedAt}` : ' · aún sin aprobar'} · ${def.company}`);
  out.push('');

  out.push('## 1. Identificación');
  out.push('');
  out.push('| Campo | Valor |', '|---|---|');
  out.push(`| Proceso | ${cell(name)} |`);
  out.push(`| Planta / empresa | ${cell(def.company)} |`);
  out.push(`| Dueño del proceso | ${cell(owner)} |`);
  out.push(`| Inicio del levantamiento | ${cell(sc.startDate)} |`);
  out.push(`| Fin del levantamiento | ${cell(sc.endDate)} |`);
  out.push(`| Fases del ciclo completadas | ${phasesDone(proc)} de ${PHASES.length} |`);
  out.push('');

  out.push('## 2. Objetivo y alcance');
  out.push('');
  out.push(`**Objetivo:** ${text(sc.objective)}`, '');
  out.push(`**Entradas:** ${text(sc.inputs)}`, '');
  out.push(`**Salidas:** ${text(sc.outputs)}`, '');
  out.push(`**Dentro del alcance:** ${text(sc.inScope)}`, '');
  out.push(`**Fuera del alcance:** ${text(sc.outOfScope)}`, '');
  out.push(`**Criterios de éxito:** ${text(sc.successCriteria)}`, '');

  out.push('## 3. Involucrados');
  out.push('');
  if (sc.stakeholders.length === 0) out.push('_Sin involucrados registrados._');
  else {
    out.push('| Nombre | Rol | Validación |', '|---|---|---|');
    for (const s of sc.stakeholders) {
      const v = doc.validations.find((x) => x.stakeholderId === s.id);
      out.push(`| ${cell(s.name)} | ${cell(s.role)} | ${STATUS_TEXT[v?.status ?? 'pendiente']} |`);
    }
  }
  out.push('');

  out.push('## 4. Hallazgos del trabajo de campo');
  out.push('');
  if (doc.fieldwork.length === 0) out.push('_Sin registros._');
  else {
    out.push('| Fecha | Tipo | Fuente | Hallazgos |', '|---|---|---|---|');
    for (const f of doc.fieldwork) out.push(`| ${cell(f.date)} | ${FIELD_TEXT[f.type]} | ${cell(f.source)} | ${cell(f.findings)} |`);
  }
  out.push('');

  out.push('## 5. Proceso As-Is');
  out.push('');
  const a = proc.arrivals;
  out.push(`**Llegada de casos:** ${a.type === 'poisson' ? `al azar, en promedio ${a.ratePerHour} por hora hábil` : `uno cada ${a.everyMinutes} min hábiles`}.`, '');
  const attrs = Object.keys(proc.attributes ?? {});
  if (attrs.length) out.push(`**Datos de cada caso:** ${attrs.join(', ')}.`, '');
  out.push('| # | Etapa | Área › Subárea | Rol | Duración típica | Plazo (SLA) | Siguiente | Excepciones |', '|---|---|---|---|---|---|---|---|');
  out.push(...stageRows(def, proc));
  out.push('');
  const work = proc.stages.filter((s) => s.duration && !s.terminal).reduce((n, s) => n + meanOfDist(s.duration), 0);
  out.push(`**Tiempo de trabajo típico por caso (suma de etapas):** ${mins(work)}.`, '');
  if (doc.baseline) {
    const b = doc.baseline;
    out.push(`**Línea base** (simulador, ${b.seeds.length} semillas, ${b.days} días, medida el ${b.capturedAt.slice(0, 10)}):`, '');
    out.push('| Medida | Valor |', '|---|---|');
    out.push(`| Casos cerrados | ${Math.round(b.completed)} |`);
    out.push(`| Tiempo de ciclo medio (hábil) | ${mins(b.cycleAvg)} |`);
    out.push(`| Tiempo de ciclo P90 (hábil) | ${mins(b.cycleP90)} |`);
    out.push(`| Espera total por caso | ${mins(b.waitPerCase)} |`);
    out.push(`| Plazos incumplidos | ${Math.round(b.slaBreaches)} |`);
    out.push('');
  } else out.push('_Línea base aún no medida._', '');

  out.push('## 6. Validación');
  out.push('');
  const rows = sc.stakeholders.map((s) => ({ s, v: doc.validations.find((x) => x.stakeholderId === s.id) }));
  if (rows.length === 0) out.push('_Sin involucrados._');
  else {
    out.push('| Involucrado | Estado | Fecha | Comentario |', '|---|---|---|---|');
    for (const { s, v } of rows) out.push(`| ${cell(s.name)} | ${STATUS_TEXT[v?.status ?? 'pendiente']} | ${cell(v?.date)} | ${cell(v?.comment)} |`);
  }
  out.push('');

  const opt = proc.optimization;
  if (opt && (Object.keys(opt.steps).length > 0 || Object.keys(opt.reqReview).length > 0)) {
    out.push('## 7. Optimización (proceso de 5 pasos, en orden estricto)');
    out.push('');
    for (const st of STEPS) {
      out.push(`- **Paso ${st.n} · ${st.title}** — ${stepCompleted(proc, st.n) ? `completado el ${opt.steps[st.key]!.completedAt}` : 'pendiente'}`);
    }
    out.push('');
    const label = (id: string) => proc.stages.find((s) => s.id === id)?.label ?? id;
    const reviews = Object.entries(opt.reqReview);
    if (reviews.length) {
      out.push('**Requerimientos cuestionados (paso 1):**', '', '| Etapa | Lo pidió | Por qué existe | ¿Necesario? |', '|---|---|---|---|');
      for (const [id, r] of reviews) out.push(`| ${cell(label(id))} | ${cell(r.requestedBy)} | ${cell(r.reason)} | ${r.needed === 'si' ? 'Sí' : r.needed === 'no' ? 'No' : r.needed === 'duda' ? 'No sé' : '—'} |`);
      out.push('');
    }
    if (opt.eliminated.length) out.push(`**Eliminado (paso 2):** ${opt.eliminated.map(label).join(', ')}.`, '');
    if (opt.eliminationNotes?.trim()) out.push(`_Nota paso 2:_ ${opt.eliminationNotes.trim()}`, '');
    if (opt.designNotes?.trim()) out.push(`_Nota paso 3:_ ${opt.designNotes.trim()}`, '');
    const sped = Object.entries(opt.speed).filter(([, f]) => f < 1);
    if (sped.length) out.push(`**Acelerado (paso 4):** ${sped.map(([id, f]) => `${label(id)} (${pct(f)} de la duración)`).join(', ')}.`, '');
    if (opt.speedNotes?.trim()) out.push(`_Nota paso 4:_ ${opt.speedNotes.trim()}`, '');
    const autos = Object.entries(opt.auto);
    if (autos.length) out.push(`**Automatizado (paso 5):** ${autos.map(([id, f]) => `${label(id)} (${pct(f)} de la duración)`).join(', ')}.`, '');
    if (opt.autoNotes?.trim()) out.push(`_Nota paso 5:_ ${opt.autoNotes.trim()}`, '');
    if (impact?.length) {
      out.push('**Impacto medido con el simulador:**', '', '| Variante | Etapas | Cerrados | Ciclo medio | Ciclo P90 | Espera por caso | SLA rotos |', '|---|---|---|---|---|---|---|');
      for (const r of impact)
        out.push(r.error ? `| ${r.label} | ${r.stages} | — | — | — | — | ${cell(r.error)} |` : `| ${r.label} | ${r.stages} | ${Math.round(r.completed)} | ${mins(r.cycleAvg)} | ${mins(r.cycleP90)} | ${mins(r.waitPerCase)} | ${Math.round(r.slaBreaches)} |`);
      out.push('');
    }
  }

  const procs = proc.procedures ?? [];
  if (procs.length) {
    const n = opt && (Object.keys(opt.steps).length > 0 || Object.keys(opt.reqReview).length > 0) ? 8 : 7;
    out.push(`## ${n}. Procedimientos asociados`, '');
    out.push('Cada procedimiento detalla el cómo, quién y cuándo de una etapa del proceso.', '');
    out.push('| Código | Título | Etapa | Versión | Estado | Pasos |', '|---|---|---|---|---|---|');
    for (const p of procs) {
      const st = proc.stages.find((s) => s.id === p.stageId);
      out.push(`| ${p.code} | ${cell(p.title)} | ${cell(st?.label ?? p.stageId)} | ${p.version ?? '—'} | ${procedureStatus(p) === 'publicado' ? 'Publicado' : 'Borrador'} | ${p.steps.length} |`);
    }
    const cov = procedureCoverage(proc);
    out.push('', `**Cobertura:** ${cov.filter((c) => c.published > 0).length} de ${cov.length} etapas con trabajo tienen un procedimiento publicado.`, '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

/** Igual que ensureDoc pero sin modificar el proceso. */
function ensureDocReadonly(proc: OrgProcessDef) {
  return proc.doc ?? ensureDoc({ ...proc, doc: undefined } as OrgProcessDef);
}
