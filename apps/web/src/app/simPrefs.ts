import { dom } from './dom';
import { scene } from './sceneHost';
import { persist } from './services';
import { MODE_DEFAULTS, state } from './state';

/**
 * Días, semilla y velocidad de la barra: se guardan en la base de datos por empresa y por modo,
 * y se recuperan al abrir la empresa (o al cambiar de modo).
 */

export function setSimFields(p: { days: number; seed: number; speed: number }) {
  dom.days.value = String(p.days);
  dom.seed.value = String(p.seed);
  // si la velocidad guardada ya no está en la lista, se deja la que había
  const speed = String(p.speed);
  if (Array.from(dom.speed.options).some((o) => o.value === speed)) dom.speed.value = speed;
  scene.speed = Number(dom.speed.value);
}

/** Pone lo guardado de esta empresa y modo; si no hay nada, los valores por defecto del modo. */
export async function restoreSimPrefs() {
  const saved = await persist.simPrefs(state.mode);
  setSimFields(saved ?? MODE_DEFAULTS[state.mode]);
}

/**
 * Lo que valen hoy los campos de la barra, ya corregido: días de 1 a 30, semilla entera; si el campo está vacío o no es un
 * número, el valor por defecto del modo. Es lo que se simula y lo que se guarda.
 */
export function readSimFields() {
  const def = MODE_DEFAULTS[state.mode];
  const num = (text: string) => (text.trim() === '' ? NaN : Math.trunc(Number(text)));
  const d = num(dom.days.value);
  const s = num(dom.seed.value);
  return {
    days: Number.isFinite(d) ? Math.min(30, Math.max(1, d)) : def.days,
    seed: Number.isFinite(s) ? s : def.seed,
    speed: Number(dom.speed.value),
  };
}

/** Deja en los campos lo que realmente se usa (así no se ve «99» mientras se simulan 30 días). */
export function normalizeSimFields() {
  const f = readSimFields();
  dom.days.value = String(f.days);
  dom.seed.value = String(f.seed);
  return f;
}

export function bindSimPrefs() {
  const onChange = () => persist.saveSimPrefs(state.mode, normalizeSimFields());
  for (const el of [dom.days, dom.seed, dom.speed]) el.addEventListener('change', onChange);
}
