import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCompany } from '@office-pixel/sim';
import { buildBuilding, commonDest, deskDest, locate, route } from '../src/building';

const def = parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;
const b = buildBuilding(def);

describe('edificio', () => {
  it('una planta por área y una sala por unidad con gente', () => {
    expect(b.floors).toHaveLength(5);
    expect(b.floors.map((f) => f.areaId)).toEqual(['comercial', 'operaciones', 'riesgos', 'legal', 'atencion']);
    expect(b.rooms.has('kyc')).toBe(true);
    expect(b.rooms.has('formalizacion')).toBe(true);
  });

  it('todas las personas tienen escritorio dentro de su sala y sin solaparse', () => {
    expect(b.personDesk.size).toBe(def.people.length);
    const seen = new Set<string>();
    for (const [pid, { room, desk }] of b.personDesk) {
      expect(desk.x).toBeGreaterThan(room.x);
      expect(desk.x).toBeLessThan(room.x + room.w);
      expect(desk.seat.y).toBeLessThan(room.y + room.h);
      const key = `${desk.x},${desk.y}`;
      expect(seen.has(key + room.floor)).toBe(false);
      seen.add(key + room.floor);
      expect(locate(b, desk.seat).zone).toBe(room.id);
      expect(def.people.find((p) => p.id === pid)!.unit).toBe(room.id);
    }
  });

  it('por defecto es vertical', () => {
    expect(b.orientation).toBe('vertical');
  });

  it('las salas de una planta no se solapan', () => {
    for (const f of b.floors) {
      const all = [...f.rooms.map((r) => ({ x: r.x, w: r.w })), { x: f.common.x, w: f.common.w }];
      for (let i = 1; i < all.length; i++) expect(all[i].x).toBeGreaterThanOrEqual(all[i - 1].x + all[i - 1].w);
    }
  });

  it('cada etapa del ejemplo tiene sala', () => {
    for (const pr of def.processes) for (const s of pr.stages) if (s.unit) expect(b.unitRoom(s.unit)).toBeDefined();
  });

  it('el inbox tiene capacidad útil', () => {
    for (const r of b.rooms.values()) expect(r.inbox.rows * r.inbox.cols).toBeGreaterThanOrEqual(12);
  });
});

describe('rutas', () => {
  it('en la misma sala es directo', () => {
    const e1 = deskDest(b, 'e1');
    const e2 = deskDest(b, 'e2');
    expect(route(b, { x: e1.x, y: e1.y }, e2)).toEqual([{ x: e2.x, y: e2.y }]);
  });

  it('entre plantas pasa por la escalera y termina en el destino', () => {
    const a = deskDest(b, 'e1'); // planta 0
    const z = deskDest(b, 'g1'); // planta 4
    const path = route(b, a, z);
    expect(path[path.length - 1]).toEqual({ x: z.x, y: z.y });
    expect(path.some((p) => p.x === b.linkC)).toBe(true);
    for (const p of path) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it('de la entrada a un escritorio y al lugar común', () => {
    const d = deskDest(b, 'a1');
    const p1 = route(b, b.entrance, d);
    expect(p1[p1.length - 1]).toEqual({ x: d.x, y: d.y });
    const c = commonDest(b, 'a1');
    const p2 = route(b, d, c);
    expect(p2[p2.length - 1]).toEqual({ x: c.x, y: c.y });
    expect(locate(b, c).zone).toBe(`common:${c.floor}`);
  });

  it('la entrada cae en el pasillo de la planta baja', () => {
    expect(locate(b, b.entrance)).toEqual({ floor: 4, zone: 'corr' });
  });
});

describe('orientación horizontal', () => {
  const h = buildBuilding(def, 'horizontal');
  const bounds = (bl: typeof h, pts: Array<{ x: number; y: number }>) => {
    for (const p of pts) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(bl.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(bl.height);
    }
  };

  it('mismas plantas, salas y personas, pero en fila y más ancho que alto', () => {
    expect(h.floors.map((f) => f.areaId)).toEqual(b.floors.map((f) => f.areaId));
    expect([...h.rooms.keys()]).toEqual([...b.rooms.keys()]);
    expect(h.personDesk.size).toBe(def.people.length);
    expect(h.width).toBeGreaterThan(h.height);
    expect(b.height).toBeGreaterThan(b.width);
  });

  it('las plantas no se solapan en x y las salas se apilan sin solaparse', () => {
    for (let i = 1; i < h.floors.length; i++) expect(h.floors[i].x).toBeGreaterThanOrEqual(h.floors[i - 1].x + h.floors[i - 1].w);
    for (const f of h.floors) {
      const stack = [...f.rooms, f.common];
      for (let i = 1; i < stack.length; i++) expect(stack[i].y).toBeGreaterThanOrEqual(stack[i - 1].y + stack[i - 1].h);
      for (const r of f.rooms) expect(r.doorSide).toBe('left');
    }
  });

  it('cada escritorio cae dentro de su sala', () => {
    for (const [pid, { room, desk }] of h.personDesk) {
      expect(locate(h, desk.seat).zone).toBe(room.id);
      expect(def.people.find((p) => p.id === pid)!.unit).toBe(room.id);
    }
  });

  it('entre plantas cruza la pasarela y termina en el destino', () => {
    const a = deskDest(h, 'e1');
    const z = deskDest(h, 'g1');
    const path = route(h, a, z);
    expect(path[path.length - 1]).toEqual({ x: z.x, y: z.y });
    expect(path.some((p) => p.y === h.linkC)).toBe(true);
    bounds(h, path);
  });

  it('desde la entrada, a la sala común y de vuelta a la entrada', () => {
    expect(locate(h, h.entrance)).toEqual({ floor: 0, zone: 'corr' });
    const d = deskDest(h, 'a1');
    const c = commonDest(h, 'a1');
    for (const [from, to] of [
      [h.entrance, d],
      [d, c],
      [c, h.entrance],
    ] as const) {
      const p = route(h, from, to);
      expect(p[p.length - 1]).toEqual({ x: to.x, y: to.y });
      bounds(h, p);
    }
    expect(locate(h, c).zone).toBe(`common:${c.floor}`);
  });

  it('las rutas de la versión vertical también quedan dentro del edificio', () => {
    const p = route(b, deskDest(b, 'g1'), b.entrance);
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(0);
      expect(q.y).toBeLessThanOrEqual(b.height);
    }
  });
});
