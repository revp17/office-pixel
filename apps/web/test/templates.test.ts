import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dependencyEdges, parseCompany, simulateCompany, validateCompany } from '@office-pixel/sim';
import { buildBuilding } from '../src/building';

const load = (name: string) => parseCompany(readFileSync(new URL(`../../../examples/${name}.yaml`, import.meta.url), 'utf8'));

const cases = [
  { file: 'plantilla_pequena_ferreteria', people: [9, 12], facilities: ['bodega', 'ingreso', 'despacho', 'seguridad', 'mantenimiento'] },
  { file: 'plantilla_mediana_distribuidora', people: [35, 42], facilities: ['bodega', 'ingreso', 'despacho', 'seguridad', 'mantenimiento', 'transporte'] },
  { file: 'plantilla_grande_centro_distribucion', people: [58, 70], facilities: ['bodega', 'ingreso', 'despacho', 'seguridad', 'mantenimiento', 'transporte'] },
];

describe('plantillas de empresa (pequeña, mediana, grande)', () => {
  for (const c of cases) {
    describe(c.file, () => {
      const r = load(c.file);

      it('es válida y tiene el tamaño esperado', () => {
        expect(r.errors).toEqual([]);
        expect(r.def!.people.length).toBeGreaterThanOrEqual(c.people[0]);
        expect(r.def!.people.length).toBeLessThanOrEqual(c.people[1]);
      });

      it('cubre ingreso, despacho, seguridad y mantenimiento como procesos', () => {
        const names = r.def!.processes.map((p) => `${p.id} ${p.name}`.toLowerCase()).join(' | ');
        expect(names).toMatch(/ingreso/);
        expect(names).toMatch(/despacho|pedido/);
        expect(names).toMatch(/seguridad|acceso/);
        expect(names).toMatch(/mantenimiento/);
      });

      it('dibuja cada instalación con su tipo', () => {
        const b = buildBuilding(r.def!);
        const seen = new Set([...b.rooms.values()].map((room) => room.facility));
        for (const f of c.facilities) expect(seen.has(f as never)).toBe(true);
        // las salas especiales reservan la franja de equipamiento, y el resto de salas no
        const bodega = [...b.rooms.values()].find((room) => room.facility === 'bodega')!;
        const oficina = [...b.rooms.values()].find((room) => room.facility === 'oficina');
        if (oficina && oficina.desks.length > 0 && bodega.desks.length > 0) expect(bodega.h).toBeGreaterThanOrEqual(oficina.h);
      });

      it('declara dependencias entre procesos y la simulación las respeta', () => {
        const edges = dependencyEdges(r.def!);
        expect(edges.some((e) => e.kind === 'dispara')).toBe(true);
        expect(edges.some((e) => e.kind === 'requiere')).toBe(true);
        const res = simulateCompany(r.def!, { seed: 11, horizonDays: 20 });
        const spawned = res.events.filter((e) => e.type === 'case.created' && e.cause);
        expect(spawned.length).toBeGreaterThan(0);
      });

      it('al simularla se completan casos de todos los procesos', () => {
        const res = simulateCompany(r.def!, { seed: 11, horizonDays: 10 });
        for (const p of r.def!.processes) {
          const done = res.events.filter((e) => e.type === 'case.completed' && e.caseId.startsWith(p.id)).length;
          expect(done, `proceso ${p.id}`).toBeGreaterThan(0);
        }
      });
    });
  }

  it('rechaza un tipo de instalación desconocido', () => {
    const r = load('plantilla_pequena_ferreteria');
    r.def!.units[1].facility = 'hangar' as never;
    expect(validateCompany(r.def!).errors.join('\n')).toMatch(/facility/);
  });
});
