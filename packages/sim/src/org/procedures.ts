import type { CheckItem } from './manage';
import { reviewableStages, unitPath } from './manage';
import type {
  CompanyDef,
  OrgProcessDef,
  ProcException,
  ProcStep,
  ProcStepKey,
  Procedure,
  WarningKind,
} from './types';

/** Los 5 pasos para levantar un procedimiento, en orden. */
export const PROC_STEPS: Array<{ key: ProcStepKey; n: number; title: string; summary: string }> = [
  {
    key: '1',
    n: 1,
    title: 'Entrevista de tarea a tarea y observación crítica',
    summary: 'Con los operadores directos: que ejecuten la tarea en vivo, anota las excepciones y los «trucos» que usan.',
  },
  {
    key: '2',
    n: 2,
    title: 'Estructurar el contenido (los 5 bloques)',
    summary: 'Objetivo y alcance, responsabilidades (puestos, no nombres), glosario, desarrollo paso a paso y anexos con control de cambios.',
  },
  {
    key: '3',
    n: 3,
    title: 'Redactar en formato «acción-resultado»',
    summary: 'Una sola acción por paso: [Actor] + [Acción] + [Herramienta o medio] + [Resultado esperado]. Verbos de acción, frases cortas.',
  },
  {
    key: '4',
    n: 4,
    title: 'Incorporar ayudas visuales',
    summary: 'Capturas de pantalla anotadas, diagrama de flujo a nivel de tarea y señales de advertencia en los pasos críticos.',
  },
  {
    key: '5',
    n: 5,
    title: 'Prueba de escritorio y validación cruzada',
    summary: 'La prueba del novato y la firma de conformidad del operador que dio la información.',
  },
];

export const WARNING_LABEL: Record<WarningKind, string> = {
  critico: 'Alerta crítica',
  financiero: 'Riesgo financiero',
  seguridad: 'Seguridad',
  error_comun: 'Error común',
};

// ---------- utilidades ----------

const norm = (s: string | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const filled = (s: string | undefined, min = 1) => (s?.trim().length ?? 0) >= min;

export function nextProcVersion(v: string | undefined): string {
  const m = v ? /^(\d+)\.(\d+)$/.exec(v) : null;
  return m ? `${m[1]}.${Number(m[2]) + 1}` : '1.0';
}

/** ¿El texto es el nombre de una persona de la empresa? (los procedimientos usan puestos, no nombres). */
export function isPersonName(def: CompanyDef, text: string | undefined): boolean {
  const t = norm(text);
  if (!t) return false;
  return def.people.some((p) => {
    const full = norm(p.name);
    if (!full) return false;
    const first = full.split(' ')[0];
    return t === full || t.includes(full) || (first.length >= 3 && t === first);
  });
}

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'el/la']);
const IMPERATIVES = new Set([
  'ingresa', 'verifica', 'descarga', 'aprueba', 'registra', 'revisa', 'envía', 'envia', 'abre', 'selecciona', 'guarda', 'confirma',
  'solicita', 'imprime', 'firma', 'notifica', 'valida', 'genera', 'crea', 'actualiza', 'comprueba', 'escanea', 'archiva', 'calcula',
  'consulta', 'completa', 'entrega', 'recibe', 'introduce', 'accede', 'haz', 'asigna', 'cierra', 'compara', 'carga', 'adjunta',
]);

/** ¿La instrucción empieza con un verbo de acción (infinitivo o imperativo)? */
export function startsWithVerb(text: string | undefined): boolean {
  const w = (text ?? '').trim().split(/\s+/)[0]?.toLowerCase().replace(/[.,;:]+$/, '');
  if (!w || ARTICLES.has(w)) return false;
  return /^[a-záéíóúüñ]{2,}(ar|er|ir|ír)(se)?$/.test(w) || IMPERATIVES.has(w);
}

/** Heurística: ¿parece que el paso mezcla varias acciones? */
export function looksMultiAction(text: string | undefined): boolean {
  return /;|\.\s+\S|\s(y|e)\s+[a-záéíóúüñ]+(ar|er|ir)\b/i.test(text ?? '');
}

export interface Issue {
  level: 'error' | 'warn' | 'info';
  msg: string;
}

/** Revisión de un paso según el formato acción-resultado. */
export function lintStep(def: CompanyDef, s: ProcStep): Issue[] {
  const out: Issue[] = [];
  if (!filled(s.actor)) out.push({ level: 'error', msg: 'Falta el actor (el puesto que ejecuta el paso).' });
  else if (isPersonName(def, s.actor)) out.push({ level: 'error', msg: 'El actor es un nombre propio: usa el puesto.' });
  if (!filled(s.action)) out.push({ level: 'error', msg: 'Falta la acción.' });
  else {
    if (!startsWithVerb(s.action)) out.push({ level: 'error', msg: 'Empieza con un verbo de acción (Ingresar, Verificar, Descargar, Aprobar…); el actor va en su propio campo.' });
    if (looksMultiAction(s.action)) out.push({ level: 'warn', msg: 'Parece contener más de una acción: una sola acción por paso.' });
    if (s.action.trim().length > 140) out.push({ level: 'warn', msg: 'Frase larga: acórtala (máx. ~140 caracteres).' });
  }
  if (!filled(s.result)) out.push({ level: 'error', msg: 'Falta el resultado esperado.' });
  if (!filled(s.tool)) out.push({ level: 'info', msg: 'Sin herramienta o medio (sistema, formato, carpeta…).' });
  return out;
}

/** Frase del paso: «Analista de Cuentas — Registrar la factura · Herramienta: SAP · Resultado: …». */
export function stepSentence(s: ProcStep): string {
  const parts = [`${s.actor.trim() || '—'} — ${s.action.trim() || '—'}`];
  if (filled(s.tool)) parts.push(`Herramienta: ${s.tool!.trim()}`);
  if (filled(s.result)) parts.push(`Resultado: ${s.result!.trim()}`);
  return parts.join(' · ');
}

// ---------- creación ----------

function abbreviation(name: string): string {
  const letters = norm(name)
    .split(' ')
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (letters || 'PRO').slice(0, 4);
}

export function newProcedure(def: CompanyDef, proc: OrgProcessDef, stageId?: string, title?: string): Procedure {
  const existing = def.processes.flatMap((p) => p.procedures ?? []);
  const base = `PRO-${abbreviation(proc.name ?? proc.id)}-`;
  let n = (proc.procedures ?? []).length + 1;
  while (existing.some((x) => x.code === `${base}${String(n).padStart(3, '0')}`)) n++;
  const stage = proc.stages.find((s) => s.id === stageId);
  return {
    id: `pc_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    code: `${base}${String(n).padStart(3, '0')}`,
    title: title ?? (stage ? `Cómo ejecutar: ${stage.label ?? stage.id}` : 'Nuevo procedimiento'),
    stageId,
    digital: true,
    fieldwork: [],
    responsibilities: stage?.role ? [{ role: stage.role, description: '' }] : [],
    glossary: [],
    annexes: [],
    steps: [],
    attempts: [],
    signoffs: [],
    changes: [],
    done: {},
  };
}

// ---------- levantamiento ----------

export function allFieldExceptions(pc: Procedure): ProcException[] {
  return pc.fieldwork.flatMap((f) => f.exceptions).filter((e) => filled(e.text));
}

/** Excepciones del levantamiento que ningún paso cubre con un camino alternativo. */
export function uncoveredExceptions(pc: Procedure): ProcException[] {
  const covered = new Set(pc.steps.flatMap((s) => s.alternatives.map((a) => a.exceptionId).filter(Boolean)));
  return allFieldExceptions(pc).filter((e) => !covered.has(e.id));
}

export function distinctOperators(pc: Procedure): string[] {
  const seen = new Map<string, string>();
  for (const f of pc.fieldwork) if (filled(f.operator, 2)) seen.set(norm(f.operator), f.operator.trim());
  return [...seen.values()];
}

// ---------- listas de comprobación por paso ----------

export function procChecklist(def: CompanyDef, pc: Procedure, n: number): CheckItem[] {
  switch (n) {
    case 1:
      return [
        { label: 'Todos los registros indican con qué operador se hicieron', done: pc.fieldwork.length > 0 && pc.fieldwork.every((f) => filled(f.operator, 2)) },
        { label: 'Al menos una observación de la tarea ejecutada en vivo', done: pc.fieldwork.some((f) => f.method === 'en_vivo') },
        { label: 'Al menos una excepción preguntada y registrada («¿qué pasa si…?»)', done: allFieldExceptions(pc).length > 0 },
        { label: 'Trucos operativos registrados (o confirmado que no hay)', done: pc.fieldwork.some((f) => f.tricks.some((t) => filled(t))) || !!pc.noTricks },
      ];
    case 2: {
      const roleNames = pc.responsibilities.every((r) => filled(r.role) && !isPersonName(def, r.role));
      return [
        { label: 'Objetivo (qué busca lograr la tarea)', done: filled(pc.objective, 10) },
        { label: 'Alcance: dónde empieza y dónde termina', done: filled(pc.startsWhen) && filled(pc.endsWhen) },
        { label: 'Al menos una responsabilidad', done: pc.responsibilities.length > 0 },
        { label: 'Las responsabilidades usan puestos, no nombres propios', done: pc.responsibilities.length > 0 && roleNames },
        { label: 'Glosario (siglas y sistemas), o confirmado que no hace falta', done: pc.glossary.some((g) => filled(g.term) && filled(g.definition)) || !!pc.noGlossary },
      ];
    }
    case 3: {
      const issues = pc.steps.map((s) => lintStep(def, s).filter((i) => i.level === 'error'));
      const roles = new Set(pc.responsibilities.map((r) => norm(r.role)));
      return [
        { label: 'Hay al menos un paso', done: pc.steps.length > 0 },
        { label: 'Todos los pasos tienen actor (puesto), acción y resultado esperado', done: pc.steps.length > 0 && pc.steps.every((s) => filled(s.actor) && filled(s.action) && filled(s.result)) },
        { label: 'Cada acción empieza con un verbo y ningún actor es un nombre propio', done: pc.steps.length > 0 && issues.every((l) => l.length === 0) },
        { label: 'Cada actor está en la lista de responsabilidades', done: pc.steps.length > 0 && pc.steps.every((s) => roles.has(norm(s.actor))) },
        {
          label:
            uncoveredExceptions(pc).length === 0
              ? 'Todas las excepciones del levantamiento tienen su camino alternativo'
              : `Faltan caminos alternativos para ${uncoveredExceptions(pc).length} excepción(es) del levantamiento`,
          done: uncoveredExceptions(pc).length === 0,
        },
      ];
    }
    case 4: {
      const annotated = pc.steps.some((s) => s.image && s.image.marks.length > 0);
      return [
        { label: 'Diagrama de flujo a nivel de tarea (se genera con los pasos)', done: pc.steps.length > 0 },
        { label: 'Señales de advertencia en los pasos críticos (o confirmado que no hay)', done: pc.steps.some((s) => !!s.warning && filled(s.warning.text)) || !!pc.noWarnings },
        { label: pc.digital ? 'Al menos una captura de pantalla con marcas (flechas o círculos)' : 'Capturas: no aplica (procedimiento no digital)', done: !pc.digital || annotated },
      ];
    }
    case 5: {
      const last = pc.attempts[pc.attempts.length - 1];
      const operators = distinctOperators(pc);
      const signed = (name: string) => pc.signoffs.some((s) => norm(s.name) === norm(name) && s.status === 'conforme');
      return [
        { label: 'Prueba del novato: la última prueba terminó la tarea sin hacer preguntas', done: !!last && last.completed && last.questions === 0 },
        {
          label: operators.length ? `Firma de conformidad de todos los operadores consultados (${operators.length})` : 'Firma de conformidad del operador',
          done: operators.length > 0 && operators.every(signed),
        },
      ];
    }
  }
  return [];
}

export function procStepCompleted(pc: Procedure, n: number): boolean {
  return !!pc.done[String(n) as ProcStepKey];
}

export function procStepUnlocked(pc: Procedure, n: number): boolean {
  return n === 1 || procStepCompleted(pc, n - 1);
}

export function procStepsDone(pc: Procedure): number {
  return [1, 2, 3, 4, 5].filter((n) => procStepCompleted(pc, n)).length;
}

export function completeProcStep(def: CompanyDef, pc: Procedure, n: number, now: string): { ok: boolean; reason?: string } {
  if (n < 1 || n > 5) return { ok: false, reason: 'Paso inexistente.' };
  if (!procStepUnlocked(pc, n)) return { ok: false, reason: `Antes hay que completar el paso ${n - 1}.` };
  const open = procChecklist(def, pc, n).filter((c) => !c.done);
  if (open.length) return { ok: false, reason: `Falta: ${open[0].label}` };
  pc.done[String(n) as ProcStepKey] = { completedAt: now };
  return { ok: true };
}

/** Reabre un paso y los posteriores; el procedimiento vuelve a ser borrador. */
export function reopenProcStep(pc: Procedure, n: number) {
  for (let k = n; k <= 5; k++) delete pc.done[String(k) as ProcStepKey];
}

export function procedureStatus(pc: Procedure): 'borrador' | 'publicado' {
  return pc.approvedAt && procStepsDone(pc) === 5 ? 'publicado' : 'borrador';
}

/** Publica el procedimiento: exige los 5 pasos, sube la versión y anota el cambio. */
export function approveProcedure(pc: Procedure, today: string, description?: string): { ok: boolean; reason?: string } {
  if (procStepsDone(pc) < 5) return { ok: false, reason: 'Hay que completar los 5 pasos del levantamiento antes de publicar.' };
  const version = nextProcVersion(pc.version);
  if (pc.version && !filled(description, 5)) return { ok: false, reason: 'Describe qué cambió respecto a la versión anterior.' };
  pc.version = version;
  pc.approvedAt = today;
  pc.changes.push({ version, date: today, description: filled(description) ? description!.trim() : 'Versión inicial.' });
  return { ok: true };
}

// ---------- cobertura respecto al proceso ----------

export interface Coverage {
  stageId: string;
  label: string;
  procedures: number;
  published: number;
}

/** Para cada etapa con trabajo: cuántos procedimientos tiene y cuántos están publicados. */
export function procedureCoverage(proc: OrgProcessDef): Coverage[] {
  return reviewableStages(proc).map((s) => {
    const list = (proc.procedures ?? []).filter((p) => p.stageId === s.id);
    return { stageId: s.id, label: s.label ?? s.id, procedures: list.length, published: list.filter((p) => procedureStatus(p) === 'publicado').length };
  });
}

// ---------- documento en Markdown ----------

const cell = (s: string | undefined) => (s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim() || '—';
const text = (s: string | undefined) => (s?.trim() ? s.trim() : '_Sin definir_');
const WARN_ICON: Record<WarningKind, string> = { critico: '🛑', financiero: '💰', seguridad: '🦺', error_comun: '⚠️' };

export function procedureMarkdown(def: CompanyDef, proc: OrgProcessDef, pc: Procedure): string {
  const stage = proc.stages.find((s) => s.id === pc.stageId);
  const out: string[] = [];
  out.push(`# Procedimiento ${pc.code} — ${pc.title}`, '');
  out.push(
    `> Versión ${pc.version ?? 'borrador'}${pc.approvedAt ? ` · publicado el ${pc.approvedAt}` : ' · aún sin publicar'} · Proceso: ${proc.name ?? proc.id}${stage ? ` · Etapa: ${stage.label ?? stage.id} (${unitPath(def, stage.unit)})` : ''}`,
    '',
  );

  out.push('## 1. Objetivo y alcance', '');
  out.push(`**Objetivo:** ${text(pc.objective)}`, '');
  out.push(`**Inicia cuando:** ${text(pc.startsWhen)}`, '');
  out.push(`**Termina cuando:** ${text(pc.endsWhen)}`, '');
  if (filled(pc.includes)) out.push(`**Incluye:** ${pc.includes!.trim()}`, '');
  if (filled(pc.excludes)) out.push(`**No incluye:** ${pc.excludes!.trim()}`, '');

  out.push('## 2. Responsabilidades', '');
  if (pc.responsibilities.length === 0) out.push('_Sin responsabilidades definidas._');
  else {
    out.push('| Puesto | Responsabilidad |', '|---|---|');
    for (const r of pc.responsibilities) out.push(`| ${cell(r.role)} | ${cell(r.description)} |`);
  }
  out.push('');

  out.push('## 3. Definiciones y glosario', '');
  const gl = pc.glossary.filter((g) => filled(g.term));
  if (gl.length === 0) out.push(pc.noGlossary ? '_No hay términos que requieran explicación._' : '_Sin términos definidos._');
  else {
    out.push('| Término | Definición |', '|---|---|');
    for (const g of gl) out.push(`| ${cell(g.term)} | ${cell(g.definition)} |`);
  }
  out.push('');

  out.push('## 4. Desarrollo paso a paso', '');
  if (pc.steps.length === 0) out.push('_Sin pasos._', '');
  pc.steps.forEach((s, i) => {
    out.push(`${i + 1}. **${s.actor.trim() || '—'}** — ${s.action.trim() || '—'}${filled(s.tool) ? ` · _Herramienta:_ ${s.tool!.trim()}` : ''}${filled(s.result) ? ` · _Resultado:_ ${s.result!.trim()}` : ''}`);
    if (s.warning && filled(s.warning.text)) out.push(`   > ${WARN_ICON[s.warning.kind]} **${WARNING_LABEL[s.warning.kind]}:** ${s.warning.text.trim()}`);
    for (const a of s.alternatives) out.push(`   - Si ${a.condition.trim() || '…'}: ${a.action.trim() || '…'}`);
    if (s.image) out.push(`   - _Captura:_ ${s.image.caption?.trim() || `paso ${i + 1}`} (${s.image.marks.length} marca(s); la imagen está en la aplicación)`);
  });
  out.push('');

  out.push('## 5. Anexos y control de cambios', '');
  if (pc.annexes.length) {
    out.push('**Anexos:**', '');
    for (const a of pc.annexes) out.push(`- ${a.title}${a.url ? ` — ${a.url}` : ''} (${a.kind})`);
    out.push('');
  }
  const tricks = pc.fieldwork.flatMap((f) => f.tricks.filter((t) => filled(t)));
  if (tricks.length) {
    out.push('**Trucos operativos recogidos:**', '');
    for (const t of tricks) out.push(`- ${t.trim()}`);
    out.push('');
  }
  if (pc.changes.length === 0) out.push('_Sin historial de versiones._');
  else {
    out.push('| Versión | Fecha | Descripción del cambio |', '|---|---|---|');
    for (const c of pc.changes) out.push(`| ${c.version} | ${c.date} | ${cell(c.description)} |`);
  }
  out.push('');

  out.push('## 6. Validación', '');
  if (pc.attempts.length) {
    out.push('**Prueba del novato:**', '', '| Quién | Fecha | ¿Terminó la tarea? | Preguntas | Notas |', '|---|---|---|---|---|');
    for (const a of pc.attempts) out.push(`| ${cell(a.tester)} | ${cell(a.date)} | ${a.completed ? 'Sí' : 'No'} | ${a.questions} | ${cell(a.notes)} |`);
    out.push('');
  }
  if (pc.signoffs.length) {
    out.push('**Conformidad del ejecutor:**', '', '| Operador | Puesto | Estado | Fecha | Comentario |', '|---|---|---|---|---|');
    const label = { pendiente: 'Pendiente', conforme: 'Conforme', observado: 'Con observaciones' } as const;
    for (const s of pc.signoffs) out.push(`| ${cell(s.name)} | ${cell(s.role)} | ${label[s.status]} | ${cell(s.date)} | ${cell(s.comment)} |`);
    out.push('');
  }
  if (!pc.attempts.length && !pc.signoffs.length) out.push('_Sin validar._', '');

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
