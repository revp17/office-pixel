import type { SimEvent } from './types';

export type CaseStatus = 'waiting' | 'working' | 'delayed' | 'done';

export interface CaseView {
  id: string;
  attrs: Record<string, number>;
  createdAt: number;
  stage: string;
  status: CaseStatus;
  enteredAt: number;
  breached: boolean;
}

export interface Counters {
  created: number;
  completed: number;
  breaches: number;
  exceptions: number;
}

/**
 * Reproduce el log de eventos hasta un instante t. El render solo lee este estado:
 * el motor no sabe nada de Phaser. Avanzar es incremental; retroceder reinicia y reaplica.
 */
export class Replayer {
  t = 0;
  cases = new Map<string, CaseView>();
  counters: Counters = { created: 0, completed: 0, breaches: 0, exceptions: 0 };
  private i = 0;

  constructor(private readonly events: SimEvent[]) {}

  reset() {
    this.t = 0;
    this.i = 0;
    this.cases.clear();
    this.counters = { created: 0, completed: 0, breaches: 0, exceptions: 0 };
  }

  /** Devuelve los eventos aplicados en esta llamada (vacío si se retrocedió). */
  advanceTo(t: number): SimEvent[] {
    if (t < this.t) {
      this.reset();
      this.applyUntil(t);
      return [];
    }
    return this.applyUntil(t);
  }

  private applyUntil(t: number): SimEvent[] {
    const applied: SimEvent[] = [];
    while (this.i < this.events.length && this.events[this.i].t <= t) {
      const ev = this.events[this.i++];
      this.apply(ev);
      applied.push(ev);
    }
    this.t = t;
    return applied;
  }

  private apply(ev: SimEvent) {
    switch (ev.type) {
      case 'case.created':
        this.counters.created++;
        this.cases.set(ev.caseId, {
          id: ev.caseId,
          attrs: ev.attrs,
          createdAt: ev.t,
          stage: '',
          status: 'waiting',
          enteredAt: ev.t,
          breached: false,
        });
        break;
      case 'stage.entered': {
        const c = this.cases.get(ev.caseId)!;
        c.stage = ev.stage;
        c.status = 'waiting';
        c.enteredAt = ev.t;
        c.breached = false;
        break;
      }
      case 'work.started':
        this.cases.get(ev.caseId)!.status = 'working';
        break;
      case 'exception':
        this.counters.exceptions++;
        this.cases.get(ev.caseId)!.status = 'delayed';
        break;
      case 'sla.breached':
        this.counters.breaches++;
        this.cases.get(ev.caseId)!.breached = true;
        break;
      case 'case.completed':
        this.counters.completed++;
        this.cases.get(ev.caseId)!.status = 'done';
        break;
      case 'work.finished':
        break;
    }
  }
}
