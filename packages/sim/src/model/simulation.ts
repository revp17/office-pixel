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
