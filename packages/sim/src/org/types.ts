import type { ArrivalsDef, DistSpec, ExceptionDef, NextRule } from '../types';

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
export interface UnitDef {
  id: string;
  name?: string;
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
}

export interface OrgProcessDef {
  id: string;
  name?: string;
  arrivals: ArrivalsDef;
  attributes?: Record<string, DistSpec>;
  stages: OrgStageDef[];
}

export interface CompanyDef {
  company: string;
  calendar: CalendarDef;
  /** minutos de traslado entre unidades */
  travel?: { sameTeam?: number; sameArea?: number; crossArea?: number };
  schedules?: Record<string, ScheduleDef>;
  meetings?: MeetingDef[];
  units: UnitDef[];
  people: PersonDef[];
  processes: OrgProcessDef[];
  scenario?: { absences?: Array<{ person: string; days: number[] }> };
}

export type PersonState = 'off' | 'idle' | 'working' | 'break' | 'meeting' | 'absent';

export type OrgEvent =
  | { t: number; type: 'case.created'; caseId: string; process: string; attrs: Record<string, number> }
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
}

export interface OrgSimResult {
  options: OrgSimOptions;
  events: OrgEvent[];
  metrics: OrgMetrics;
}
