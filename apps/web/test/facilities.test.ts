import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companyToYaml, facilityViews, parseCompany, resolveFacility, simulateCompany, validateCompany, type CompanyDef } from '@office-pixel/sim';
import { buildBuilding } from '../src/building';

const base = (): CompanyDef => parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;

const withLab = (): CompanyDef => {
  const d = base();
  d.facilityTypes = [{ id: 'laboratorio', label: 'Laboratorio', icon: '🧪', description: 'Análisis de muestras', look: 'mantenimiento' }];
  d.units.find((u) => u.id === 'riesgos')!.facility = 'laboratorio';
  return d;
};

describe('tipos de instalación propios', () => {
  it('aparecen en el catálogo después de los incluidos y se resuelven por id', () => {
    const d = withLab();
    const ids = facilityViews(d).map((f) => f.id);
    expect(ids.slice(0, 7)).toEqual(['oficina', 'bodega', 'ingreso', 'despacho', 'seguridad', 'mantenimiento', 'transporte']);
    expect(ids[7]).toBe('laboratorio');
    const lab = resolveFacility(d, 'laboratorio');
    expect(lab).toMatchObject({ label: 'Laboratorio', icon: '🧪', look: 'mantenimiento', builtin: false });
    expect(lab.description).toBe('Análisis de muestras');
    // sin definir o desconocido, es una oficina
    expect(resolveFacility(d, undefined).id).toBe('oficina');
    expect(resolveFacility(d, 'inexistente').id).toBe('oficina');
  });

  it('una unidad con un tipo propio es válida, se dibuja con su aspecto base y conserva su icono', () => {
    const d = withLab();
    expect(validateCompany(d).errors).toEqual([]);
    const room = buildBuilding(d).rooms.get('riesgos')!;
    expect(room.facility).toBe('laboratorio');
    expect(room.look).toBe('mantenimiento');
    expect(room.icon).toBe('🧪');
    expect(simulateCompany(d, { seed: 1, horizonDays: 2 }).events.length).toBeGreaterThan(0);
  });

  it('se guarda y se lee de vuelta en el YAML', () => {
    const back = parseCompany(companyToYaml(withLab()));
    expect(back.errors).toEqual([]);
    expect(back.def!.facilityTypes).toEqual(withLab().facilityTypes);
    expect(back.def!.units.find((u) => u.id === 'riesgos')!.facility).toBe('laboratorio');
  });

  it('rechaza un tipo propio mal definido o una unidad que usa uno que no existe', () => {
    const d = withLab();
    d.units[0].facility = 'cocina';
    expect(validateCompany(d).errors.join('\n')).toMatch(/facility/);
    delete d.units[0].facility;

    d.facilityTypes!.push({ id: 'bodega', label: 'Otra', icon: 'x', look: 'bodega' });
    expect(validateCompany(d).errors.join('\n')).toMatch(/ya es un tipo incluido/);
    d.facilityTypes!.pop();

    d.facilityTypes!.push({ id: 'laboratorio', label: 'Otro', icon: 'x', look: 'bodega' });
    expect(validateCompany(d).errors.join('\n')).toMatch(/duplicado/);
    d.facilityTypes!.pop();

    d.facilityTypes!.push({ id: 'raro', label: '', icon: '', look: 'hangar' as never });
    const errs = validateCompany(d).errors.join('\n');
    expect(errs).toMatch(/falta el nombre/);
    expect(errs).toMatch(/falta el icono/);
    expect(errs).toMatch(/look/);
  });
});
