import type { ArrivalsDef, DistSpec, ExceptionDef, NextRule } from '../types';
import type { DecorItem } from './decor';

export interface BlockDef {
  start: string; // "HH:MM"
  end: string;
}

export interface CalendarDef {
  /** 0 = lunes … 6 = domingo */
  workDays: number[];
  hours: { start: string; end: string };
  breaks?: BlockDef[];
  /** probabilidad base de ausencia por persona y día */
  absenteeism?: number;
}

export interface ScheduleDef {
  hours: { start: string; end: string };
  breaks?: BlockDef[];
}

export interface MeetingDef {
  id: string;
  unit: string;
  start: string;
  minutes: number;
  days?: number[];
}

/**
 * Planta (la empresa) → áreas → subáreas. Los nodos de primer nivel son áreas; sus hijos, subáreas.
 * Cada unidad tiene su propio nombre y las personas se asignan a ella como responsables o colaboradores.
 */
export type Facility = 'oficina' | 'bodega' | 'ingreso' | 'despacho' | 'seguridad' | 'mantenimiento' | 'transporte';

export interface FacilityInfo {
  label: string;
  icon: string;
  /** frase corta (se muestra al elegir el tipo) */
  hint: string;
  /** para qué sirve y cuándo usarla */
  description: string;
  /** qué se dibuja en la sala */
  equipment: string[];
  /** puestos típicos de quienes trabajan ahí */
  roles: string[];
  /** procesos que suelen pasar por esta instalación */
  processes: string[];
  /** nombre sugerido al crear un área de este tipo */
  defaultName: string;
}

/** Espacio de dibujo de una ilustración propia: cada elemento usa coordenadas de 0 a ART_W y de 0 a ART_H. */
export const ART_W = 240;
export const ART_H = 80;

/** Un elemento de una ilustración propia. */
export type ArtItem =
  | { t: 'rect'; x: number; y: number; w: number; h: number; c: string; r?: number }
  | { t: 'ellipse'; x: number; y: number; w: number; h: number; c: string }
  | { t: 'tri'; x: number; y: number; w: number; h: number; c: string }
  | { t: 'line'; x: number; y: number; x2: number; y2: number; c: string; lw: number }
  /** un icono o emoji; (x, y) es su esquina superior izquierda y s su tamaño */
  | { t: 'emoji'; x: number; y: number; s: number; ch: string };

/** Ilustración propia de un tipo de instalación: elementos dibujados a mano o una imagen subida. */
export interface FacilityArt {
  items?: ArtItem[];
  /** imagen (data URL) en lugar de elementos */
  image?: string;
}

/**
 * Tipo de instalación creado por el usuario. Se dibuja con el aspecto (`look`) de uno de los tipos
 * incluidos, pero con su propio nombre e icono.
 */
export interface CustomFacility {
  id: string;
  label: string;
  icon: string;
  description?: string;
  /** tipo incluido cuyo dibujo usa en el plano cuando no tiene ilustración propia */
  look: Facility;
  /** ilustración propia, totalmente distinta de los 7 dibujos incluidos */
  art?: FacilityArt;
}

/** Catálogo de instalaciones que una sala puede representar; solo cambian cómo se ve, no la simulación. */
export const FACILITIES: Record<Facility, FacilityInfo> = {
  oficina: {
    label: 'Oficina',
    icon: '🖥',
    hint: 'Escritorios y computadores (por defecto)',
    description: 'Trabajo administrativo o de escritorio: ventas, finanzas, atención, planificación, dirección.',
    equipment: ['Escritorios con computador', 'Sillas', 'Bandeja de entrada de casos'],
    roles: ['gerente', 'analista', 'vendedor', 'facturador', 'agente'],
    processes: ['Venta y facturación', 'Compras', 'Atención de reclamos'],
    defaultName: 'Nueva oficina',
  },
  bodega: {
    label: 'Bodega / almacén',
    icon: '📦',
    hint: 'Estanterías con mercadería',
    description: 'Donde se guarda y se prepara la mercadería: almacenamiento, picking, inventarios, cadena de frío.',
    equipment: ['Estanterías con cajas', 'Bandeja de entrada de casos'],
    roles: ['bodeguero', 'preparador', 'auditor_inventario', 'jefe_almacen'],
    processes: ['Ubicación de productos', 'Picking y preparación de pedidos', 'Toma de inventario'],
    defaultName: 'Nueva bodega',
  },
  ingreso: {
    label: 'Ingreso de productos',
    icon: '🚚',
    hint: 'Muelle de recepción con camión y pallets',
    description: 'Recepción de mercadería de proveedores: descarga, conteo e inspección de calidad antes de guardarla.',
    equipment: ['Camión en el muelle', 'Pallets con cajas', 'Franja de seguridad', 'Luz de aviso'],
    roles: ['recibidor', 'estibador', 'inspector', 'jefe_recepcion'],
    processes: ['Ingreso de productos', 'Control de calidad', 'Devolución a proveedores'],
    defaultName: 'Recepción de mercadería',
  },
  despacho: {
    label: 'Despacho',
    icon: '📤',
    hint: 'Muelle de salida con pedidos listos',
    description: 'Salida de pedidos: empaque, etiquetado y carga a los vehículos de reparto.',
    equipment: ['Puerta de muelle', 'Pallets de pedidos listos', 'Franja de seguridad', 'Luz de aviso'],
    roles: ['despachador', 'empacador', 'jefe_despacho'],
    processes: ['Despacho de pedidos', 'Empaque y etiquetado', 'Carga de rutas'],
    defaultName: 'Despacho',
  },
  seguridad: {
    label: 'Seguridad',
    icon: '🛡',
    hint: 'Garita, cámaras y control de acceso',
    description: 'Control de accesos y vigilancia: garita, visitas, rondas, monitoreo de cámaras y atención de alertas.',
    equipment: ['Pared de cámaras con luz REC', 'Torniquete de acceso'],
    roles: ['guardia', 'operador_cctv', 'supervisor_ronda', 'jefe_seguridad'],
    processes: ['Control de acceso', 'Alerta de seguridad', 'Rondas e incidentes'],
    defaultName: 'Seguridad',
  },
  mantenimiento: {
    label: 'Mantenimiento',
    icon: '🔧',
    hint: 'Taller con banco de trabajo y herramientas',
    description: 'Reparación y cuidado de equipos e instalaciones: mecánico, eléctrico, infraestructura y limpieza.',
    equipment: ['Banco de trabajo', 'Caja de herramientas', 'Tablero de herramientas', 'Luz de trabajo'],
    roles: ['técnico', 'mecánico', 'electricista', 'operario_mantenimiento', 'jefe_mantenimiento'],
    processes: ['Orden de mantenimiento correctivo', 'Mantenimiento preventivo', 'Reparación de equipos'],
    defaultName: 'Mantenimiento',
  },
  transporte: {
    label: 'Transporte y flota',
    icon: '🚛',
    hint: 'Vehículos de reparto',
    description: 'Reparto y gestión de la flota: planificación de rutas, conductores y entrega al cliente.',
    equipment: ['Vehículos de reparto', 'Franja de seguridad'],
    roles: ['conductor', 'coordinador_flota', 'planificador_rutas', 'repartidor'],
    processes: ['Planificación de rutas', 'Entrega al cliente', 'Mantenimiento de vehículos'],
    defaultName: 'Transporte y flota',
  },
};

export interface UnitDef {
  id: string;
  name?: string;
  /** qué instalación es (por defecto, oficina); define su aspecto en el plano */
  facility?: string;
  /** objetos (mesas, sillas, puertas, plantas…) colocados en la sala de esta unidad */
  decor?: DecorItem[];
  /** @deprecated formato antiguo: al leer un YAML se convierte en `kind: responsable` de esa persona */
  head?: string;
  children?: UnitDef[];
}

export type PersonKind = 'responsable' | 'colaborador';

export interface PersonDef {
  id: string;
  name?: string;
  unit: string;
  /** responsable o colaborador de su área/subárea (por defecto, colaborador) */
  kind?: PersonKind;
  role: string;
  skills?: string[];
  reportsTo?: string;
  /** 1.0 = velocidad nominal; 1.2 = 20 % más rápido */
  speed?: number;
  /** probabilidad de rehacer el trabajo al terminar una tarea */
  errorRate?: number;
  absenteeism?: number;
  schedule?: string;
}

export interface OrgStageDef {
  id: string;
  label?: string;
  /** unidad (o ancestro de la unidad) donde está quien ejecuta la etapa */
  unit?: string;
  role?: string;
  skill?: string;
  /** minutos de trabajo a velocidad 1.0 */
  duration?: DistSpec;
  /** SLA en minutos hábiles desde que el caso entra a la etapa */
  sla?: { maxMinutes: number };
  exceptions?: ExceptionDef[];
  next?: string | NextRule[];
  terminal?: boolean;
  /** la hace un sistema, sin personas (capacidad ilimitada); `unit` solo indica dónde se muestra */
  automated?: boolean;
}

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

/**
 * Dependencia entre procesos (la declara el proceso que depende).
 * - dispara: cuando el proceso de origen termina `atStage` (o completa un caso, si no se indica),
 *   se crea un caso en este proceso con la `probability` indicada. Se simula.
 * - requiere: este proceso necesita el resultado del otro, pero no se crea nada: es informativa.
 */
export type DependencyKind = 'dispara' | 'requiere';

export interface ProcessDependency {
  /** proceso del que depende */
  process: string;
  kind: DependencyKind;
  /** etapa del proceso de origen; si falta, el momento en que se completa el caso */
  atStage?: string;
  /** solo "dispara": probabilidad de que cada caso del origen genere uno aquí (por defecto 1) */
  probability?: number;
  note?: string;
}

export interface OrgProcessDef {
  id: string;
  name?: string;
  arrivals: ArrivalsDef;
  attributes?: Record<string, DistSpec>;
  stages: OrgStageDef[];
  /** procesos de los que depende (en el mapa y, si "dispara", también en la simulación) */
  dependsOn?: ProcessDependency[];
  /** ficha y ciclo de documentación del proceso */
  doc?: ProcessDoc;
  /** optimización en 5 pasos */
  optimization?: Optimization;
  /** procedimientos que detallan cómo se ejecutan sus etapas */
  procedures?: Procedure[];
}

/** Actor que aparece en los eventos de trabajo de una etapa automatizada. */
export const AUTO_ACTOR = '@auto';

export interface CompanyDef {
  company: string;
  calendar: CalendarDef;
  /** minutos de traslado entre unidades */
  travel?: { sameTeam?: number; sameArea?: number; crossArea?: number };
  schedules?: Record<string, ScheduleDef>;
  meetings?: MeetingDef[];
  /** tipos de instalación propios de esta empresa, además de los incluidos */
  facilityTypes?: CustomFacility[];
  units: UnitDef[];
  people: PersonDef[];
  processes: OrgProcessDef[];
  scenario?: { absences?: Array<{ person: string; days: number[] }> };
}

export type PersonState = 'off' | 'idle' | 'working' | 'break' | 'meeting' | 'absent';

export type OrgEvent =
  | { t: number; type: 'case.created'; caseId: string; process: string; attrs: Record<string, number>; cause?: string }
  | { t: number; type: 'stage.entered'; caseId: string; process: string; stage: string }
  | { t: number; type: 'handoff.started'; caseId: string; fromUnit: string; toUnit: string; minutes: number }
  | { t: number; type: 'work.started'; caseId: string; stage: string; person: string }
  | { t: number; type: 'work.paused'; caseId: string; person: string }
  | { t: number; type: 'work.resumed'; caseId: string; person: string }
  | { t: number; type: 'work.finished'; caseId: string; stage: string; person: string }
  | { t: number; type: 'exception'; caseId: string; stage: string; exceptionId: string; target: string }
  | { t: number; type: 'sla.breached'; caseId: string; stage: string }
  | { t: number; type: 'case.completed'; caseId: string; stage: string }
  | { t: number; type: 'person.state'; person: string; state: PersonState; caseId?: string };

export interface OrgMetrics {
  horizonDays: number;
  created: number;
  completed: number;
  inFlight: number;
  /** tiempos en minutos hábiles */
  byProcess: Record<string, { created: number; completed: number; cycleAvg: number; cycleP90: number; slaBreaches: number }>;
  byStage: Record<string, { waitAvg: number; started: number; queueAtEnd: number }>;
  byPerson: Record<string, { utilization: number; workedMinutes: number; tasks: number }>;
  byUnit: Record<string, { headcount: number; utilization: number; tasks: number }>;
}

export interface OrgSimOptions {
  seed: number;
  horizonDays: number;
  /**
   * Modo «cómo funciona»: tope de casos propios que llegan por día hábil a cada proceso, para poder seguir
   * el flujo sin que todo pase de golpe. Si no se indica, llegan con la frecuencia configurada.
   */
  arrivalsPerDay?: number;
}

export interface OrgSimResult {
  options: OrgSimOptions;
  events: OrgEvent[];
  metrics: OrgMetrics;
}
