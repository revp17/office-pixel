import type { DistSpec } from '../kernel/dist';
import type { ArrivalsDef, ExceptionDef, NextRule } from '../model';

export interface ResourceDef {
  id: string;
  count: number;
  kind?: string;
  skills?: string[];
  shift?: string;
}



export interface StageDef {
  id: string;
  label?: string;
  resource?: string;
  duration?: DistSpec;
  wip?: { limit: number };
  sla?: { maxMinutes: number; onBreach?: string };
  exceptions?: ExceptionDef[];
  next?: string | NextRule[];
  terminal?: boolean;
}


export interface ProcessDef {
  process: string;
  version?: number;
  arrivals: ArrivalsDef;
  attributes?: Record<string, DistSpec>;
  resources?: ResourceDef[];
  stages: StageDef[];
  metrics?: string[];
}

export type SimEvent =
  | { t: number; type: 'case.created'; caseId: string; attrs: Record<string, number> }
  | { t: number; type: 'stage.entered'; caseId: string; stage: string }
  | { t: number; type: 'work.started'; caseId: string; stage: string; resource?: string }
  | { t: number; type: 'work.finished'; caseId: string; stage: string; resource?: string }
  | { t: number; type: 'exception'; caseId: string; stage: string; exceptionId: string; target: string }
  | { t: number; type: 'sla.breached'; caseId: string; stage: string }
  | { t: number; type: 'case.completed'; caseId: string; stage: string };

export interface Metrics {
  horizonMinutes: number;
  created: number;
  completed: number;
  inFlight: number;
  throughputPerHour: number;
  cycleTimeAvg: number;
  cycleTimeP90: number;
  slaBreaches: number;
  exceptions: Record<string, number>;
  waitByStage: Record<string, { avg: number; count: number }>;
  utilization: Record<string, number>;
}

export interface SimOptions {
  seed: number;
  horizonMinutes: number;
}

export interface SimResult {
  options: SimOptions;
  events: SimEvent[];
  metrics: Metrics;
}
