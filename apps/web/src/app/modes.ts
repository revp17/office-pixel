import { dom } from './dom';
import { run } from './controller';
import { scene, story } from './sceneHost';
import { restoreSimPrefs, setSimFields } from './simPrefs';
import { MODE_DEFAULTS, state, type Mode } from './state';

/** Dos modos de ver la simulación: «cómo funciona» (despacio, pocos casos, con relato) o «semana completa». */

export function applyMode(m: Mode, rerun: boolean): Promise<void> {
  state.mode = m;
  dom.mode.value = m;
  const explain = m === 'explain';
  setSimFields(MODE_DEFAULTS[m]);
  scene.skipIdle = explain;
  story.show(explain);
  dom.step.hidden = !explain;
  // lo guardado de esta empresa en este modo reemplaza los valores por defecto antes de simular
  return restoreSimPrefs().then(() => {
    if (rerun) run();
  });
}

export function bindModes(onModeChosen: (m: Mode) => void) {
  scene.onEvents = (events, jumped) => {
    if (state.mode === 'explain') story.feed(state.def, events, jumped);
  };
  dom.mode.addEventListener('change', () => {
    const m = dom.mode.value as Mode;
    void applyMode(m, true);
    onModeChosen(m);
  });
  void applyMode('explain', false); // modo inicial; el guardado de la cuenta se aplica al abrir la base de datos
}
