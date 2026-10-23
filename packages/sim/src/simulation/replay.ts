import type { OrgEvent, PersonState } from '../model';

export type OrgCaseStatus = 'queued' | 'working' | 'paused' | 'transit' | 'done';

export interface OrgCaseView {
  id: string;
  process: string;
  stage: string;
  status: OrgCaseStatus;
  person?: string;
  /** unidad de destino mientras el caso viaja entre áreas */
  toUnit?: string;
  enteredAt: number;
  createdAt: number;
  breached: boolean;
  attrs: Record<string, number>;
}

export interface PersonView {
  state: PersonState;
  caseId?: string;
}

export interface OrgCounters {
  created: number;
  completed: number;
  breaches: number;
  exceptions: number;
  handoffs: number;
}

/** Reproduce el log de la empresa hasta un instante t; retroceder reinicia y reaplica. */
export class OrgReplayer {
  t = 0;
  cases = new Map<string, OrgCaseView>();
  persons = new Map<string, PersonView>();
  counters: OrgCounters = { created: 0, completed: 0, breaches: 0, exceptions: 0, handoffs: 0 };
  private i = 0;

  constructor(
    private readonly events: OrgEvent[],
    private readonly personIds: string[],
  ) {
    this.reset();
  }

  reset() {
    this.t = 0;
    this.i = 0;
    this.cases.clear();
    this.persons.clear();
    for (const id of this.personIds) this.persons.set(id, { state: 'off' });
    this.counters = { created: 0, completed: 0, breaches: 0, exceptions: 0, handoffs: 0 };
  }

  /**
   * Instante del siguiente evento que aún no se ha aplicado. Con `meaningful` se ignoran los cambios de estado
   * de las personas (entrar, salir, descansar) y solo cuentan los que mueven un caso. Con `after` solo cuentan
   * los posteriores a ese instante (útil si se pidió avanzar y el reproductor aún no se ha puesto al día).
   */
  nextEventTime(meaningful = false, after = -Infinity): number | undefined {
    for (let k = this.i; k < this.events.length; k++) {
      if (this.events[k].t <= after) continue;
      if (!meaningful || this.events[k].type !== 'person.state') return this.events[k].t;
    }
    return undefined;
  }

  /** ¿Hay algún caso en marcha (trabajándose o viajando)? Uno pausado hasta mañana no cuenta. */
  get busy(): boolean {
    for (const c of this.cases.values()) if (c.status === 'working' || c.status === 'transit') return true;
    return false;
  }

  advanceTo(t: number): OrgEvent[] {
    if (t < this.t) {
      this.reset();
      this.applyUntil(t);
      return [];
    }
    return this.applyUntil(t);
  }

  private applyUntil(t: number): OrgEvent[] {
    const applied: OrgEvent[] = [];
    while (this.i < this.events.length && this.events[this.i].t <= t) {
      const ev = this.events[this.i++];
      this.apply(ev);
      applied.push(ev);
    }
    this.t = t;
    return applied;
  }

  private apply(ev: OrgEvent) {
    switch (ev.type) {
      case 'case.created':
        this.counters.created++;
        this.cases.set(ev.caseId, {
          id: ev.caseId,
          process: ev.process,
          stage: '',
          status: 'queued',
          enteredAt: ev.t,
          createdAt: ev.t,
          breached: false,
          attrs: ev.attrs,
        });
        break;
      case 'stage.entered': {
        const c = this.cases.get(ev.caseId)!;
        c.stage = ev.stage;
        c.status = 'queued';
        c.person = undefined;
        c.toUnit = undefined;
        c.enteredAt = ev.t;
        c.breached = false;
        break;
      }
      case 'handoff.started':
        this.counters.handoffs++;
        this.cases.get(ev.caseId)!.status = 'transit';
        this.cases.get(ev.caseId)!.toUnit = ev.toUnit;
        break;
      case 'work.started': {
        const c = this.cases.get(ev.caseId)!;
        c.status = 'working';
        c.person = ev.person;
        break;
      }
      case 'work.paused':
        this.cases.get(ev.caseId)!.status = 'paused';
        break;
      case 'work.resumed':
        this.cases.get(ev.caseId)!.status = 'working';
        break;
      case 'work.finished':
        break;
      case 'exception':
        this.counters.exceptions++;
        this.cases.get(ev.caseId)!.status = 'transit';
        break;
      case 'sla.breached':
        this.counters.breaches++;
        this.cases.get(ev.caseId)!.breached = true;
        break;
      case 'case.completed': {
        this.counters.completed++;
        const c = this.cases.get(ev.caseId)!;
        c.status = 'done';
        c.person = undefined;
        break;
      }
      case 'person.state':
        this.persons.set(ev.person, { state: ev.state, caseId: ev.caseId });
        break;
    }
  }
}
