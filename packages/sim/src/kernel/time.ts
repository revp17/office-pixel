export const DAY = 1440;

/** "HH:MM" → minutos desde medianoche, o null si es inválido. */
export function parseHM(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export interface BizCalendar {
  /** instante resultante de avanzar `minutes` minutos hábiles desde `t` */
  addBiz(t: number, minutes: number): number;
  /** minutos hábiles transcurridos entre a y b */
  bizBetween(a: number, b: number): number;
}

/** Tramos abiertos de un día de trabajo: de la entrada a la salida, sin las pausas (cada uno como [desde, hasta], en minutos). */
export function openWindows(startMin: number, endMin: number, breaks: ReadonlyArray<readonly [number, number]> = []): Array<[number, number]> {
  const blocks = breaks
    .map(([s, e]) => [Math.max(s, startMin), Math.min(e, endMin)] as [number, number])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  const out: Array<[number, number]> = [];
  let cursor = startMin;
  for (const [s, e] of blocks) {
    if (s > cursor) out.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < endMin) out.push([cursor, endMin]);
  return out;
}

/**
 * Tiempo hábil de la empresa: solo cuentan las horas de jornada de los días laborables, sin las pausas
 * (almuerzo, descansos) que se pasen en `breaks`.
 */
export function makeBizCalendar(workDays: number[], startMin: number, endMin: number, breaks: ReadonlyArray<readonly [number, number]> = []): BizCalendar {
  const wd = new Set(workDays);
  const windows = openWindows(startMin, endMin, breaks);
  return {
    addBiz(t, minutes) {
      let m = minutes;
      let day = Math.floor(t / DAY);
      let cur = t;
      for (let guard = 0; guard < 100000; guard++) {
        if (wd.has(day % 7)) {
          for (const [from, to] of windows) {
            const ws = day * DAY + from;
            const we = day * DAY + to;
            if (cur >= we) continue;
            const s = Math.max(cur, ws);
            const avail = we - s;
            if (m <= avail) return s + m;
            m -= avail;
          }
        }
        day++;
        cur = day * DAY;
      }
      return Infinity;
    },
    bizBetween(a, b) {
      if (b <= a) return 0;
      let total = 0;
      for (let day = Math.floor(a / DAY); day <= Math.floor(b / DAY); day++) {
        if (!wd.has(day % 7)) continue;
        for (const [from, to] of windows) {
          const s = Math.max(a, day * DAY + from);
          const e = Math.min(b, day * DAY + to);
          if (e > s) total += e - s;
        }
      }
      return total;
    },
  };
}
