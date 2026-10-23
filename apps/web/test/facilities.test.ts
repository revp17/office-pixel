import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companyToYaml, facilityViews, hasArt, parseCompany, resolveFacility, simulateCompany, validateCompany, type CompanyDef } from '@office-pixel/sim';
import { buildBuilding } from '../src/scene/building';

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

describe('ilustración propia de un tipo de instalación', () => {
  const withArt = (): CompanyDef => {
    const d = withLab();
    d.facilityTypes![0].art = {
      items: [
        { t: 'rect', x: 10, y: 40, w: 80, h: 20, c: '#9aa6c0', r: 4 },
        { t: 'ellipse', x: 100, y: 30, w: 30, h: 30, c: '#4cd98a' },
        { t: 'tri', x: 140, y: 30, w: 30, h: 30, c: '#f5c451' },
        { t: 'line', x: 10, y: 10, x2: 120, y2: 10, c: '#fff', lw: 3 },
        { t: 'emoji', x: 180, y: 20, s: 30, ch: '🧪' },
      ],
    };
    return d;
  };

  it('una sala con ilustración reserva más espacio y la lleva consigo', () => {
    const plain = buildBuilding(withLab()).rooms.get('riesgos')!;
    const art = buildBuilding(withArt()).rooms.get('riesgos')!;
    expect(art.art?.items).toHaveLength(5);
    expect(art.propsH).toBeGreaterThan(plain.propsH);
    expect(art.h).toBeGreaterThan(plain.h);
    expect(plain.art).toBeUndefined();
    expect(buildBuilding(base()).rooms.get('riesgos')!.propsH).toBe(0); // una oficina no reserva franja
  });

  it('es válida y viaja en el YAML', () => {
    expect(validateCompany(withArt()).errors).toEqual([]);
    const back = parseCompany(companyToYaml(withArt()));
    expect(back.errors).toEqual([]);
    expect(back.def!.facilityTypes![0].art).toEqual(withArt().facilityTypes![0].art);
    expect(hasArt(back.def!.facilityTypes![0].art)).toBe(true);
    expect(hasArt({ items: [] })).toBe(false);
    expect(hasArt(undefined)).toBe(false);
  });

  it('acepta una imagen y rechaza formas mal hechas', () => {
    const d = withArt();
    d.facilityTypes![0].art = { image: 'data:image/png;base64,iVBORw0KGgo=' };
    expect(validateCompany(d).errors).toEqual([]);
    expect(resolveFacility(d, 'laboratorio').art?.image).toContain('data:image/png');

    d.facilityTypes![0].art = { image: 'http://ejemplo.com/x.png' };
    expect(validateCompany(d).errors.join('\n')).toMatch(/art\.image/);

    d.facilityTypes![0].art = { items: [{ t: 'rect', x: 0, y: 0, w: 10, h: 10, c: 'rojo' }, { t: 'line', x: 0, y: 0, x2: 5, y2: 5, c: '#fff', lw: 0 }, { t: 'star' as never, x: 0, y: 0 } as never, { t: 'emoji', x: 5, y: 5, s: 20, ch: '' }, { t: 'rect', x: 9999, y: 0, w: 1, h: 1, c: '#fff' }] };
    const errs = validateCompany(d).errors.join('\n');
    expect(errs).toMatch(/\.c: color/);
    expect(errs).toMatch(/grosor/);
    expect(errs).toMatch(/rect, ellipse, tri, line o emoji/);
    expect(errs).toMatch(/falta el icono/);
    expect(errs).toMatch(/fuera del área/);

    d.facilityTypes![0].art = { items: Array.from({ length: 81 }, () => ({ t: 'rect' as const, x: 0, y: 0, w: 1, h: 1, c: '#fff' })) };
    expect(validateCompany(d).errors.join('\n')).toMatch(/máximo 80/);
  });
});
