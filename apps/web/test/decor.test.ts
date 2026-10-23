import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DECOR, DECOR_GROUPS, companyToYaml, decorBounds, isDecorKind, parseCompany, simulateCompany, validateCompany, type CompanyDef } from '@office-pixel/sim';
import { buildBuilding } from '../src/scene/building';

import type { UnitDef } from '@office-pixel/sim';
const unit = (d: CompanyDef, id: string): UnitDef => {
  const find = (l: UnitDef[]): UnitDef | undefined => l.flatMap((u) => [u, ...(u.children ? [find(u.children)] : [])]).find((u) => u?.id === id) as UnitDef | undefined;
  return find(d.units)!;
};
const base = (): CompanyDef => parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;

describe('catálogo de objetos', () => {
  it('tiene objetos de cada grupo y los básicos que se esperan (puertas, mesas, sillas, plantas)', () => {
    expect(Object.keys(DECOR).length).toBeGreaterThanOrEqual(30);
    for (const g of DECOR_GROUPS) expect(Object.values(DECOR).some((d) => d.group === g), g).toBe(true);
    for (const k of ['puerta', 'puerta_doble', 'ventana', 'mesa', 'escritorio', 'silla', 'sofa', 'planta', 'planta_grande', 'archivador', 'estanteria', 'extintor', 'camion']) expect(isDecorKind(k), k).toBe(true);
  });

  it('cada objeto está bien definido y se dibuja dentro de su caja', () => {
    for (const [k, d] of Object.entries(DECOR)) {
      expect(d.label, k).toBeTruthy();
      expect(d.w, k).toBeGreaterThan(4);
      expect(d.h, k).toBeGreaterThan(4);
      expect(d.art.length, k).toBeGreaterThan(0);
      for (const it of d.art) {
        if (it.t === 'emoji') continue;
        expect(it.c, k).toMatch(/^#[0-9a-fA-F]{3,8}$/);
        if (it.t === 'line') {
          for (const v of [it.x, it.x2]) expect(v, `${k} x`).toBeGreaterThanOrEqual(-1), expect(v, `${k} x`).toBeLessThanOrEqual(d.w + 1);
          for (const v of [it.y, it.y2]) expect(v, `${k} y`).toBeGreaterThanOrEqual(-1), expect(v, `${k} y`).toBeLessThanOrEqual(d.h + 1);
        } else {
          expect(it.x, k).toBeGreaterThanOrEqual(-1);
          expect(it.y, k).toBeGreaterThanOrEqual(-1);
          expect(it.x + it.w, k).toBeLessThanOrEqual(d.w + 1);
          expect(it.y + it.h, k).toBeLessThanOrEqual(d.h + 1);
        }
      }
    }
  });

  it('la caja de un objeto girado 90° intercambia ancho y alto', () => {
    const b0 = decorBounds({ k: 'mesa_reunion', x: 100, y: 60, rot: 0 });
    const b90 = decorBounds({ k: 'mesa_reunion', x: 100, y: 60, rot: 90 });
    expect([b0.w, b0.h]).toEqual([100, 44]);
    expect([b90.w, b90.h]).toEqual([44, 100]);
    expect(b90.x + b90.w / 2).toBe(100);
  });
});

describe('objetos colocados en una sala', () => {
  const withDecor = (): CompanyDef => {
    const d = base();
    unit(d, 'kyc').decor = [
      { id: 'a', k: 'mesa', x: 40, y: 120, rot: 0 },
      { id: 'b', k: 'planta', x: 20, y: 150, rot: 90, flip: true },
      { id: 'c', k: 'puerta', x: 80, y: 170, rot: 180 },
    ];
    return d;
  };

  it('son válidos, viajan en el YAML y llegan a la sala del plano', () => {
    expect(validateCompany(withDecor()).errors).toEqual([]);
    const back = parseCompany(companyToYaml(withDecor()));
    expect(back.errors).toEqual([]);
    expect(unit(back.def!, 'kyc').decor).toEqual(unit(withDecor(), 'kyc').decor);
    const room = buildBuilding(withDecor()).rooms.get('kyc')!;
    expect(room.decor.map((i) => i.k)).toEqual(['mesa', 'planta', 'puerta']);
    expect(buildBuilding(base()).rooms.get('kyc')!.decor).toEqual([]);
    expect(simulateCompany(withDecor(), { seed: 1, horizonDays: 2 }).events.length).toBeGreaterThan(0);
  });

  it('el mobiliario no cambia el tamaño de la sala ni la simulación', () => {
    const a = buildBuilding(base()).rooms.get('kyc')!;
    const b = buildBuilding(withDecor()).rooms.get('kyc')!;
    expect([b.w, b.h]).toEqual([a.w, a.h]);
    expect(simulateCompany(withDecor(), { seed: 4, horizonDays: 3 }).events).toEqual(simulateCompany(base(), { seed: 4, horizonDays: 3 }).events);
  });

  it('rechaza objetos que no existen, giros raros, ids repetidos y coordenadas inválidas', () => {
    const d = withDecor();
    const list = unit(d, 'kyc').decor!;
    list.push({ id: 'a', k: 'nave_espacial', x: 1, y: 1, rot: 45 as never });
    list.push({ id: 'z', k: 'mesa', x: 'x' as never, y: 1, rot: 0 });
    const errs = validateCompany(d).errors.join('\n');
    expect(errs).toMatch(/nave_espacial/);
    expect(errs).toMatch(/rot/);
    expect(errs).toMatch(/repetido/);
    expect(errs).toMatch(/x e y/);
  });

  it('se puede decorar una subárea y quitarla (quitar el área se lleva sus objetos)', () => {
    const d = withDecor();
    d.units = d.units.map((u) => ({ ...u, children: u.children?.filter((c) => c.id !== 'kyc') }));
    expect(JSON.stringify(d.units)).not.toContain('"mesa"');
  });
});
