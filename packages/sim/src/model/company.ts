import type { DecorItem } from './decor';
import type { CustomFacility } from './facility';
import type { OrgProcessDef } from './process';

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
