import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCompany, validateCompany, type CompanyDef } from '../src';

const banco = parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;
const errorsOf = (fn: (d: CompanyDef) => void) => {
  const d = structuredClone(banco);
  fn(d);
  return validateCompany(d).errors;
};

describe('validación de los datos de la empresa (en el lenguaje del formulario)', () => {
  it('la empresa de ejemplo es válida', () => {
    expect(validateCompany(banco).errors).toEqual([]);
  });

  it('un nombre vacío o de solo espacios no vale', () => {
    expect(errorsOf((d) => (d.company = ''))).toEqual(['Nombre de la empresa: escribe un nombre.']);
    expect(errorsOf((d) => (d.company = '   '))).toEqual(['Nombre de la empresa: escribe un nombre.']);
  });

  it('sin días laborables, con la jornada al revés o con una pausa mal puesta, dice qué campo es', () => {
    expect(errorsOf((d) => (d.calendar.workDays = []))[0]).toMatch(/^Días laborables: elige al menos un día/);
    expect(errorsOf((d) => (d.calendar.hours = { start: '18:00', end: '09:00' }))).toEqual(['Jornada de trabajo: la salida debe ser posterior a la entrada.']);
    expect(errorsOf((d) => (d.calendar.hours = { start: '9', end: '17:00' }))).toEqual(['Jornada de trabajo: usa el formato de hora HH:MM.']);
    expect(errorsOf((d) => (d.calendar.breaks = [{ start: '12:00', end: '13:00' }, { start: '15:00', end: '14:00' }]))).toEqual(['Pausa 2: la salida debe ser posterior a la entrada.']);
    expect(errorsOf((d) => (d.calendar.absenteeism = 1.5))).toEqual(['Ausentismo diario: debe estar entre 0 % y 100 %.']);
  });

  it('los traslados deben ser minutos de 0 o más', () => {
    expect(errorsOf((d) => (d.travel = { sameTeam: 0, sameArea: 2, crossArea: 5 }))).toEqual([]);
    expect(errorsOf((d) => (d.travel = { crossArea: -3 }))).toEqual(['Traslado entre áreas distintas: debe ser un número de minutos, 0 o más.']);
    expect(errorsOf((d) => (d.travel = { sameArea: Number.NaN }))).toHaveLength(1);
  });

  it('los horarios con nombre también hablan en claro', () => {
    const errs = errorsOf((d) => {
      d.schedules = { tarde: { hours: { start: '15:00', end: '14:00' }, breaks: [{ start: '16:00', end: '15:30' }] } };
    });
    expect(errs.filter((e) => e.startsWith('Horario'))).toEqual(['Horario «tarde»: la salida debe ser posterior a la entrada.', 'Horario «tarde», pausa 1: la salida debe ser posterior a la entrada.']);
  });
});
