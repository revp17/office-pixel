import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OrgReplayer, parseCompany, simulateCompany, type CompanyDef } from '../src';

const base = (): CompanyDef => parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;
const created = (d: CompanyDef, arrivalsPerDay?: number, days = 4) =>
  simulateCompany(d, { seed: 2, horizonDays: days, ...(arrivalsPerDay ? { arrivalsPerDay } : {}) }).events.filter((e) => e.type === 'case.created');

describe('modo «cómo funciona»: casos de muestra', () => {
  it('sin tope se comporta como siempre', () => {
    const a = simulateCompany(base(), { seed: 2, horizonDays: 3 });
    const b = simulateCompany(base(), { seed: 2, horizonDays: 3, arrivalsPerDay: undefined });
    expect(a.events).toEqual(b.events);
  });

  it('con tope llegan muchos menos casos y cada proceso recibe como mucho unos pocos por día', () => {
    const full = created(base()).length;
    const sample = created(base(), 4);
    expect(sample.length).toBeLessThan(full / 3);
    expect(sample.length).toBeGreaterThan(0);
    for (const p of base().processes) {
      const n = sample.filter((e) => e.type === 'case.created' && e.process === p.id).length;
      // 4 días hábiles × 4 casos por día de media; el azar permite cierta holgura
      expect(n, p.id).toBeLessThan(4 * 4 * 2);
    }
  });

  it('un proceso con pocas llegadas no se infla: el tope solo reduce', () => {
    const d = base();
    for (const p of d.processes) p.arrivals = { type: 'poisson', ratePerHour: 0.2 };
    const free = created(d, undefined, 10).filter((e) => e.type === 'case.created' && e.process === d.processes[0].id).length;
    const capped = created(d, 50, 10).filter((e) => e.type === 'case.created' && e.process === d.processes[0].id).length;
    expect(capped).toBe(free);
  });

  it('las llegadas regulares también se espacian', () => {
    const d = base();
    d.processes[0].arrivals = { type: 'constant', everyMinutes: 5 };
    const free = created(d, undefined, 2).filter((e) => e.type === 'case.created' && e.process === d.processes[0].id).length;
    const capped = created(d, 4, 2).filter((e) => e.type === 'case.created' && e.process === d.processes[0].id).length;
    expect(capped).toBeLessThan(free / 10);
    expect(capped).toBeGreaterThanOrEqual(6); // ~4 por día × 2 días
  });

  it('es determinista con la misma semilla', () => {
    const a = simulateCompany(base(), { seed: 7, horizonDays: 2, arrivalsPerDay: 3 });
    const b = simulateCompany(base(), { seed: 7, horizonDays: 2, arrivalsPerDay: 3 });
    expect(a.events).toEqual(b.events);
  });
});

describe('reproductor: siguiente hecho y tiempos muertos', () => {
  const run = () => {
    const d = base();
    const r = simulateCompany(d, { seed: 3, horizonDays: 2, arrivalsPerDay: 4 });
    return { rp: new OrgReplayer(r.events, d.people.map((p) => p.id)), events: r.events };
  };

  it('nextEventTime da el siguiente evento sin aplicarlo, y con «meaningful» ignora a las personas', () => {
    const { rp, events } = run();
    expect(rp.nextEventTime()).toBe(events[0].t);
    const firstCase = events.find((e) => e.type !== 'person.state')!;
    expect(rp.nextEventTime(true)).toBe(firstCase.t);
    expect(rp.nextEventTime(true)!).toBeGreaterThanOrEqual(rp.nextEventTime()!);
    rp.advanceTo(firstCase.t);
    expect(rp.nextEventTime(true)!).toBeGreaterThanOrEqual(firstCase.t);
    // con `after` se salta lo que ya se pidió, aunque el reproductor no se haya puesto al día
    const second = rp.nextEventTime(true, firstCase.t)!;
    expect(second).toBeGreaterThan(firstCase.t);
    rp.advanceTo(1e9);
    expect(rp.nextEventTime()).toBeUndefined();
  });

  it('recorrer solo los hechos con sentido pasa por todos los casos', () => {
    const { rp, events } = run();
    let steps = 0;
    while (rp.nextEventTime(true) !== undefined && steps < 10_000) {
      rp.advanceTo(rp.nextEventTime(true)!);
      steps++;
    }
    expect(steps).toBeGreaterThan(5);
    const meaningful = new Set(events.filter((e) => e.type !== 'person.state').map((e) => e.t));
    expect(steps).toBeLessThanOrEqual(meaningful.size);
    expect(rp.counters.created).toBe(events.filter((e) => e.type === 'case.created').length);
  });

  it('«busy» es cierto mientras alguien trabaja un caso y falso en las esperas', () => {
    const { rp, events } = run();
    expect(rp.busy).toBe(false);
    const start = events.find((e) => e.type === 'work.started')!;
    rp.advanceTo(start.t);
    expect(rp.busy).toBe(true);
    const end = events.find((e) => e.type === 'work.finished' && e.t >= start.t)!;
    rp.advanceTo(end.t);
    // puede haber otro caso trabajándose a la vez; al final de todo no debe quedar nada en marcha
    rp.advanceTo(1e9);
    expect(rp.busy).toBe(false);
  });
});
