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

/** Tiempo hábil de la empresa: solo cuentan las horas de jornada de los días laborables. */
export function makeBizCalendar(workDays: number[], startMin: number, endMin: number): BizCalendar {
  const wd = new Set(workDays);
  return {
    addBiz(t, minutes) {
      let m = minutes;
      let day = Math.floor(t / DAY);
      let cur = t;
      for (let guard = 0; guard < 100000; guard++) {
        if (wd.has(day % 7)) {
          const ws = day * DAY + startMin;
          const we = day * DAY + endMin;
          if (cur < we) {
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
        const s = Math.max(a, day * DAY + startMin);
        const e = Math.min(b, day * DAY + endMin);
        if (e > s) total += e - s;
      }
      return total;
    },
  };
}
