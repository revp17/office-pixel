import './style.css';
import Phaser from 'phaser';
import { parseProcess, simulate, type ProcessDef, type SimResult } from '@office-pixel/sim';
import defaultYaml from '../../../examples/aprobacion_credito.yaml?raw';
import { ProcessScene, type HudState } from './scene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yamlBox = $<HTMLTextAreaElement>('yaml');
const seedInput = $<HTMLInputElement>('seed');
const horizonInput = $<HTMLInputElement>('horizon');
const errorsList = $<HTMLUListElement>('errors');
const playBtn = $<HTMLButtonElement>('play');
const speedSel = $<HTMLSelectElement>('speed');
const timeline = $<HTMLInputElement>('timeline');
const clock = $<HTMLSpanElement>('clock');
const fill = $<HTMLDivElement>('progress-fill');
const progressText = $<HTMLSpanElement>('progress-text');
const metricsBox = $<HTMLElement>('metrics');

yamlBox.value = defaultYaml;

const scene = new ProcessScene();
new Phaser.Game({
  type: Phaser.CANVAS, // 2D puro: sin dependencia de WebGL/framebuffers
  parent: 'game',
  backgroundColor: '#12151d',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene,
});

const fmtClock = (t: number) => `${Math.floor(t / 60)}h ${String(Math.floor(t % 60)).padStart(2, '0')}m`;
const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(1)} min`);

let lastPlaying = false;

scene.onHud = (h: HudState) => {
  clock.textContent = fmtClock(h.t);
  if (document.activeElement !== timeline) timeline.value = String(h.t);
  const pct = h.created ? (h.completed / h.created) * 100 : 0;
  fill.style.width = `${pct}%`;
  progressText.textContent = `Completados ${h.completed}/${h.created} (${pct.toFixed(0)}%) · SLA rotos ${h.breaches} · Excepciones ${h.exceptions}`;
  if (h.playing !== lastPlaying) {
    lastPlaying = h.playing;
    playBtn.textContent = h.playing ? '⏸ Pausar' : '▶ Reproducir';
  }
};

function renderMetrics(def: ProcessDef, r: SimResult) {
  const m = r.metrics;
  const rows = (pairs: Array<[string, string]>) =>
    `<table>${pairs.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  const label = (id: string) => def.stages.find((s) => s.id === id)?.label ?? id;
  metricsBox.innerHTML = `
    <div><h3>Resultado final (${fmtClock(m.horizonMinutes)}, semilla ${r.options.seed})</h3>${rows([
      ['Casos creados', String(m.created)],
      ['Completados', String(m.completed)],
      ['En curso', String(m.inFlight)],
      ['Throughput', `${m.throughputPerHour.toFixed(2)} /h`],
      ['Ciclo medio', fmtMin(m.cycleTimeAvg)],
      ['Ciclo P90', fmtMin(m.cycleTimeP90)],
      ['SLA incumplidos', String(m.slaBreaches)],
    ])}</div>
    <div><h3>Espera media por etapa</h3>${rows(
      Object.entries(m.waitByStage).map(([k, w]) => [label(k), `${fmtMin(w.avg)} (${w.count})`]),
    )}</div>
    <div><h3>Utilización de recursos</h3>${rows(
      Object.entries(m.utilization).map(([k, u]) => [k, `${(u * 100).toFixed(0)}%`]),
    )}</div>
    <div><h3>Excepciones</h3>${rows(
      Object.keys(m.exceptions).length
        ? Object.entries(m.exceptions).map(([k, n]): [string, string] => [k, String(n)])
        : [['—', '0']],
    )}</div>`;
}

function run() {
  const parsed = parseProcess(yamlBox.value);
  errorsList.innerHTML = parsed.errors.map((e) => `<li>• ${e}</li>`).join('');
  if (!parsed.def) return;
  const seed = Math.trunc(Number(seedInput.value)) || 0;
  const horizon = Math.max(10, Number(horizonInput.value) || 480);
  const result = simulate(parsed.def, { seed, horizonMinutes: horizon });
  timeline.max = String(horizon);
  scene.setModel(parsed.def, result);
  renderMetrics(parsed.def, result);
}

$('apply').addEventListener('click', run);
$('restart').addEventListener('click', () => {
  scene.seek(0);
  scene.playing = true;
});
$('fit').addEventListener('click', () => scene.fit());
playBtn.addEventListener('click', () => {
  if (scene.simT >= Number(timeline.max)) scene.seek(0);
  scene.playing = !scene.playing;
});
speedSel.addEventListener('change', () => (scene.speed = Number(speedSel.value)));
timeline.addEventListener('input', () => {
  scene.playing = false;
  scene.seek(Number(timeline.value));
});
scene.speed = Number(speedSel.value);

if (import.meta.env.DEV) (window as unknown as { __op: unknown }).__op = { scene };

run();
