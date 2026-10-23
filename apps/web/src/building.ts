import type { CompanyDef, Facility, PersonKind, UnitDef } from '@office-pixel/sim';

export interface Pt {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cómo se disponen las áreas dentro de la planta:
 * - vertical: las áreas se apilan de arriba abajo; cada una es una franja con sus salas en fila,
 *   el pasillo debajo y un pasillo principal a la izquierda.
 * - horizontal: las áreas van en fila de izquierda a derecha; cada una es una columna con sus salas
 *   apiladas, el pasillo a su izquierda y un pasillo principal arriba que las conecta.
 */
export type Orientation = 'vertical' | 'horizontal';

/** Destino de un desplazamiento: punto + área + zona ("<unidad>", "common:<área>" o "corr"). */
export interface Dest extends Pt {
  area: number;
  zone: string;
}

export interface DeskL {
  personId: string;
  kind: PersonKind;
  /** centro del escritorio */
  x: number;
  y: number;
  /** donde se sienta la persona */
  seat: Pt;
}

export type DoorSide = 'bottom' | 'left';

/** Una sala es el espacio de una unidad con su nombre: el área en sí, o una de sus subáreas. */
export interface RoomL {
  id: string; // id de la unidad
  name: string;
  /** "area" = personas asignadas directamente al área; "subarea" = una subárea */
  kind: 'area' | 'subarea';
  /** nombres desde el área hasta esta unidad (para subáreas anidadas) */
  path: string[];
  facility: Facility;
  area: number;
  x: number;
  y: number;
  w: number;
  h: number;
  desks: DeskL[];
  inbox: { x: number; y: number; cols: number; rows: number };
  door: Pt;
  doorSide: DoorSide;
}

export interface CommonL {
  x: number;
  y: number;
  w: number;
  h: number;
  door: Pt;
  doorSide: DoorSide;
}

export interface AreaL {
  index: number;
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** tira del pasillo (para dibujarla) */
  corridor: Rect;
  /** línea central del pasillo: y si es vertical (pasillo horizontal), x si es horizontal */
  corridorC: number;
  rooms: RoomL[];
  common: CommonL;
  people: string[];
}

export interface BuildingL {
  orientation: Orientation;
  /** la planta (empresa): el contorno que contiene todas las áreas */
  planta: Rect & { name: string };
  areas: AreaL[];
  rooms: Map<string, RoomL>;
  personDesk: Map<string, { room: RoomL; desk: DeskL }>;
  personArea: Map<string, number>;
  commonSeat: Map<string, Pt>;
  /** pasillo principal que une las áreas, para dibujarlo */
  link: Rect;
  /** x del pasillo principal (vertical) o y (horizontal) */
  linkC: number;
  entrance: Dest;
  width: number;
  height: number;
  /** sala que atiende una unidad (la suya o la de la primera subunidad con sala) */
  unitRoom(unitId: string): RoomL | undefined;
}

export const AREA_X = 100;
const DESK_W = 64;
const DESK_H = 62;
const INBOX_W = 70;
const HEADER = 30;
/** alto extra de las salas que no son oficina, para su equipamiento */
export const PROPS_H = 40;
const ROOM_GAP = 14;
const COMMON_W = 132;
const CORR_H = 44;
const CORR_W = 44;
const AREA_GAP = 34;
const TOP = 84;
const COMMON_H_H = HEADER + 2 * DESK_H + 24; // alto de la sala común en horizontal
const H_LEFT = 90;
const H_TOP = 100;
const H_BRIDGE_Y = 46;
const STAIRS_X = 55;
export const INBOX_STEP = 18;

function* dfs(list: UnitDef[]): Generator<UnitDef> {
  for (const u of list) {
    yield u;
    if (u.children) yield* dfs(u.children);
  }
}

/** Planta → áreas → subáreas → escritorios (responsables primero, luego colaboradores). */
export function buildBuilding(def: CompanyDef, orientation: Orientation = 'vertical'): BuildingL {
  const horizontal = orientation === 'horizontal';
  const rooms = new Map<string, RoomL>();
  const personDesk = new Map<string, { room: RoomL; desk: DeskL }>();
  const personArea = new Map<string, number>();
  const commonSeat = new Map<string, Pt>();
  const areas: AreaL[] = [];

  const byUnit = new Map<string, string[]>();
  const kindOf = new Map(def.people.map((p) => [p.id, (p.kind ?? 'colaborador') as PersonKind]));
  for (const p of def.people) {
    const l = byUnit.get(p.unit) ?? [];
    l.push(p.id);
    byUnit.set(p.unit, l);
  }
  // responsables primero (se sientan al frente), luego colaboradores, manteniendo el orden de la lista
  for (const [unit, ids] of byUnit) {
    byUnit.set(unit, [...ids.filter((i) => kindOf.get(i) === 'responsable'), ...ids.filter((i) => kindOf.get(i) !== 'responsable')]);
  }

  let cursorY = TOP; // vertical: y del área
  let cursorX = H_LEFT; // horizontal: x del área
  for (const root of def.units) {
    // salas del área: la propia si tiene gente directa (o no tiene subáreas) + todas sus subáreas, con o sin gente
    const members = [...dfs([root])].filter((u) => u.id !== root.id || byUnit.has(u.id) || !root.children?.length);
    const index = areas.length;

    const dims = members.map((u) => {
      const n = byUnit.get(u.id)?.length ?? 0;
      const special = (u.facility ?? 'oficina') !== 'oficina';
      // las instalaciones llevan una franja con su equipamiento (estantes, muelle, garita…) y son más anchas
      const cols = Math.min(Math.max(n, special ? 2 : 1), 4);
      const rows = Math.max(Math.ceil(n / cols), 1);
      return { u, n, cols, rows, w: 14 + cols * DESK_W + INBOX_W, h: HEADER + Math.max(rows, 2) * DESK_H + 24 + (special ? PROPS_H : 0) };
    });

    const area: AreaL = {
      index,
      id: root.id,
      name: root.name ?? root.id,
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      corridor: { x: 0, y: 0, w: 0, h: 0 },
      corridorC: 0,
      rooms: [],
      common: { x: 0, y: 0, w: COMMON_W, h: 0, door: { x: 0, y: 0 }, doorSide: 'bottom' },
      people: [],
    };

    const pathNames = (id: string): string[] => {
      const find = (list: UnitDef[], trail: string[]): string[] | undefined => {
        for (const u of list) {
          const t = [...trail, u.name ?? u.id];
          if (u.id === id) return t;
          const r = u.children && find(u.children, t);
          if (r) return r;
        }
      };
      return find([root], []) ?? [id];
    };

    const makeRoom = (d: (typeof dims)[number], x: number, y: number, w: number, h: number): RoomL => {
      const room: RoomL = {
        id: d.u.id,
        name: d.u.name ?? d.u.id,
        kind: d.u.id === root.id ? 'area' : 'subarea',
        path: pathNames(d.u.id),
        facility: d.u.facility ?? 'oficina',
        area: index,
        x,
        y,
        w,
        h,
        desks: [],
        inbox: { x: x + w - INBOX_W + 6, y: y + HEADER + 6, cols: 3, rows: Math.floor((h - HEADER - 12) / INBOX_STEP) },
        door: horizontal ? { x, y: y + h / 2 } : { x: x + w / 2, y: y + h },
        doorSide: horizontal ? 'left' : 'bottom',
      };
      (byUnit.get(d.u.id) ?? []).forEach((pid, i) => {
        const col = i % d.cols;
        const row = Math.floor(i / d.cols);
        const dx = x + 12 + col * DESK_W + DESK_W / 2;
        const dy = y + HEADER + 10 + row * DESK_H + 14;
        const desk: DeskL = { personId: pid, kind: kindOf.get(pid)!, x: dx, y: dy, seat: { x: dx, y: dy + 38 } };
        room.desks.push(desk);
        personDesk.set(pid, { room, desk });
        personArea.set(pid, index);
        area.people.push(pid);
      });
      rooms.set(room.id, room);
      area.rooms.push(room);
      return room;
    };

    if (!horizontal) {
      const roomsH = Math.max(...dims.map((d) => d.h));
      area.x = AREA_X;
      area.y = cursorY;
      area.h = roomsH + CORR_H;
      area.corridorC = cursorY + roomsH + CORR_H / 2;
      let x = AREA_X + 10;
      for (const d of dims) {
        makeRoom(d, x, cursorY, d.w, roomsH);
        x += d.w + ROOM_GAP;
      }
      area.common = { x, y: cursorY, w: COMMON_W, h: roomsH, door: { x: x + COMMON_W / 2, y: cursorY + roomsH }, doorSide: 'bottom' };
      area.w = x + COMMON_W + 10 - AREA_X;
      // la tira del pasillo arranca en el pasillo principal para unirse a él
      area.corridor = { x: STAIRS_X + 18, y: area.corridorC - 16, w: area.x + area.w - STAIRS_X - 18, h: 32 };
      cursorY += area.h + AREA_GAP;
    } else {
      const roomW = Math.max(COMMON_W, ...dims.map((d) => d.w));
      const x0 = cursorX;
      const roomX = x0 + CORR_W + 10;
      let y = H_TOP;
      for (const d of dims) {
        makeRoom(d, roomX, y, roomW, d.h);
        y += d.h + ROOM_GAP;
      }
      area.common = { x: roomX, y, w: roomW, h: COMMON_H_H, door: { x: roomX, y: y + COMMON_H_H / 2 }, doorSide: 'left' };
      y += COMMON_H_H;
      area.x = x0;
      area.y = H_TOP;
      area.w = CORR_W + 10 + roomW + 10;
      area.h = y - H_TOP + 10;
      area.corridorC = x0 + CORR_W / 2;
      area.corridor = { x: x0, y: H_BRIDGE_Y + 14, w: CORR_W, h: area.y + area.h - (H_BRIDGE_Y + 14) };
      cursorX += area.w + AREA_GAP;
    }

    // asientos de la sala común
    const c = area.common;
    const cols = 4;
    const cap = cols * Math.max(1, Math.floor((c.h - HEADER - 40) / 34));
    area.people.forEach((pid, i) => {
      const s = i % cap;
      commonSeat.set(pid, { x: c.x + 24 + (s % cols) * 28, y: c.y + HEADER + 34 + Math.floor(s / cols) * 34 });
    });

    areas.push(area);
  }

  const last = areas[areas.length - 1];
  let link: Rect;
  let linkC: number;
  let entrance: Dest;
  let width: number;
  let height: number;
  let planta: BuildingL['planta'];
  if (!horizontal) {
    const first = areas[0];
    const bottom = last.y + last.h;
    linkC = STAIRS_X;
    link = { x: linkC - 18, y: first.y - 4, w: 36, h: bottom - first.y + 58 };
    entrance = { x: linkC, y: last.corridorC + 40, area: last.index, zone: 'corr' };
    width = Math.max(...areas.map((f) => f.x + f.w)) + 40;
    const plantaY = TOP - 72;
    const plantaH = entrance.y + 44 - plantaY;
    planta = { name: def.company, x: 12, y: plantaY, w: width - 24, h: plantaH };
    height = plantaY + plantaH + 24;
  } else {
    linkC = H_BRIDGE_Y;
    link = { x: H_LEFT - 44, y: H_BRIDGE_Y - 14, w: last.corridorC + 22 - (H_LEFT - 44), h: 28 };
    entrance = { x: H_LEFT - 60, y: H_BRIDGE_Y, area: 0, zone: 'corr' };
    width = cursorX - AREA_GAP + 40;
    height = Math.max(...areas.map((f) => f.y + f.h)) + 60;
    planta = { name: def.company, x: 8, y: 4, w: width - 16, h: height - 8 };
  }

  const unitRoom = (unitId: string): RoomL | undefined => {
    const direct = rooms.get(unitId);
    if (direct) return direct;
    const find = (list: UnitDef[]): UnitDef | undefined => {
      for (const u of list) {
        if (u.id === unitId) return u;
        const r = u.children && find(u.children);
        if (r) return r;
      }
    };
    const u = find(def.units);
    if (!u) return undefined;
    for (const sub of dfs([u])) if (rooms.has(sub.id)) return rooms.get(sub.id);
  };

  return { orientation, planta, areas, rooms, personDesk, personArea, commonSeat, link, linkC, entrance, width, height, unitRoom };
}

// ---------- rutas ----------

export function locate(b: BuildingL, p: Pt): { area: number; zone: string } {
  for (const f of b.areas) {
    if (p.y < f.y || p.y > f.y + f.h || p.x < f.x || p.x > f.x + f.w) continue;
    for (const r of f.rooms) if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { area: f.index, zone: r.id };
    const c = f.common;
    if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) return { area: f.index, zone: `common:${f.index}` };
    return { area: f.index, zone: 'corr' };
  }
  // fuera de las áreas (pasillo principal, entrada): el área más cercana por su pasillo
  const horizontal = b.orientation === 'horizontal';
  let best = 0;
  b.areas.forEach((f, i) => {
    const d = Math.abs((horizontal ? p.x : p.y) - f.corridorC);
    if (d < Math.abs((horizontal ? p.x : p.y) - b.areas[best].corridorC)) best = i;
  });
  return { area: best, zone: 'corr' };
}

function doorOf(b: BuildingL, zone: string): Pt {
  if (zone.startsWith('common:')) return b.areas[Number(zone.slice(7))].common.door;
  return b.rooms.get(zone)!.door;
}

/** Camino (puntos intermedios + destino) desde `from` hasta `to` por puertas, pasillo y pasillo principal. */
export function route(b: BuildingL, from: Pt, to: Dest): Pt[] {
  const cur = locate(b, from);
  if (cur.zone === to.zone && cur.zone !== 'corr') return [{ x: to.x, y: to.y }];
  const pts: Pt[] = [];
  const C = (a: number) => b.areas[a].corridorC;

  if (b.orientation === 'vertical') {
    // el pasillo de cada área es una línea horizontal en y = C(área); el principal, una vertical en x = linkC
    if (cur.zone !== 'corr') {
      const d = doorOf(b, cur.zone);
      pts.push({ x: d.x, y: d.y - 6 }, { x: d.x, y: C(cur.area) });
    } else if (Math.abs(from.y - C(cur.area)) > 2) pts.push({ x: from.x, y: C(cur.area) });
    let a = cur.area;
    if (to.area !== a) {
      pts.push({ x: b.linkC, y: C(a) }, { x: b.linkC, y: C(to.area) });
      a = to.area;
    }
    if (to.zone !== 'corr') {
      const d = doorOf(b, to.zone);
      pts.push({ x: d.x, y: C(a) }, { x: d.x, y: d.y - 6 });
    } else pts.push({ x: b.linkC, y: C(a) });
  } else {
    // el pasillo de cada área es una línea vertical en x = C(área); el principal, una horizontal en y = linkC
    if (cur.zone !== 'corr') {
      const d = doorOf(b, cur.zone);
      pts.push({ x: d.x + 6, y: d.y }, { x: C(cur.area), y: d.y });
    } else if (Math.abs(from.x - C(cur.area)) > 2) pts.push({ x: C(cur.area), y: from.y });
    let a = cur.area;
    if (to.area !== a) {
      pts.push({ x: C(a), y: b.linkC }, { x: C(to.area), y: b.linkC });
      a = to.area;
    }
    if (to.zone !== 'corr') {
      const d = doorOf(b, to.zone);
      pts.push({ x: C(a), y: d.y }, { x: d.x + 6, y: d.y });
    } else pts.push({ x: C(a), y: b.linkC });
  }
  pts.push({ x: to.x, y: to.y });
  return pts;
}

export function deskDest(b: BuildingL, personId: string): Dest {
  const { room, desk } = b.personDesk.get(personId)!;
  return { x: desk.seat.x, y: desk.seat.y, area: room.area, zone: room.id };
}

export function commonDest(b: BuildingL, personId: string): Dest {
  const area = b.personArea.get(personId)!;
  const s = b.commonSeat.get(personId)!;
  return { x: s.x, y: s.y, area, zone: `common:${area}` };
}

export function inboxSlot(room: RoomL, i: number): Pt {
  const col = i % room.inbox.cols;
  const row = Math.floor(i / room.inbox.cols);
  return { x: room.inbox.x + col * INBOX_STEP + 8, y: room.inbox.y + row * INBOX_STEP + 8 };
}
