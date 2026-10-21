import type { CompanyDef, UnitDef } from '@office-pixel/sim';

export interface Pt {
  x: number;
  y: number;
}

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
}

export interface CommonL {
  x: number;
  y: number;
  w: number;
  h: number;
  door: Pt;
}

export interface FloorL {
  index: number;
  areaId: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  roomsH: number;
  corridorY: number;
  rooms: RoomL[];
  common: CommonL;
  people: string[];
}

export interface BuildingL {
  floors: FloorL[];
  rooms: Map<string, RoomL>;
  personDesk: Map<string, { room: RoomL; desk: DeskL }>;
  personFloor: Map<string, number>;
  commonSeat: Map<string, Pt>;
  stairsX: number;
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
const FLOOR_GAP = 34;
const TOP = 60;
export const INBOX_STEP = 18;

function* dfs(list: UnitDef[]): Generator<UnitDef> {
  for (const u of list) {
    yield u;
    if (u.children) yield* dfs(u.children);
  }
}

/** Plantas = áreas; salas = unidades con gente; escritorios = personas. */
export function buildBuilding(def: CompanyDef): BuildingL {
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

  let cursorY = TOP;
  for (const area of def.units) {
    const units = [...dfs([area])].filter((u) => byUnit.has(u.id));
    if (!units.length) continue;
    const index = floors.length;

    // dimensiones de cada sala
    const dims = units.map((u) => {
      const n = byUnit.get(u.id)!.length;
      const cols = Math.min(n, 4);
      const rows = Math.ceil(n / cols);
      return { u, n, cols, rows, w: 14 + cols * DESK_W + INBOX_W, h: HEADER + Math.max(rows, 2) * DESK_H + 24 };
    });
    const roomsH = Math.max(...dims.map((d) => d.h));
    const floor: FloorL = {
      index,
      areaId: area.id,
      name: area.name ?? area.id,
      x: FLOOR_X,
      y: cursorY,
      w: 0,
      h: roomsH + CORR_H,
      roomsH,
      corridorY: cursorY + roomsH + CORR_H / 2,
      rooms: [],
      common: { x: 0, y: cursorY, w: COMMON_W, h: roomsH, door: { x: 0, y: 0 } },
      people: [],
    };

    let x = FLOOR_X + 10;
    for (const d of dims) {
      const room: RoomL = {
        id: d.u.id,
        name: d.u.name ?? d.u.id,
        floor: index,
        x,
        y: cursorY,
        w: d.w,
        h: roomsH,
        desks: [],
        inbox: {
          x: x + d.w - INBOX_W + 6,
          y: cursorY + HEADER + 6,
          cols: 3,
          rows: Math.floor((roomsH - HEADER - 12) / INBOX_STEP),
        },
        door: { x: x + d.w / 2, y: cursorY + roomsH },
      };
      byUnit.get(d.u.id)!.forEach((pid, i) => {
        const col = i % d.cols;
        const row = Math.floor(i / d.cols);
        const dx = x + 12 + col * DESK_W + DESK_W / 2;
        const dy = cursorY + HEADER + 10 + row * DESK_H + 14;
        const desk: DeskL = { personId: pid, x: dx, y: dy, seat: { x: dx, y: dy + 38 } };
        room.desks.push(desk);
        personDesk.set(pid, { room, desk });
        personFloor.set(pid, index);
        floor.people.push(pid);
      });
      rooms.set(room.id, room);
      floor.rooms.push(room);
      x += d.w + ROOM_GAP;
    }

    floor.common.x = x;
    floor.common.door = { x: x + COMMON_W / 2, y: cursorY + roomsH };
    floor.w = x + COMMON_W + 10 - FLOOR_X;

    const cols = 4;
    const cap = cols * Math.max(1, Math.floor((roomsH - HEADER - 40) / 34));
    floor.people.forEach((pid, i) => {
      const s = i % cap;
      commonSeat.set(pid, {
        x: floor.common.x + 24 + (s % cols) * 28,
        y: cursorY + HEADER + 34 + Math.floor(s / cols) * 34,
      });
    });

    floors.push(floor);
    cursorY += floor.h + FLOOR_GAP;
  }

  const stairsX = 55;
  const last = floors[floors.length - 1];
  const entrance: Dest = { x: stairsX, y: last.corridorY + 40, floor: last.index, zone: 'corr' };
  const width = Math.max(...floors.map((f) => f.x + f.w)) + 40;
  const height = last.y + last.h + 90;

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

  return { floors, rooms, personDesk, personFloor, commonSeat, stairsX, entrance, width, height, unitRoom };
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
  let best = 0;
  b.floors.forEach((f, i) => {
    if (Math.abs(p.y - f.corridorY) < Math.abs(p.y - b.floors[best].corridorY)) best = i;
  });
  return { floor: best, zone: 'corr' };
}

function doorOf(b: BuildingL, zone: string): Pt {
  if (zone.startsWith('common:')) return b.floors[Number(zone.slice(7))].common.door;
  return b.rooms.get(zone)!.door;
}

/** Camino (puntos intermedios + destino) desde `from` hasta `to` por puertas, pasillo y escalera. */
export function route(b: BuildingL, from: Pt, to: Dest): Pt[] {
  const cur = locate(b, from);
  if (cur.zone === to.zone && cur.zone !== 'corr') return [{ x: to.x, y: to.y }];
  const pts: Pt[] = [];
  const yC = (f: number) => b.floors[f].corridorY;
  if (cur.zone !== 'corr') {
    const d = doorOf(b, cur.zone);
    pts.push({ x: d.x, y: d.y - 6 }, { x: d.x, y: yC(cur.floor) });
  } else if (Math.abs(from.y - yC(cur.floor)) > 2) pts.push({ x: from.x, y: yC(cur.floor) });

  let f = cur.floor;
  if (to.floor !== f) {
    pts.push({ x: b.stairsX, y: yC(f) }, { x: b.stairsX, y: yC(to.floor) });
    f = to.floor;
  }
  if (to.zone !== 'corr') {
    const d = doorOf(b, to.zone);
    pts.push({ x: d.x, y: yC(f) }, { x: d.x, y: d.y - 6 });
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
