import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCompany, validateCompany, type CompanyDef } from '@office-pixel/sim';
import { buildBuilding } from '../src/scene/building';
import { moveUnit, siblingsOf } from '../src/application/editing/model';

const base = (): CompanyDef => parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;
const ids = (d: CompanyDef) => d.units.map((u) => u.id);

describe('orden de las áreas y subáreas', () => {
  it('mover sube, baja y lleva al principio o al final, sin salirse de la lista', () => {
    const d = base();
    expect(ids(d)).toEqual(['comercial', 'operaciones', 'riesgos', 'legal', 'atencion']);
    expect(moveUnit(d, 'riesgos', 'up')).toBe(true);
    expect(ids(d)).toEqual(['comercial', 'riesgos', 'operaciones', 'legal', 'atencion']);
    expect(moveUnit(d, 'comercial', 'down')).toBe(true);
    expect(ids(d)).toEqual(['riesgos', 'comercial', 'operaciones', 'legal', 'atencion']);
    expect(moveUnit(d, 'atencion', 'first')).toBe(true);
    expect(ids(d)[0]).toBe('atencion');
    expect(moveUnit(d, 'atencion', 'last')).toBe(true);
    expect(ids(d)[4]).toBe('atencion');
    // en los extremos no hace nada
    expect(moveUnit(d, 'atencion', 'down')).toBe(false);
    expect(moveUnit(d, ids(d)[0], 'up')).toBe(false);
    expect(moveUnit(d, 'no_existe', 'up')).toBe(false);
    expect(ids(d).sort()).toEqual(['atencion', 'comercial', 'legal', 'operaciones', 'riesgos']);
  });

  it('las subáreas se ordenan entre las de su misma área', () => {
    const d = base();
    const ops = () => d.units.find((u) => u.id === 'operaciones')!.children!.map((c) => c.id);
    expect(ops()).toEqual(['kyc', 'formalizacion']);
    expect(siblingsOf(d, 'kyc')!.index).toBe(0);
    expect(moveUnit(d, 'kyc', 'down')).toBe(true);
    expect(ops()).toEqual(['formalizacion', 'kyc']);
    expect(moveUnit(d, 'kyc', 'down')).toBe(false);
    expect(ids(d)).toEqual(['comercial', 'operaciones', 'riesgos', 'legal', 'atencion']); // las áreas no se tocan
  });

  it('el plano respeta el orden: vertical de arriba a abajo y horizontal de izquierda a derecha', () => {
    const d = base();
    moveUnit(d, 'atencion', 'first');
    const v = buildBuilding(d, 'vertical');
    expect(v.areas.map((a) => a.id)[0]).toBe('atencion');
    expect(v.areas[0].y).toBeLessThan(v.areas[1].y);
    const h = buildBuilding(d, 'horizontal');
    expect(h.areas.map((a) => a.id)[0]).toBe('atencion');
    expect(h.areas[0].x).toBeLessThan(h.areas[1].x);
    // y dentro de un área, las salas siguen el orden de sus subáreas
    moveUnit(d, 'formalizacion', 'first');
    const ops = buildBuilding(d, 'vertical').areas.find((a) => a.id === 'operaciones')!;
    const order = ops.rooms.map((r) => r.id);
    expect(order.indexOf('formalizacion')).toBeLessThan(order.indexOf('kyc'));
    const fx = ops.rooms.find((r) => r.id === 'formalizacion')!.x;
    expect(fx).toBeLessThan(ops.rooms.find((r) => r.id === 'kyc')!.x);
  });

  it('reordenar no cambia la validez ni a las personas', () => {
    const d = base();
    const people = d.people.length;
    moveUnit(d, 'legal', 'first');
    expect(validateCompany(d).errors).toEqual([]);
    expect(d.people.length).toBe(people);
  });
});

describe('orden de los procesos', () => {
  it('un proceso nuevo se puede subir hasta quedar antes de los ya creados', async () => {
    const { moveProcess, addProcess } = await import('../src/application/editing/model');
    const d = base();
    const before = d.processes.map((p) => p.id);
    const nuevo = addProcess(d);
    expect(d.processes.map((p) => p.id)).toEqual([...before, nuevo.id]); // entra al final
    expect(moveProcess(d, nuevo.id, 'first')).toBe(true);
    expect(d.processes.map((p) => p.id)).toEqual([nuevo.id, ...before]);
    expect(moveProcess(d, nuevo.id, 'down')).toBe(true);
    expect(d.processes.map((p) => p.id)).toEqual([before[0], nuevo.id, ...before.slice(1)]);
    expect(moveProcess(d, nuevo.id, 'up')).toBe(true);
    expect(moveProcess(d, nuevo.id, 'up')).toBe(false); // ya es el primero
    expect(moveProcess(d, d.processes.at(-1)!.id, 'down')).toBe(false);
    expect(moveProcess(d, 'no_existe', 'up')).toBe(false);
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('reordenar no pierde nada: mismas etapas, procedimientos y dependencias', () => {
    const d = base();
    d.processes.find((p) => p.id === 'reclamo_cliente')!.dependsOn = [{ process: 'solicitud_credito', kind: 'requiere' }];
    const snapshot = JSON.stringify([...d.processes].sort((a, b) => a.id.localeCompare(b.id)));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return import('../src/application/editing/model').then(({ moveProcess }) => {
      moveProcess(d, 'reclamo_cliente', 'first');
      expect(d.processes[0].id).toBe('reclamo_cliente');
      expect(JSON.stringify([...d.processes].sort((a, b) => a.id.localeCompare(b.id)))).toBe(snapshot);
      expect(validateCompany(d).errors).toEqual([]);
    });
  });
});
