import { dom } from './dom';
import { run } from './controller';
import { scene, story } from './sceneHost';
import { restoreSimPrefs, setSimFields } from './simPrefs';
import { MODE_DEFAULTS, state, type Mode } from './state';

/** Dos modos de ver la simulación: «cómo funciona» (despacio, pocos casos, con relato) o «semana completa». */

const MODE_KEY = 'office-pixel.mode.v1';

export function loadMode(): Mode {
  try {
    if (localStorage.getItem(MODE_KEY) === 'week') return 'week';
  } catch {
    /* sin almacenamiento: se usa el modo por defecto */
  }
  return 'explain';
}

export function applyMode(m: Mode, rerun: boolean) {
  state.mode = m;
  dom.mode.value = m;
  const explain = m === 'explain';
  setSimFields(MODE_DEFAULTS[m]);
  scene.skipIdle = explain;
  story.show(explain);
  dom.step.hidden = !explain;
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* sin almacenamiento */
  }
  // lo guardado de esta empresa en este modo reemplaza los valores por defecto antes de simular
  void restoreSimPrefs().then(() => {
    if (rerun) run();
  });
}

export function bindModes() {
  state.mode = loadMode();
  scene.onEvents = (events, jumped) => {
    if (state.mode === 'explain') story.feed(state.def, events, jumped);
  };
  dom.mode.addEventListener('change', () => applyMode(dom.mode.value as Mode, true));
  applyMode(state.mode, false);
}
