import { DAY, simulateCompany, type CompanyDef } from '@office-pixel/sim';
import { escapeHtml } from '../shared/format';
import { closeConfig, openConfig, type TabId } from '../ui/config/ConfigApp';
import { closeHub, openHub } from '../ui/process/Hub';
import { TEMPLATES } from './templates';
import { $, dom } from './dom';
import { paintDetail, renderPanels } from './hud';
import { scene, story } from './sceneHost';
import { persist } from './services';
import { SAMPLE_PER_DAY, state } from './state';

/** El orquestador de la pantalla: simular, abrir la configuración o la gestión de procesos, cambiar de empresa. */

const emptyState = $<HTMLDivElement>('empty-state');
const CONTROLS = ['configure', 'processes', 'play', 'step', 'restart', 'simulate', 'fit'].map((id) => $<HTMLButtonElement>(id));

export const closeOverlays = () => {
  closeConfig(dom.configRoot);
  closeHub(dom.hubRoot);
};

const saveCompany = (d: CompanyDef, note?: string) => persist.save(d, note);

/** Días de la simulación según el campo de la barra (1 a 30). */
export const simDays = () => Math.min(30, Math.max(1, Math.trunc(Number(dom.days.value)) || 5));

/**
 * Simula la empresa. `next` la reemplaza y, salvo que `save` sea false (ya viene de la base de datos), la guarda.
 * Si `pv` viene, se simula esa variante (vista previa) en vez de la empresa guardada.
 */
export function run(next?: CompanyDef, pv?: { company: CompanyDef; label: string }, save = true) {
  if (!emptyState.hidden) setEmpty(false);
  if (next) {
    state.company = next;
    if (save) saveCompany(next);
  }
  state.preview = pv ?? null;
  dom.previewBanner.hidden = !state.preview;
  if (state.preview) dom.previewText.textContent = `Vista previa: ${state.preview.label}. No se guarda; la empresa real no ha cambiado.`;
  const seed = Math.trunc(Number(dom.seed.value)) || 0;
  const days = simDays();
  state.def = state.preview ? state.preview.company : state.company;
  state.result = simulateCompany(state.def, { seed, horizonDays: days, ...(state.mode === 'explain' ? { arrivalsPerDay: SAMPLE_PER_DAY } : {}) });
  story.clear();
  state.personEvents = new Map(state.def.people.map((p) => [p.id, []]));
  for (const e of state.result.events) if (e.type === 'person.state') state.personEvents.get(e.person)!.push({ t: e.t, state: e.state });
  dom.timeline.max = String(days * DAY);
  scene.setModel(state.def, state.result);
  // «cómo funciona» arranca en pausa: se avanza con ▶ o con «Siguiente paso»
  if (state.mode === 'explain') scene.playing = false;
  renderPanels();
  paintDetail(undefined, true);
}

/** Cambia a otra empresa de la base de datos y la simula. */
export async function switchTo(load: () => Promise<CompanyDef>) {
  closeOverlays();
  scene.playing = false;
  try {
    run(await load(), undefined, false);
  } catch (e) {
    alert((e as Error).message);
    persist.onList?.();
  }
}

/** Crea la primera empresa (o una nueva) con este contenido y la abre. */
export async function startWith(def: CompanyDef) {
  try {
    run(await persist.create(def), undefined, false);
  } catch (e) {
    alert((e as Error).message);
  }
}

/** Borra la empresa abierta; si era la última, la aplicación queda en cero. */
export async function removeCurrentCompany() {
  closeOverlays();
  scene.playing = false;
  try {
    const next = await persist.removeCurrent();
    if (next) run(next, undefined, false);
    else setEmpty(true);
  } catch (e) {
    alert((e as Error).message);
  }
}

/** «En cero»: todavía no hay ninguna empresa. Muestra la pantalla de bienvenida y apaga los controles. */
export function setEmpty(on: boolean) {
  emptyState.hidden = !on;
  for (const c of CONTROLS) c.disabled = on;
  if (on) {
    scene.playing = false;
    story.clear();
    for (const box of [dom.kpis, dom.units, dom.people, dom.chips]) box.innerHTML = '';
    dom.detail.innerHTML = '<p class="hint">Cuando crees tu primera empresa, aquí verás el detalle de cada persona.</p>';
    persist.onList?.();
  }
}

export const isEmpty = () => !emptyState.hidden;

export function showConfig(tab?: TabId) {
  scene.playing = false;
  openConfig(dom.configRoot, {
    initial: structuredClone(state.company),
    initialTab: tab,
    templates: TEMPLATES,
    onApply: (d) => {
      closeConfig(dom.configRoot);
      run(d);
    },
    onClose: () => closeConfig(dom.configRoot),
  });
}

// ---------- gestión de procesos (documentar, optimizar, ficha) ----------
export function showHub() {
  const wasPlaying = scene.playing;
  scene.playing = false;
  const keep = (d: CompanyDef) => {
    state.company = d;
    saveCompany(d);
  };
  openHub(dom.hubRoot, {
    initial: structuredClone(state.company),
    days: simDays(),
    // la ficha y la optimización no cambian lo que se simula: no hace falta volver a simular
    onSave: (d) => {
      closeHub(dom.hubRoot);
      keep(d);
      scene.playing = wasPlaying;
    },
    onPreview: (draft, variant, label) => {
      closeHub(dom.hubRoot);
      keep(draft);
      run(undefined, { company: variant, label });
    },
    onEditProcess: (draft) => {
      closeHub(dom.hubRoot);
      keep(draft);
      showConfig('procesos');
    },
    onClose: () => {
      closeHub(dom.hubRoot);
      scene.playing = wasPlaying;
    },
  });
}

/** Opciones de plantillas para un <select> (en la pantalla en cero). */
export const templateOptions = () => '<option value="">Elegir plantilla…</option>' + TEMPLATES.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('');
