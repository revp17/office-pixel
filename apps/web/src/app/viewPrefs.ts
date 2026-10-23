import { applyMode } from './modes';
import { persist } from './services';
import { setLayout, type Orient } from './sceneHost';
import type { Mode } from './state';

/**
 * Modo y disposición del plano: son de la cuenta, así que viven en la base de datos y te siguen a otro equipo.
 * Solo cuando no hay base de datos (modo «solo navegador») se recuerdan en este navegador.
 */
const LOCAL = { mode: 'office-pixel.mode.v1', layout: 'office-pixel.layout.v1' };

function readLocal(key: string) {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveViewPref(name: 'mode' | 'layout', value: string) {
  if (persist.online) persist.saveViewPref(name, value);
  else
    try {
      localStorage.setItem(LOCAL[name], value);
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
}

/** Aplica lo guardado (tras abrir la base de datos) y deja listos los días, la semilla y la velocidad del modo. */
export async function restoreView() {
  const read = (name: 'mode' | 'layout') => (persist.online ? persist.viewPref(name) : Promise.resolve(readLocal(LOCAL[name])));
  const [mode, layout] = await Promise.all([read('mode'), read('layout')]);
  if (layout === 'horizontal' || layout === 'vertical') setLayout(layout as Orient);
  await applyMode(mode === 'week' ? 'week' : ('explain' as Mode), false);
}
