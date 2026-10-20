import type { ProcessDef } from '@office-pixel/sim';

export const ROOM_W = 240;
export const ROOM_H = 170;
export const GAP = 80;
export const PAD = 50;

export interface RoomLayout {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  row: number;
}

export interface Edge {
  from: string;
  to: string;
  kind: 'next' | 'exception';
}

export interface MapLayout {
  rooms: Map<string, RoomLayout>;
  edges: Edge[];
  width: number;
  height: number;
}

/** Cada etapa es una sala; la columna es la distancia (BFS) desde la etapa de entrada. */
export function computeLayout(def: ProcessDef): MapLayout {
  const edges: Edge[] = [];
  for (const s of def.stages) {
    if (typeof s.next === 'string') edges.push({ from: s.id, to: s.next, kind: 'next' });
    else if (Array.isArray(s.next)) for (const r of s.next) edges.push({ from: s.id, to: r.to, kind: 'next' });
    for (const e of s.exceptions ?? []) edges.push({ from: s.id, to: e.target, kind: 'exception' });
  }

  const depth = new Map<string, number>([[def.stages[0].id, 0]]);
  const queue = [def.stages[0].id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if (e.from === cur && !depth.has(e.to)) {
        depth.set(e.to, depth.get(cur)! + 1);
        queue.push(e.to);
      }
    }
  }
  let extra = Math.max(...depth.values()) + 1;
  for (const s of def.stages) if (!depth.has(s.id)) depth.set(s.id, extra++);

  const rowsInCol = new Map<number, number>();
  const rooms = new Map<string, RoomLayout>();
  let maxDepth = 0;
  let maxRow = 0;
  for (const s of def.stages) {
    const d = depth.get(s.id)!;
    const row = rowsInCol.get(d) ?? 0;
    rowsInCol.set(d, row + 1);
    rooms.set(s.id, {
      id: s.id,
      x: PAD + d * (ROOM_W + GAP),
      y: PAD + 40 + row * (ROOM_H + GAP),
      w: ROOM_W,
      h: ROOM_H,
      depth: d,
      row,
    });
    maxDepth = Math.max(maxDepth, d);
    maxRow = Math.max(maxRow, row);
  }
  return {
    rooms,
    edges,
    width: PAD * 2 + (maxDepth + 1) * ROOM_W + maxDepth * GAP,
    height: PAD * 2 + 40 + (maxRow + 1) * ROOM_H + maxRow * GAP,
  };
}
