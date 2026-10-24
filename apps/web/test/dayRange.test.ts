import { describe, expect, it } from 'vitest';
import { dayRange } from '../src/application/dayRange';
import { emptyCompany } from '../src/application/editing/model';

describe('tramo del día que muestra la barra de una persona', () => {
  it('jornada normal: una hora antes y una hora después', () => {
    const d = emptyCompany(); // 09:00–18:00
    expect(dayRange(d)).toEqual({ from: 8 * 60, to: 19 * 60 });
  });

  it('un horario nocturno o de madrugada también cabe', () => {
    const d = emptyCompany();
    d.schedules = { noche: { hours: { start: '14:00', end: '23:30' } }, alba: { hours: { start: '05:00', end: '13:00' } } };
    expect(dayRange(d)).toEqual({ from: 4 * 60, to: 24 * 60 });
  });

  it('con una jornada cortísima siempre muestra al menos 4 horas', () => {
    const d = emptyCompany();
    d.calendar.hours = { start: '10:00', end: '11:00' };
    const r = dayRange(d);
    expect(r.to - r.from).toBeGreaterThanOrEqual(4 * 60);
    expect(r.from).toBeLessThanOrEqual(10 * 60);
  });
});
