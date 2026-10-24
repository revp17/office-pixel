import { parseHM, type CompanyDef } from '@office-pixel/sim';

/** Tramo del día que muestra la barra de una persona: de una hora antes de la primera entrada a una hora después de la última salida. */
export function dayRange(def: CompanyDef): { from: number; to: number } {
  const hours = [def.calendar.hours, ...Object.values(def.schedules ?? {}).map((s) => s.hours)];
  const starts = hours.map((h) => parseHM(h.start)).filter((m): m is number => m !== null);
  const ends = hours.map((h) => parseHM(h.end)).filter((m): m is number => m !== null);
  const from = Math.max(0, Math.floor(Math.min(...starts) / 60) - 1) * 60;
  const to = Math.min(24, Math.ceil(Math.max(...ends) / 60) + 1) * 60;
  return { from, to: Math.max(to, from + 4 * 60) };
}
