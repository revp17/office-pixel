import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companyToYaml, parseCompany, simulateCompany, validateCompany, type CompanyDef } from '@office-pixel/sim';
import {
  addPerson,
  addProcess,
  addStage,
  addUnit,
  emptyCompany,
  formatCondition,
  kindOf,
  parseCondition,
  peopleOf,
  removePerson,
  removeStage,
  removeUnit,
  renameAttribute,
  rolesIn,
  slug,
  subordinatesOf,
  uniqueId,
  usage,
} from '../src/application/editing/model';

const exampleText = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');
const example = (): CompanyDef => parseCompany(exampleText).def!;

describe('ids', () => {
  it('slug quita tildes y espacios', () => {
    expect(slug('Atención al cliente')).toBe('atencion_al_cliente');
    expect(slug('  ¿¿ ')).toBe('item');
  });
  it('uniqueId evita colisiones', () => {
    expect(uniqueId('Ventas', new Set(['ventas', 'ventas_2']))).toBe('ventas_3');
  });
});

describe('empresa en blanco', () => {
  it('es válida y simulable', () => {
    const d = emptyCompany();
    expect(validateCompany(d).errors).toEqual([]);
    const r = simulateCompany(d, { seed: 1, horizonDays: 3 });
    expect(r.metrics.completed).toBeGreaterThan(0);
  });
  it('sobrevive al ida y vuelta por YAML', () => {
    const d = emptyCompany();
    expect(parseCompany(companyToYaml(d)).def).toEqual(d);
  });
});

describe('ida y vuelta del ejemplo', () => {
  it('YAML → modelo → YAML → modelo es idéntico', () => {
    const d = example();
    expect(parseCompany(companyToYaml(d)).def).toEqual(d);
  });
});

describe('unidades', () => {
  it('crea áreas y subáreas con ids únicos', () => {
    const d = emptyCompany();
    const a = addUnit(d, null, 'Ventas');
    const b = addUnit(d, a, 'Ventas'); // mismo nombre en subárea
    expect(a).not.toBe(b);
    expect(d.units.find((u) => u.id === a)!.children![0].id).toBe(b);
  });
  it('no deja borrar una unidad en uso', () => {
    const d = emptyCompany();
    const r = removeUnit(d, 'subarea_1');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('persona');
    expect(usage(d, 'operaciones')).toEqual({ people: 2, stages: 1, meetings: 0 });
  });
  it('borra una unidad vacía', () => {
    const d = emptyCompany();
    const id = addUnit(d, 'operaciones', 'Temporal');
    expect(removeUnit(d, id).ok).toBe(true);
    expect(d.units[0].children!.map((u) => u.id)).toEqual(['subarea_1']);
  });
});

describe('personas', () => {
  it('añadir hereda el rol de su equipo y borrar limpia referencias', () => {
    const d = emptyCompany();
    const p = addPerson(d, 'subarea_1', 'Marta Gil');
    expect(p.role).toBe('analista');
    expect(rolesIn(d, 'operaciones')).toEqual(['analista']);
    d.people[0].reportsTo = p.id;
    removePerson(d, p.id);
    expect(d.people[0].reportsTo).toBeUndefined();
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('cada área y subárea puede tener varios responsables y varios colaboradores', () => {
    const d = emptyCompany();
    // área: dos responsables y un colaborador directos
    addPerson(d, 'operaciones', 'Jefa 1', 'responsable');
    addPerson(d, 'operaciones', 'Jefe 2', 'responsable');
    addPerson(d, 'operaciones', 'Apoyo');
    // subárea: ya tiene a Ana (responsable) y Luis (colaborador); añadimos más
    addPerson(d, 'subarea_1', 'Otro responsable', 'responsable');
    addPerson(d, 'subarea_1', 'Otro colaborador');
    expect(peopleOf(d, 'operaciones', 'responsable').map((p) => p.name)).toEqual(['Jefa 1', 'Jefe 2']);
    expect(peopleOf(d, 'operaciones', 'colaborador').map((p) => p.name)).toEqual(['Apoyo']);
    expect(peopleOf(d, 'subarea_1', 'responsable')).toHaveLength(2);
    expect(peopleOf(d, 'subarea_1', 'colaborador')).toHaveLength(2);
    expect(validateCompany(d).errors).toEqual([]);
    // sobrevive al YAML
    expect(parseCompany(companyToYaml(d)).def).toEqual(d);
  });

  it('el tipo por defecto es colaborador y los nombres por defecto lo indican', () => {
    const d = emptyCompany();
    const a = addPerson(d, 'subarea_1');
    const b = addPerson(d, 'subarea_1', undefined, 'responsable');
    expect([kindOf(a), a.name]).toEqual(['colaborador', 'Nuevo colaborador']);
    expect([kindOf(b), b.name]).toEqual(['responsable', 'Nuevo responsable']);
    delete a.kind;
    expect(kindOf(a)).toBe('colaborador');
  });
});

describe('procesos y etapas', () => {
  it('un proceso nuevo es válido', () => {
    const d = emptyCompany();
    addProcess(d, 'Otro proceso');
    expect(validateCompany(d).errors).toEqual([]);
  });
  it('añadir una etapa la encadena antes del cierre', () => {
    const d = emptyCompany();
    const proc = d.processes[0];
    const st = addStage(proc, d, 'Revisión');
    expect(proc.stages.map((s) => s.id)).toEqual(['atencion', st.id, 'cierre']);
    expect(proc.stages[0].next).toBe(st.id);
    expect(st.next).toBe('cierre');
    expect(validateCompany(d).errors).toEqual([]);
  });
  it('borrar una etapa limpia referencias y la validación lo señala', () => {
    const d = emptyCompany();
    const proc = d.processes[0];
    const st = addStage(proc, d, 'Revisión');
    proc.stages[0].exceptions = [{ id: 'x', probability: 0.1, action: 'goto', target: st.id }];
    removeStage(proc, st.id);
    expect(proc.stages[0].exceptions).toEqual([]);
    expect(proc.stages[0].next).toBeUndefined();
    expect(validateCompany(d).errors.some((e) => e.includes('falta "next"'))).toBe(true);
  });
  it('renombrar un dato actualiza las condiciones', () => {
    const d = example();
    const proc = d.processes[0];
    renameAttribute(proc, 'amount', 'monto');
    expect(Object.keys(proc.attributes!)).toEqual(['monto']);
    const when = (proc.stages.find((s) => s.id === 'kyc')!.next as Array<{ when?: string }>)[0].when;
    expect(when).toBe('case.monto > 50000');
    expect(validateCompany(d).errors).toEqual([]);
  });
});

describe('condiciones', () => {
  it('reconoce las simples y deja pasar las compuestas', () => {
    expect(parseCondition('case.amount > 50000')).toEqual({ attr: 'amount', op: '>', value: 50000 });
    expect(parseCondition('case.x <= -1.5')).toEqual({ attr: 'x', op: '<=', value: -1.5 });
    expect(parseCondition('case.a > 1 && case.b < 2')).toBeNull();
    expect(formatCondition({ attr: 'amount', op: '>=', value: 10 })).toBe('case.amount >= 10');
  });
});

describe('personas: borrar y jefes', () => {
  it('borrar a la dueña de un proceso o a un interesado no deja la ficha apuntando a nadie', () => {
    const d = example();
    const owner = d.people[0].id;
    const proc = d.processes[0];
    proc.doc = { scope: { owner, stakeholders: [{ id: 's1', name: 'Ana', personId: owner }, { id: 's2', name: 'Externo' }] }, fieldwork: [], validations: [], phases: {} };
    removePerson(d, owner);
    expect(proc.doc.scope.owner).toBeUndefined();
    expect(proc.doc.scope.stakeholders[0].personId).toBeUndefined();
    expect(proc.doc.scope.stakeholders[1].name).toBe('Externo');
  });

  it('nadie puede tener como jefe a alguien que depende de esa persona (ni directa ni indirectamente)', () => {
    const d = emptyCompany();
    const unit = d.units[0].children![0].id;
    const a = addPerson(d, unit, 'Ana');
    const b = addPerson(d, unit, 'Beto');
    const c = addPerson(d, unit, 'Carla');
    b.reportsTo = a.id;
    c.reportsTo = b.id;
    expect([...subordinatesOf(d, a.id)].sort()).toEqual([b.id, c.id].sort());
    expect([...subordinatesOf(d, c.id)]).toEqual([]);
  });
});
