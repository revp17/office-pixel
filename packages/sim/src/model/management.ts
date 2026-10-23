import type { OrgProcessDef } from './process';

// ---------- gestión del proceso: documentación (5 fases) y optimización (5 pasos) ----------

/** Fases del ciclo de documentación, en orden. */
export type PhaseKey = 'alcance' | 'campo' | 'asis' | 'validacion' | 'ficha';

export interface Stakeholder {
  id: string;
  name: string;
  role?: string;
  /** persona de la empresa, si es una */
  personId?: string;
}

export type FieldType = 'entrevista' | 'observacion' | 'documento' | 'datos';

/** Un registro del trabajo de campo (entrevista, observación, documento o dato recogido). */
export interface FieldRecord {
  id: string;
  type: FieldType;
  date?: string;
  source?: string;
  notes?: string;
  findings?: string;
}

export type ValidationStatus = 'pendiente' | 'aprobado' | 'observado';

export interface Validation {
  stakeholderId: string;
  status: ValidationStatus;
  comment?: string;
  date?: string;
}

/** Medidas del proceso As-Is, tomadas con el simulador (promedio de varias semillas). */
export interface Baseline {
  capturedAt: string;
  seeds: number[];
  days: number;
  stages: number;
  completed: number;
  cycleAvg: number;
  cycleP90: number;
  slaBreaches: number;
  waitPerCase: number;
}

export interface ProcessDoc {
  scope: {
    objective?: string;
    inScope?: string;
    outOfScope?: string;
    /** persona dueña del proceso */
    owner?: string;
    successCriteria?: string;
    inputs?: string;
    outputs?: string;
    startDate?: string;
    endDate?: string;
    stakeholders: Stakeholder[];
  };
  fieldwork: FieldRecord[];
  baseline?: Baseline;
  validations: Validation[];
  /** fases dadas por completadas */
  phases: Partial<Record<PhaseKey, { completedAt: string }>>;
  version?: string;
  approvedAt?: string;
}

export type StepKey = '1' | '2' | '3' | '4' | '5';

/** Paso 1: cuestionar cada requerimiento (etapa). */
export interface ReqReview {
  /** una persona concreta, no un departamento */
  requestedBy?: string;
  reason?: string;
  needed?: 'si' | 'no' | 'duda';
  simplified?: string;
}

/**
 * Optimización en 5 pasos, en este orden estricto:
 * 1 requerimiento menos tonto · 2 eliminar · 3 simplificar el diseño · 4 acelerar el ciclo · 5 automatizar.
 * Siempre parte del As-Is (las etapas del proceso) y se calcula una variante To-Be por paso.
 */
export interface Optimization {
  reqReview: Record<string, ReqReview>;
  eliminated: string[];
  eliminationNotes?: string;
  /** copia de trabajo del paso 3 (As-Is sin lo eliminado, ya rediseñada); se crea al cerrar el paso 2 */
  design?: OrgProcessDef;
  designNotes?: string;
  /** etapa → factor de duración (0,1–1); solo desde el paso 4 */
  speed: Record<string, number>;
  speedNotes?: string;
  /** etapa → factor de duración al automatizarla; solo desde el paso 5 */
  auto: Record<string, number>;
  autoNotes?: string;
  steps: Partial<Record<StepKey, { completedAt: string }>>;
}

// ---------- procedimientos (visión micro: el cómo, quién y cuándo de una tarea) ----------

export type ProcMethod = 'en_vivo' | 'entrevista';

/** Un caso especial que el operador cuenta («¿qué haces si el cliente no envía este dato?»). */
export interface ProcException {
  id: string;
  text: string;
}

/** Levantamiento con un operador directo: observación en vivo o entrevista, tarea a tarea. */
export interface ProcFieldRecord {
  id: string;
  operator: string;
  method: ProcMethod;
  date?: string;
  notes?: string;
  exceptions: ProcException[];
  /** conocimiento informal que usan para resolver rápido y no está en ningún manual */
  tricks: string[];
}

export interface ProcResponsibility {
  /** un puesto, no un nombre propio */
  role: string;
  description?: string;
}

export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface Annex {
  id: string;
  title: string;
  kind: 'plantilla' | 'formato' | 'captura' | 'enlace' | 'otro';
  url?: string;
}

export type WarningKind = 'critico' | 'financiero' | 'seguridad' | 'error_comun';

/** Camino alternativo de un paso: «si… entonces…». */
export interface StepAlt {
  id: string;
  condition: string;
  action: string;
  /** excepción del levantamiento que cubre */
  exceptionId?: string;
}

/** Marca sobre una captura; coordenadas como fracción (0–1) de la imagen. */
export interface ImageMark {
  kind: 'circle' | 'arrow' | 'num';
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  n?: number;
}

export interface StepImage {
  src: string;
  caption?: string;
  marks: ImageMark[];
}

/** Un paso: [Actor] + [Acción] + [Herramienta o medio] + [Resultado esperado]. */
export interface ProcStep {
  id: string;
  /** puesto que lo ejecuta */
  actor: string;
  /** empieza con un verbo de acción; una sola acción */
  action: string;
  tool?: string;
  result?: string;
  warning?: { kind: WarningKind; text: string };
  alternatives: StepAlt[];
  image?: StepImage;
}

/** Prueba del novato: alguien que no hace la tarea sigue el borrador. */
export interface NoviceAttempt {
  id: string;
  tester: string;
  date?: string;
  completed: boolean;
  /** preguntas que tuvo que hacer */
  questions: number;
  notes?: string;
}

export type SignStatus = 'pendiente' | 'conforme' | 'observado';

/** Firma de conformidad del operador que dio la información. */
export interface Signoff {
  id: string;
  name: string;
  role?: string;
  status: SignStatus;
  date?: string;
  comment?: string;
}

export interface ChangeEntry {
  version: string;
  date: string;
  description: string;
}

export type ProcStepKey = '1' | '2' | '3' | '4' | '5';

export interface Procedure {
  id: string;
  code: string;
  title: string;
  /** etapa del proceso que detalla */
  stageId?: string;
  /** ids de los procedimientos que deben estar hechos o disponibles antes de este (de cualquier proceso) */
  prerequisites?: string[];
  /** si es digital hacen falta capturas de pantalla anotadas */
  digital: boolean;
  // paso 1
  fieldwork: ProcFieldRecord[];
  noTricks?: boolean;
  // paso 2: los 5 bloques
  objective?: string;
  startsWhen?: string;
  endsWhen?: string;
  includes?: string;
  excludes?: string;
  responsibilities: ProcResponsibility[];
  glossary: GlossaryTerm[];
  noGlossary?: boolean;
  annexes: Annex[];
  // paso 3 y 4
  steps: ProcStep[];
  noWarnings?: boolean;
  // paso 5
  attempts: NoviceAttempt[];
  signoffs: Signoff[];
  // control de cambios
  changes: ChangeEntry[];
  version?: string;
  approvedAt?: string;
  /** pasos de levantamiento completados */
  done: Partial<Record<ProcStepKey, { completedAt: string }>>;
}
