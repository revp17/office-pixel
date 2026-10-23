import { DAY } from '@office-pixel/sim';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Un instante de la simulación (minutos desde el lunes 00:00) como «Día 2 · Mar 09:30». */
export function fmtTime(t: number): string {
  const day = Math.floor(t / DAY);
  const m = Math.floor(t % DAY);
  return `Día ${day + 1} · ${WEEKDAYS[day % 7]} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Minutos como «45 min» o «2.5 h» (a partir de 90 min). */
export const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(0)} min`);

/** Una fracción como porcentaje entero: 0.256 → «26%». */
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Escapa texto para insertarlo en HTML (también sirve dentro de atributos entre comillas). */
export const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Fecha y hora de un instante ISO, en español. */
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
