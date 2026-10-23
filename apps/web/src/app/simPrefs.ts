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

export function bindSimPrefs() {
  const save = () =>
    persist.saveSimPrefs(state.mode, {
      days: Math.min(30, Math.max(1, Math.trunc(Number(dom.days.value)) || MODE_DEFAULTS[state.mode].days)),
      seed: Math.trunc(Number(dom.seed.value)) || 0,
      speed: Number(dom.speed.value),
    });
  for (const el of [dom.days, dom.seed, dom.speed]) el.addEventListener('change', save);
}
