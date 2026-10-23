import type { DistSpec } from '../kernel/dist';
import type { Optimization, ProcessDoc, Procedure } from './management';

export interface ExceptionDef {
  id: string;
  probability: number;
  action: 'goto';
  target: string;
  penaltyMinutes?: number;
}

export interface NextRule {
  when?: string;
  otherwise?: boolean;
  to: string;
}

export type ArrivalsDef =
  | { type: 'poisson'; ratePerHour: number; calendar?: string }
  | { type: 'constant'; everyMinutes: number; calendar?: string };

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
  /** solo "dispara": etapa de ESTE proceso por la que entra el caso nuevo (por defecto, la primera) */
  toStage?: string;
  /** solo "dispara": el caso nuevo hereda los datos (atributos) del caso de origen */
  inherit?: boolean;
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
