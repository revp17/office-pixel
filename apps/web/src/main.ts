import './style.css';
import Phaser from 'phaser';
import {
  DAY,
  parseCompany,
  simulateCompany,
  type CompanyDef,
  type OrgSimResult,
  type PersonState,
  type UnitDef,
} from '@office-pixel/sim';
import defaultYaml from '../../../examples/banco_pixel.yaml?raw';
import { OrgScene, fmtTime, type OrgHud } from './orgScene';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const yamlBox = $<HTMLTextAreaElement>('yaml');
const seedInput = $<HTMLInputElement>('seed');
const daysInput = $<HTMLInputElement>('days');
const errorsList = $<HTMLUListElement>('errors');
const playBtn = $<HTMLButtonElement>('play');
const speedSel = $<HTMLSelectElement>('speed');
const timeline = $<HTMLInputElement>('timeline');
const clock = $<HTMLSpanElement>('clock');
const fill = $<HTMLDivElement>('progress-fill');
const progressText = $<HTMLSpanElement>('progress-text');
const kpis = $<HTMLElement>('kpis');
const unitsBox = $<HTMLElement>('units');
const peopleBox = $<HTMLElement>('people');
const detail = $<HTMLElement>('detail');

yamlBox.value = defaultYaml;

const scene = new OrgScene();
new Phaser.Game({
  type: Phaser.CANVAS, // 2D puro: sin dependencia de WebGL/framebuffers
  parent: 'game',
  backgroundColor: '#12151d',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene,
});

let def: CompanyDef;
let result: OrgSimResult;
let lastPlaying = false;
let lastHudPaint = 0;
let personEvents = new Map<string, Array<{ t: number; state: PersonState }>>();

const fmtMin = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(0)} min`);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const nameOf = (id: string) => def.people.find((p) => p.id === id)?.name ?? id;
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

const STATE_LABEL: Record<PersonState, string> = {
  off: 'fuera de jornada',
  idle: 'libre',
  working: 'trabajando',
  break: 'en pausa',
  meeting: 'en reunión',
  absent: 'ausente',
};
const STATE_COLOR: Record<PersonState, string> = {
  off: 'transparent',
  idle: '#8591ad',
  working: '#4aa3ff',
  break: '#ffb020',
  meeting: '#b06ab3',
  absent: '#ff5a4a',
};

// ---------- HUD en vivo ----------
scene.onHud = (h: OrgHud) => {
  clock.textContent = fmtTime(h.t);
  if (document.activeElement !== timeline) timeline.value = String(h.t);
  const c = h.counters;
  const p = c.created ? (c.completed / c.created) * 100 : 0;
  fill.style.width = `${p}%`;
  progressText.textContent =
    `Casos ${c.completed}/${c.created} cerrados (${p.toFixed(0)}%) · en cola ${h.queued} · ` +
    `presentes ${h.present}/${h.total} · SLA rotos ${c.breaches} · excepciones ${c.exceptions} · traspasos ${c.handoffs}`;
  if (h.playing !== lastPlaying) {
    lastPlaying = h.playing;
    playBtn.textContent = h.playing ? '⏸ Pausar' : '▶ Reproducir';
  }
  const now = performance.now();
  if (now - lastHudPaint > 250) {
    lastHudPaint = now;
    paintDetail(h);
  }
};

scene.onSelect = () => paintDetail(undefined, true);

// ---------- paneles ----------
function flatUnits(list: UnitDef[], depth = 0): Array<{ u: UnitDef; depth: number }> {
  return list.flatMap((u) => [{ u, depth }, ...flatUnits(u.children ?? [], depth + 1)]);
}

function renderPanels() {
  const m = result.metrics;
  const procRows = Object.entries(m.byProcess)
    .map(
      ([id, s]) =>
        `<tr><td>${esc(def.processes.find((p) => p.id === id)?.name ?? id)}</td><td>${s.completed}/${s.created}</td><td>${fmtMin(s.cycleAvg)}</td><td>${fmtMin(s.cycleP90)}</td><td class="${s.slaBreaches ? 'bad' : ''}">${s.slaBreaches}</td></tr>`,
    )
    .join('');
  const waits = Object.entries(m.byStage)
    .sort((a, b) => b[1].waitAvg - a[1].waitAvg)
    .slice(0, 4)
    .map(([k, s]) => {
      const [pid, sid] = k.split('.');
      const st = def.processes.find((p) => p.id === pid)?.stages.find((s2) => s2.id === sid);
      return `<tr><td>${esc(st?.label ?? sid)}</td><td>${fmtMin(s.waitAvg)}</td><td>${s.queueAtEnd}</td></tr>`;
    })
    .join('');
  kpis.innerHTML = `
    <h3>Resultado (${m.horizonDays} días, semilla ${result.options.seed})</h3>
    <table><tr><th>Proceso</th><th>Cerrados</th><th>Ciclo</th><th>P90</th><th>SLA</th></tr>${procRows}</table>
    <h3>Mayor espera por etapa</h3>
    <table><tr><th>Etapa</th><th>Espera</th><th>Cola final</th></tr>${waits}</table>
    <p class="hint">Tiempos en horas hábiles de la empresa.</p>`;

  unitsBox.innerHTML =
    `<h3>Utilización por unidad</h3>` +
    flatUnits(def.units)
      .filter(({ u }) => m.byUnit[u.id]?.headcount)
      .map(({ u, depth }) => {
        const v = m.byUnit[u.id];
        const cls = v.utilization > 0.85 ? 'hot' : v.utilization > 0.7 ? 'warm' : '';
        return `<div class="ubar" style="padding-left:${depth * 10}px"><span>${esc(u.name ?? u.id)} <i>(${v.headcount})</i></span><div class="track"><div class="${cls}" style="width:${pct(v.utilization)}"></div></div><b>${pct(v.utilization)}</b></div>`;
      })
      .join('');

  const rows = def.people
    .map((p) => ({ p, s: m.byPerson[p.id] }))
    .sort((a, b) => b.s.utilization - a.s.utilization)
    .map(
      ({ p, s }) =>
        `<tr data-id="${p.id}"><td>${esc(p.name ?? p.id)}</td><td>${esc(p.role)}</td><td>${pct(s.utilization)}</td><td>${s.tasks}</td></tr>`,
    )
    .join('');
  peopleBox.innerHTML = `<h3>Personas</h3><div class="scroll"><table class="clickable"><tr><th>Nombre</th><th>Rol</th><th>Uso</th><th>Tareas</th></tr>${rows}</table></div>`;
  peopleBox.querySelectorAll('tr[data-id]').forEach((tr) =>
    tr.addEventListener('click', () => scene.select((tr as HTMLElement).dataset.id, true)),
  );
}

function paintDetail(h?: OrgHud, force = false) {
  const id = scene.selected;
  if (!id) {
    if (force) detail.innerHTML = '<p class="hint">Haz clic en una persona del edificio o de la lista para ver su día.</p>';
    return;
  }
  const p = def.people.find((x) => x.id === id)!;
  const s = result.metrics.byPerson[id];
  const t = h?.t ?? scene.simT;
  const state = h?.selectedState ?? 'off';
  const day = Math.floor(t / DAY);
  const from = day * DAY + 6 * 60;
  const to = day * DAY + 22 * 60;
  const evs = personEvents.get(id) ?? [];
  const segs: string[] = [];
  let cur: PersonState = 'off';
  for (const e of evs) if (e.t <= from) cur = e.state;
  let start = from;
  const push = (a: number, b: number, st: PersonState) => {
    if (b <= a || st === 'off') return;
    segs.push(
      `<i title="${STATE_LABEL[st]}" style="left:${((a - from) / (to - from)) * 100}%;width:${((b - a) / (to - from)) * 100}%;background:${STATE_COLOR[st]}"></i>`,
    );
  };
  for (const e of evs) {
    if (e.t <= from || e.t >= to) continue;
    push(start, e.t, cur);
    start = e.t;
    cur = e.state;
  }
  push(start, to, cur);
  const nowPct = Math.min(100, Math.max(0, ((t - from) / (to - from)) * 100));
  detail.innerHTML = `
    <h3>${esc(p.name ?? p.id)} <small>${esc(p.role)} · ${esc(p.unit)}</small></h3>
    <p><span class="dot" style="background:${STATE_COLOR[state]}"></span>${STATE_LABEL[state]}${h?.selectedCase ? ` · caso <b>${esc(h.selectedCase)}</b>` : ''}</p>
    <p>Velocidad ${p.speed ?? 1} · error ${pct(p.errorRate ?? 0)} · jefe: ${p.reportsTo ? esc(nameOf(p.reportsTo)) : '—'}</p>
    <p>Utilización ${pct(s.utilization)} · ${s.tasks} tareas · ${fmtMin(s.workedMinutes)} trabajados</p>
    <div class="daybar">${segs.join('')}<u style="left:${nowPct}%"></u></div>
    <div class="dayaxis"><span>06</span><span>10</span><span>14</span><span>18</span><span>22</span></div>
    <div class="legend"><span style="--c:#4aa3ff">trabajo</span><span style="--c:#8591ad">libre</span><span style="--c:#ffb020">pausa</span><span style="--c:#b06ab3">reunión</span><span style="--c:#ff5a4a">ausente</span></div>`;
}

// ---------- simulación ----------
function run() {
  const parsed = parseCompany(yamlBox.value);
  errorsList.innerHTML = parsed.errors.map((e) => `<li>• ${esc(e)}</li>`).join('');
  if (!parsed.def) return;
  const seed = Math.trunc(Number(seedInput.value)) || 0;
  const days = Math.min(30, Math.max(1, Math.trunc(Number(daysInput.value)) || 5));
  def = parsed.def;
  result = simulateCompany(def, { seed, horizonDays: days });
  personEvents = new Map(def.people.map((p) => [p.id, []]));
  for (const e of result.events) if (e.type === 'person.state') personEvents.get(e.person)!.push({ t: e.t, state: e.state });
  timeline.max = String(days * DAY);
  scene.setModel(def, result);
  renderPanels();
  paintDetail(undefined, true);
}

$('apply').addEventListener('click', run);
$('restart').addEventListener('click', () => {
  scene.seek(0);
  scene.playing = true;
});
$('fit').addEventListener('click', () => scene.fit());
const app = $('app');
if (window.innerWidth < 1000) app.classList.add('collapsed');
$('toggle-studio').addEventListener('click', () => {
  app.classList.toggle('collapsed');
  // el canvas cambia de tamaño: reencuadrar tras el reflujo
  setTimeout(() => scene.fit(), 50);
});
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
