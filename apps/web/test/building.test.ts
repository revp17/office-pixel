import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCompany, type CompanyDef } from '@office-pixel/sim';
import { buildBuilding, commonDest, deskDest, locate, route } from '../src/scene/building';
import { addUnit, emptyCompany } from '../src/application/editing/model';

const def = parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;
const b = buildBuilding(def);

describe('planta → áreas → subáreas', () => {
  it('una sola planta con el nombre de la empresa, que contiene todas las áreas', () => {
    expect(b.planta.name).toBe('Banco Pixel');
    for (const a of b.areas) {
      expect(a.x).toBeGreaterThanOrEqual(b.planta.x);
      expect(a.x + a.w).toBeLessThanOrEqual(b.planta.x + b.planta.w);
      expect(a.y).toBeGreaterThanOrEqual(b.planta.y);
      expect(a.y + a.h).toBeLessThanOrEqual(b.planta.y + b.planta.h);
    }
    expect(b.entrance.x).toBeGreaterThan(b.planta.x);
    expect(b.entrance.y).toBeLessThan(b.planta.y + b.planta.h);
  });

  it('una franja por área, con el nombre del área', () => {
    expect(b.areas.map((a) => a.name)).toEqual(['Comercial', 'Operaciones', 'Riesgos', 'Legal y Cumplimiento', 'Atención al cliente']);
  });

  it('el área tiene su propia sala si tiene gente directa y una sala por subárea, con su propio nombre', () => {
    const riesgos = b.areas.find((a) => a.id === 'riesgos')!;
    expect(riesgos.rooms.map((r) => [r.id, r.kind, r.name])).toEqual([
      ['riesgos', 'area', 'Riesgos'],
      ['analisis', 'subarea', 'Análisis'],
      ['senior', 'subarea', 'Riesgos senior'],
    ]);
    // un área sin gente directa no tiene sala propia, solo sus subáreas
    const sinDirectos = parseCompany(
      readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8').replace(
        /- \{ id: gerente_comercial.*\n/,
        '',
      ),
    );
    if (sinDirectos.def) {
      const bb = buildBuilding(sinDirectos.def);
      expect(bb.areas.find((a) => a.id === 'comercial')!.rooms.map((r) => r.id)).toEqual(['ventas']);
    }
  });

  it('las subáreas sin gente también se dibujan y un área vacía tiene una sala', () => {
    const d: CompanyDef = emptyCompany();
    addUnit(d, 'operaciones', 'Subárea vacía');
    addUnit(d, null, 'Área vacía');
    const bb = buildBuilding(d);
    expect(bb.areas.map((a) => a.name)).toEqual(['Operaciones', 'Área vacía']);
    expect(bb.areas[0].rooms.map((r) => r.name)).toContain('Subárea vacía');
    expect(bb.areas[1].rooms).toHaveLength(1);
    expect(bb.areas[1].rooms[0].desks).toHaveLength(0);
  });

  it('los responsables se sientan primero y quedan marcados', () => {
    const cc = b.rooms.get('contact_center')!;
    expect(cc.desks.map((d) => d.kind)).toEqual(['responsable', 'responsable', 'colaborador', 'colaborador', 'colaborador']);
    expect(cc.desks.slice(0, 2).map((d) => d.personId)).toEqual(['g1', 'g2']);
    const ops = b.rooms.get('operaciones')!; // gente directa del área
    expect(ops.desks.map((d) => [d.personId, d.kind])).toEqual([['jefa_ops', 'responsable']]);
  });

  it('un nombre de subárea anidada incluye su camino', () => {
    const d = emptyCompany();
    const sub = addUnit(d, 'operaciones', 'Nivel 1');
    const find = (list: typeof d.units): typeof d.units[number] | undefined => {
      for (const u of list) {
        if (u.id === sub) return u;
        const r = u.children && find(u.children);
        if (r) return r;
      }
    };
    (find(d.units)!.children ??= []).push({ id: 'nivel_2', name: 'Nivel 2' });
    const bb = buildBuilding(d);
    expect(bb.rooms.get('nivel_2')!.path).toEqual(['Operaciones', 'Nivel 1', 'Nivel 2']);
  });
});

describe('edificio', () => {
  it('todas las personas tienen escritorio dentro de su sala y sin solaparse', () => {
    expect(b.personDesk.size).toBe(def.people.length);
    const seen = new Set<string>();
    for (const [pid, { room, desk }] of b.personDesk) {
      expect(desk.x).toBeGreaterThan(room.x);
      expect(desk.x).toBeLessThan(room.x + room.w);
      expect(desk.seat.y).toBeLessThan(room.y + room.h);
      const key = `${desk.x},${desk.y},${room.area}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(locate(b, desk.seat).zone).toBe(room.id);
      expect(def.people.find((p) => p.id === pid)!.unit).toBe(room.id);
    }
  });

  it('por defecto es vertical y las salas de un área no se solapan', () => {
    expect(b.orientation).toBe('vertical');
    for (const f of b.areas) {
      const all = [...f.rooms.map((r) => ({ x: r.x, w: r.w })), { x: f.common.x, w: f.common.w }];
      for (let i = 1; i < all.length; i++) expect(all[i].x).toBeGreaterThanOrEqual(all[i - 1].x + all[i - 1].w);
    }
  });

  it('cada etapa del ejemplo tiene sala y el inbox tiene capacidad útil', () => {
    for (const pr of def.processes) for (const s of pr.stages) if (s.unit) expect(b.unitRoom(s.unit)).toBeDefined();
    for (const r of b.rooms.values()) expect(r.inbox.rows * r.inbox.cols).toBeGreaterThanOrEqual(12);
  });
});

describe('rutas', () => {
  it('en la misma sala es directo', () => {
    const e1 = deskDest(b, 'e1');
    const e2 = deskDest(b, 'e2');
    expect(route(b, { x: e1.x, y: e1.y }, e2)).toEqual([{ x: e2.x, y: e2.y }]);
  });

  it('entre áreas pasa por el pasillo principal y termina en el destino', () => {
    const a = deskDest(b, 'e1');
    const z = deskDest(b, 'g1');
    const path = route(b, a, z);
    expect(path[path.length - 1]).toEqual({ x: z.x, y: z.y });
    expect(path.some((p) => p.x === b.linkC)).toBe(true);
    for (const p of path) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it('de la entrada a un escritorio y a la sala común; la entrada está en el pasillo del área de abajo', () => {
    const d = deskDest(b, 'a1');
    const p1 = route(b, b.entrance, d);
    expect(p1[p1.length - 1]).toEqual({ x: d.x, y: d.y });
    const c = commonDest(b, 'a1');
    const p2 = route(b, d, c);
    expect(p2[p2.length - 1]).toEqual({ x: c.x, y: c.y });
    expect(locate(b, c).zone).toBe(`common:${c.area}`);
    expect(locate(b, b.entrance)).toEqual({ area: 4, zone: 'corr' });
  });
});

describe('disposición horizontal de las áreas', () => {
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

  it('mismas áreas, salas y personas, en fila y más ancho que alto; la planta las contiene', () => {
    expect(h.areas.map((f) => f.id)).toEqual(b.areas.map((f) => f.id));
    expect([...h.rooms.keys()]).toEqual([...b.rooms.keys()]);
    expect(h.personDesk.size).toBe(def.people.length);
    expect(h.width).toBeGreaterThan(h.height);
    expect(b.height).toBeGreaterThan(b.width);
    for (const a of h.areas) {
      expect(a.x).toBeGreaterThanOrEqual(h.planta.x);
      expect(a.x + a.w).toBeLessThanOrEqual(h.planta.x + h.planta.w);
      expect(a.y + a.h).toBeLessThanOrEqual(h.planta.y + h.planta.h);
    }
  });

  it('las áreas no se solapan en x y las salas se apilan sin solaparse', () => {
    for (let i = 1; i < h.areas.length; i++) expect(h.areas[i].x).toBeGreaterThanOrEqual(h.areas[i - 1].x + h.areas[i - 1].w);
    for (const f of h.areas) {
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

  it('entre áreas cruza el pasillo principal; desde la entrada y de vuelta', () => {
    const path = route(h, deskDest(h, 'e1'), deskDest(h, 'g1'));
    expect(path.some((p) => p.y === h.linkC)).toBe(true);
    bounds(h, path);
    expect(locate(h, h.entrance)).toEqual({ area: 0, zone: 'corr' });
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
  });
});
