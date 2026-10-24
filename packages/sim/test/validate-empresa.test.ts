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

describe('tipos de instalación propios', () => {
  const custom = { id: 'taller', label: 'Taller', icon: '🔧', look: 'mantenimiento' as const };
  const withType = (c: Record<string, unknown>) => errorsOf((d) => (d.facilityTypes = [c as never]));

  it('uno bien formado es válido', () => {
    expect(withType(custom)).toEqual([]);
  });

  it('nombre, icono y descripción tienen límite y dicen qué falla', () => {
    expect(withType({ ...custom, label: ' ' })).toEqual(['Tipo de instalación «taller»: falta el nombre.']);
    expect(withType({ ...custom, label: 'x'.repeat(41) })[0]).toMatch(/el nombre admite hasta 40 caracteres/);
    expect(withType({ ...custom, icon: '' })).toEqual(['Tipo de instalación «Taller»: falta el icono.']);
    expect(withType({ ...custom, icon: 'icono larguísimo de verdad' })[0]).toMatch(/el icono debe ser un emoji/);
    expect(withType({ ...custom, description: 'x'.repeat(401) })[0]).toMatch(/la descripción admite hasta 400 caracteres/);
  });

  it('no repite identificadores ni usa los de los tipos incluidos', () => {
    expect(withType({ ...custom, id: 'bodega' })[0]).toMatch(/ya es de un tipo incluido/);
    expect(errorsOf((d) => (d.facilityTypes = [custom, custom] as never))[0]).toMatch(/está repetido/);
  });

  it('un área con un tipo que no existe lo dice por su nombre', () => {
    const errs = errorsOf((d) => (d.units[0].facility = 'inexistente'));
    expect(errs[0]).toMatch(new RegExp(`^Área «${banco.units[0].name}»: el tipo de instalación «inexistente» no existe`));
  });
});

describe('personas (en el lenguaje del formulario)', () => {
  it('dicen quién es y qué falta', () => {
    const nombre = banco.people[0].name ?? banco.people[0].id;
    expect(errorsOf((d) => (d.people[0].role = '  '))).toEqual([`Persona «${nombre}»: escribe su rol (las etapas de los procesos piden un rol).`]);
    expect(errorsOf((d) => (d.people[0].reportsTo = 'fantasma'))).toEqual([`Persona «${nombre}»: su jefe «fantasma» ya no existe.`]);
    expect(errorsOf((d) => (d.people[0].errorRate = 1))).toEqual([`Persona «${nombre}»: los errores deben estar entre 0 % y 99 %.`]);
    expect(errorsOf((d) => (d.people = []))[0]).toBe('Personas: añade al menos una persona.');
  });

  it('si cambias el rol de la única persona que cubría una etapa, lo explica', () => {
    const errs = errorsOf((d) => {
      const stage = d.processes[0].stages.find((s) => s.role && s.unit)!;
      for (const p of d.people) if (p.role === stage.role) p.role = 'otro rol';
    });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0]).toMatch(/nadie en «.+» tiene el rol «.+»\. Cambia el rol de alguien en Personas/);
  });
});

describe('procesos y etapas (en el lenguaje del formulario)', () => {
  const proc = () => banco.processes[0];
  const nombre = () => proc().name ?? proc().id;

  it('las llegadas, el plazo y las etapas dicen qué proceso y qué etapa', () => {
    expect(errorsOf((d) => (d.processes[0].arrivals = { type: 'poisson', ratePerHour: 0 }))).toEqual([`Proceso «${nombre()}»: los casos por hora hábil deben ser más de 0.`]);
    expect(errorsOf((d) => (d.processes[0].arrivals = { type: 'constant', everyMinutes: 0 }))[0]).toMatch(/el tiempo entre casos debe ser de al menos 1 minuto/);
    const first = proc().stages[0];
    const label = first.label ?? first.id;
    expect(errorsOf((d) => (d.processes[0].stages[0].sla = { maxMinutes: 0 }))).toEqual([`Proceso «${nombre()}», etapa «${label}»: el plazo máximo (SLA) debe ser mayor que 0.`]);
    expect(errorsOf((d) => delete d.processes[0].stages[0].next)[0]).toBe(`Proceso «${nombre()}», etapa «${label}»: elige a qué etapa va después (o márcala como final).`);
    expect(errorsOf((d) => (d.processes[0].stages[0].next = 'no_existe'))[0]).toMatch(/la etapa siguiente \(«no_existe»\) ya no existe/);
  });

  it('sin etapa final, o con una etapa final que tiene siguiente, lo explica', () => {
    expect(errorsOf((d) => d.processes[0].stages.forEach((s) => ((s.terminal = false), s.next ?? (s.next = d.processes[0].stages[0].id)))).some((e) => /marca una etapa como final/.test(e))).toBe(true);
    expect(errorsOf((d) => ((d.processes[0].stages.at(-1)!.terminal = true), (d.processes[0].stages.at(-1)!.next = 'x')))[0]).toMatch(/una etapa final no puede tener siguiente etapa/);
  });

  it('las condiciones fallidas dicen cuál es y qué falta', () => {
    const errs = errorsOf((d) => {
      d.processes[0].stages[0].next = [{ when: 'case.monto >', to: d.processes[0].stages[1].id }];
    });
    expect(errs.some((e) => /condición 1: la condición no se entiende/.test(e))).toBe(true);
    expect(errs.some((e) => /falta la regla final «en cualquier otro caso» \(otherwise\)/.test(e))).toBe(true);
  });
});

describe('texto YAML pegado a mano', () => {
  const errs = (t: string) => parseCompany(t).errors;

  it('vacío, que no es una empresa, o con errores de sintaxis: un mensaje corto y claro', () => {
    expect(errs('  \n ')).toEqual(['El texto está vacío: pega o abre una empresa en YAML.']);
    expect(errs('- 1\n- 2')[0]).toMatch(/^Esto no parece una empresa/);
    expect(errs('company: [')[0]).toMatch(/^El texto no es YAML válido \(línea 1, columna \d+\): falta cerrar un corchete \] o una llave \}\.$/);
    expect(errs('a: b: c')[0]).toMatch(/hay dos «clave: valor» en la misma línea/);
    expect(errs('company: "X"\n\tbad: 1')[0]).toMatch(/no se pueden usar tabuladores para sangrar; usa espacios/);
    for (const t of ['company: [', 'a: b: c']) expect(errs(t)[0]).not.toContain('\n');
  });

  it('un JSON de empresa también vale', () => {
    expect(parseCompany(JSON.stringify(banco)).errors).toEqual([]);
  });

  it('áreas mal escritas dicen cuál es', () => {
    const d = structuredClone(banco) as unknown as { units: Array<Record<string, unknown>> };
    d.units.push({ name: 'Sin id' });
    expect(validateCompany(d).errors.some((e) => /^Área o subárea \d+: falta el identificador \(id\)\.$/.test(e))).toBe(true);
    const dup = structuredClone(banco) as unknown as { units: Array<Record<string, unknown>> };
    dup.units.push({ ...dup.units[0] });
    expect(validateCompany(dup).errors.some((e) => /el identificador «.+» está repetido/.test(e))).toBe(true);
  });
});
