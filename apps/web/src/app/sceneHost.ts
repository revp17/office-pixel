import Phaser from 'phaser';
import { OrgScene } from '../scene/orgScene';
import { StoryPanel } from '../ui/StoryPanel';
import { escapeHtml } from '../shared/format';
import { $, dom } from './dom';

export const scene = new OrgScene();
export const story = new StoryPanel($('story'));

// Render a la resolución real de la pantalla (devicePixelRatio) y mostrarlo a tamaño CSS:
// así formas y texto salen nítidos en pantallas HiDPI en vez de verse "pixelados".
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const host = dom.game;
const game = new Phaser.Game({
  type: Phaser.CANVAS, // 2D puro: sin dependencia de WebGL/framebuffers
  parent: host,
  backgroundColor: '#0e1117',
  width: Math.max(2, Math.round(host.clientWidth * dpr)),
  height: Math.max(2, Math.round(host.clientHeight * dpr)),
  scale: { mode: Phaser.Scale.NONE, zoom: 1 / dpr },
  render: { pixelArt: false, antialias: true, roundPixels: false },
  scene,
});
new ResizeObserver(() => {
  const w = Math.round(host.clientWidth * dpr);
  const h = Math.round(host.clientHeight * dpr);
  if (w > 1 && h > 1) game.scale.resize(w, h);
}).observe(host);

// ---------- plantas (chips de áreas) ----------
export function renderFloorChips() {
  const chips = dom.chips;
  chips.innerHTML =
    `<button data-f="-1" class="chip on">Planta completa</button>` +
    scene.areaNames.map((n, i) => `<button data-f="${i}" class="chip">${escapeHtml(n)}</button>`).join('');
  chips.querySelectorAll<HTMLButtonElement>('button').forEach((btn) =>
    btn.addEventListener('click', () => {
      chips.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      btn.classList.add('on');
      scene.focusArea(Number(btn.dataset.f));
    }),
  );
}

// ---------- disposición de las plantas (vertical / horizontal) ----------
const LAYOUT_KEY = 'office-pixel.layout.v1';
type Orient = 'vertical' | 'horizontal';
const layoutBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('#layout button'));

function paintLayout(o: Orient) {
  layoutBtns.forEach((b) => b.classList.toggle('on', b.dataset.o === o));
}
function savedLayout(): Orient {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'horizontal' ? 'horizontal' : 'vertical';
  } catch {
    return 'vertical';
  }
}
function setLayout(o: Orient) {
  scene.setOrientation(o);
  paintLayout(o);
  try {
    localStorage.setItem(LAYOUT_KEY, o);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}

/** Conecta la escena con los chips de plantas y los botones de disposición. */
export function bindSceneHost() {
  scene.onModel = renderFloorChips;
  layoutBtns.forEach((b) => b.addEventListener('click', () => setLayout(b.dataset.o as Orient)));
  const o = savedLayout();
  scene.setOrientation(o); // antes de que la escena esté lista: solo fija la disposición inicial
  paintLayout(o);
}
