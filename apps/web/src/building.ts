import type { CompanyDef, UnitDef } from '@office-pixel/sim';

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
 * - vertical: las plantas se apilan de arriba abajo; cada una es una franja con las salas en fila,
 *   el pasillo debajo y una escalera a la izquierda.
 * - horizontal: las plantas se ponen en fila de izquierda a derecha; cada una es una columna con
 *   las salas apiladas, el pasillo a su izquierda y una pasarela arriba que las conecta.
 */
export type Orientation = 'vertical' | 'horizontal';

/** Destino de un desplazamiento: punto + planta + zona ("<unidad>", "common:<planta>" o "corr"). */
export interface Dest extends Pt {
  floor: number;
  zone: string;
}

export interface DeskL {
  personId: string;
  /** centro del escritorio */
  x: number;
  y: number;
  /** donde se sienta la persona */
  seat: Pt;
}

export type DoorSide = 'bottom' | 'left';

export interface RoomL {
  id: string; // id de la unidad
  name: string;
  floor: number;
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

export interface FloorL {
  index: number;
  areaId: string;
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
  floors: FloorL[];
  rooms: Map<string, RoomL>;
  personDesk: Map<string, { room: RoomL; desk: DeskL }>;
  personFloor: Map<string, number>;
  commonSeat: Map<string, Pt>;
  /** escalera (vertical) o pasarela (horizontal), para dibujarla */
  link: Rect;
  /** x de la escalera (vertical) o y de la pasarela (horizontal) */
  linkC: number;
  entrance: Dest;
  width: number;
  height: number;
  /** sala que atiende una unidad (la suya o la de la primera subunidad con gente) */
  unitRoom(unitId: string): RoomL | undefined;
}

export const FLOOR_X = 100;
const DESK_W = 64;
const DESK_H = 62;
const INBOX_W = 70;
const HEADER = 30;
const ROOM_GAP = 14;
const COMMON_W = 132;
const CORR_H = 44;
const CORR_W = 44;
const FLOOR_GAP = 34;
const TOP = 60;
const COMMON_H_H = HEADER + 2 * DESK_H + 24; // alto de la sala común en horizontal
const H_LEFT = 90;
const H_TOP = 100;
const H_BRIDGE_Y = 46;
export const INBOX_STEP = 18;

function* dfs(list: UnitDef[]): Generator<UnitDef> {
  for (const u of list) {
    yield u;
    if (u.children) yield* dfs(u.children);
  }
}

/** Plantas = áreas; salas = unidades con gente; escritorios = personas. */
export function buildBuilding(def: CompanyDef, orientation: Orientation = 'vertical'): BuildingL {
  const horizontal = orientation === 'horizontal';
  const rooms = new Map<string, RoomL>();
  const personDesk = new Map<string, { room: RoomL; desk: DeskL }>();
  const personFloor = new Map<string, number>();
  const commonSeat = new Map<string, Pt>();
  const floors: FloorL[] = [];

  const byUnit = new Map<string, string[]>();
  for (const p of def.people) {
    const l = byUnit.get(p.unit) ?? [];
    l.push(p.id);
    byUnit.set(p.unit, l);
  }

  let cursorY = TOP; // vertical: y de la planta
  let cursorX = H_LEFT; // horizontal: x de la planta
  for (const area of def.units) {
    const units = [...dfs([area])].filter((u) => byUnit.has(u.id));
    if (!units.length) continue;
    const index = floors.length;

    const dims = units.map((u) => {
      const n = byUnit.get(u.id)!.length;
      const cols = Math.min(n, 4);
      const rows = Math.ceil(n / cols);
      return { u, n, cols, rows, w: 14 + cols * DESK_W + INBOX_W, h: HEADER + Math.max(rows, 2) * DESK_H + 24 };
    });

    const floor: FloorL = {
      index,
      areaId: area.id,
      name: area.name ?? area.id,
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

    const makeRoom = (d: (typeof dims)[number], x: number, y: number, w: number, h: number): RoomL => {
      const room: RoomL = {
        id: d.u.id,
        name: d.u.name ?? d.u.id,
        floor: index,
        x,
        y,
        w,
        h,
        desks: [],
        inbox: { x: x + w - INBOX_W + 6, y: y + HEADER + 6, cols: 3, rows: Math.floor((h - HEADER - 12) / INBOX_STEP) },
        door: horizontal ? { x, y: y + h / 2 } : { x: x + w / 2, y: y + h },
        doorSide: horizontal ? 'left' : 'bottom',
      };
      byUnit.get(d.u.id)!.forEach((pid, i) => {
        const col = i % d.cols;
        const row = Math.floor(i / d.cols);
        const dx = x + 12 + col * DESK_W + DESK_W / 2;
        const dy = y + HEADER + 10 + row * DESK_H + 14;
        const desk: DeskL = { personId: pid, x: dx, y: dy, seat: { x: dx, y: dy + 38 } };
        room.desks.push(desk);
        personDesk.set(pid, { room, desk });
        personFloor.set(pid, index);
        floor.people.push(pid);
      });
      rooms.set(room.id, room);
      floor.rooms.push(room);
      return room;
    };

    if (!horizontal) {
      const roomsH = Math.max(...dims.map((d) => d.h));
      floor.x = FLOOR_X;
      floor.y = cursorY;
      floor.h = roomsH + CORR_H;
      floor.corridorC = cursorY + roomsH + CORR_H / 2;
      let x = FLOOR_X + 10;
      for (const d of dims) {
        makeRoom(d, x, cursorY, d.w, roomsH);
        x += d.w + ROOM_GAP;
      }
      floor.common = { x, y: cursorY, w: COMMON_W, h: roomsH, door: { x: x + COMMON_W / 2, y: cursorY + roomsH }, doorSide: 'bottom' };
      floor.w = x + COMMON_W + 10 - FLOOR_X;
      // la tira del pasillo arranca en la escalera para unirse a ella
      floor.corridor = { x: 55 + 18, y: floor.corridorC - 16, w: floor.x + floor.w - 55 - 18, h: 32 };
      cursorY += floor.h + FLOOR_GAP;
    } else {
      const roomW = Math.max(COMMON_W, ...dims.map((d) => d.w));
      const x0 = cursorX;
      const roomX = x0 + CORR_W + 10;
      let y = H_TOP;
      for (const d of dims) {
        makeRoom(d, roomX, y, roomW, d.h);
        y += d.h + ROOM_GAP;
      }
      floor.common = { x: roomX, y, w: roomW, h: COMMON_H_H, door: { x: roomX, y: y + COMMON_H_H / 2 }, doorSide: 'left' };
      y += COMMON_H_H;
      floor.x = x0;
      floor.y = H_TOP;
      floor.w = CORR_W + 10 + roomW + 10;
      floor.h = y - H_TOP + 10;
      floor.corridorC = x0 + CORR_W / 2;
      floor.corridor = { x: x0, y: H_BRIDGE_Y + 14, w: CORR_W, h: floor.y + floor.h - (H_BRIDGE_Y + 14) };
      cursorX += floor.w + FLOOR_GAP;
    }

    // asientos de la sala común
    const c = floor.common;
    const cols = 4;
    const cap = cols * Math.max(1, Math.floor((c.h - HEADER - 40) / 34));
    floor.people.forEach((pid, i) => {
      const s = i % cap;
      commonSeat.set(pid, { x: c.x + 24 + (s % cols) * 28, y: c.y + HEADER + 34 + Math.floor(s / cols) * 34 });
    });

    floors.push(floor);
  }

  const last = floors[floors.length - 1];
  let link: Rect;
  let linkC: number;
  let entrance: Dest;
  let width: number;
  let height: number;
  if (!horizontal) {
    const first = floors[0];
    const bottom = last.y + last.h;
    linkC = 55;
    link = { x: linkC - 18, y: first.y - 4, w: 36, h: bottom - first.y + 58 };
    entrance = { x: linkC, y: last.corridorC + 40, floor: last.index, zone: 'corr' };
    width = Math.max(...floors.map((f) => f.x + f.w)) + 40;
    height = last.y + last.h + 90;
  } else {
    linkC = H_BRIDGE_Y;
    link = { x: H_LEFT - 44, y: H_BRIDGE_Y - 14, w: last.corridorC + 22 - (H_LEFT - 44), h: 28 };
    entrance = { x: H_LEFT - 60, y: H_BRIDGE_Y, floor: 0, zone: 'corr' };
    width = cursorX - FLOOR_GAP + 40;
    height = Math.max(...floors.map((f) => f.y + f.h)) + 60;
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

  return { orientation, floors, rooms, personDesk, personFloor, commonSeat, link, linkC, entrance, width, height, unitRoom };
}

// ---------- rutas ----------

export function locate(b: BuildingL, p: Pt): { floor: number; zone: string } {
  for (const f of b.floors) {
    if (p.y < f.y || p.y > f.y + f.h || p.x < f.x || p.x > f.x + f.w) continue;
    for (const r of f.rooms) if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return { floor: f.index, zone: r.id };
    const c = f.common;
    if (p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h) return { floor: f.index, zone: `common:${f.index}` };
    return { floor: f.index, zone: 'corr' };
  }
  // fuera de las plantas (escalera, pasarela, entrada): la planta más cercana por su pasillo
  const horizontal = b.orientation === 'horizontal';
  let best = 0;
  b.floors.forEach((f, i) => {
    const d = Math.abs((horizontal ? p.x : p.y) - f.corridorC);
    if (d < Math.abs((horizontal ? p.x : p.y) - b.floors[best].corridorC)) best = i;
  });
  return { floor: best, zone: 'corr' };
}

function doorOf(b: BuildingL, zone: string): Pt {
  if (zone.startsWith('common:')) return b.floors[Number(zone.slice(7))].common.door;
  return b.rooms.get(zone)!.door;
}

/** Camino (puntos intermedios + destino) desde `from` hasta `to` por puertas, pasillo y escalera/pasarela. */
export function route(b: BuildingL, from: Pt, to: Dest): Pt[] {
  const cur = locate(b, from);
  if (cur.zone === to.zone && cur.zone !== 'corr') return [{ x: to.x, y: to.y }];
  const pts: Pt[] = [];
  const C = (f: number) => b.floors[f].corridorC;

  if (b.orientation === 'vertical') {
    // el pasillo es una línea horizontal en y = C(planta); la escalera es una línea vertical en x = linkC
    if (cur.zone !== 'corr') {
      const d = doorOf(b, cur.zone);
      pts.push({ x: d.x, y: d.y - 6 }, { x: d.x, y: C(cur.floor) });
    } else if (Math.abs(from.y - C(cur.floor)) > 2) pts.push({ x: from.x, y: C(cur.floor) });
    let f = cur.floor;
    if (to.floor !== f) {
      pts.push({ x: b.linkC, y: C(f) }, { x: b.linkC, y: C(to.floor) });
      f = to.floor;
    }
    if (to.zone !== 'corr') {
      const d = doorOf(b, to.zone);
      pts.push({ x: d.x, y: C(f) }, { x: d.x, y: d.y - 6 });
    } else pts.push({ x: b.linkC, y: C(f) });
  } else {
    // el pasillo es una línea vertical en x = C(planta); la pasarela es una línea horizontal en y = linkC
    if (cur.zone !== 'corr') {
      const d = doorOf(b, cur.zone);
      pts.push({ x: d.x + 6, y: d.y }, { x: C(cur.floor), y: d.y });
    } else if (Math.abs(from.x - C(cur.floor)) > 2) pts.push({ x: C(cur.floor), y: from.y });
    let f = cur.floor;
    if (to.floor !== f) {
      pts.push({ x: C(f), y: b.linkC }, { x: C(to.floor), y: b.linkC });
      f = to.floor;
    }
    if (to.zone !== 'corr') {
      const d = doorOf(b, to.zone);
      pts.push({ x: C(f), y: d.y }, { x: d.x + 6, y: d.y });
    } else pts.push({ x: C(f), y: b.linkC });
  }
  pts.push({ x: to.x, y: to.y });
  return pts;
}

export function deskDest(b: BuildingL, personId: string): Dest {
  const { room, desk } = b.personDesk.get(personId)!;
  return { x: desk.seat.x, y: desk.seat.y, floor: room.floor, zone: room.id };
}

export function commonDest(b: BuildingL, personId: string): Dest {
  const floor = b.personFloor.get(personId)!;
  const s = b.commonSeat.get(personId)!;
  return { x: s.x, y: s.y, floor, zone: `common:${floor}` };
}

export function inboxSlot(room: RoomL, i: number): Pt {
  const col = i % room.inbox.cols;
  const row = Math.floor(i / room.inbox.cols);
  return { x: room.inbox.x + col * INBOX_STEP + 8, y: room.inbox.y + row * INBOX_STEP + 8 };
}
