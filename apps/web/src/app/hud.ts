import { DAY, type PersonState, type UnitDef } from '@office-pixel/sim';
import { dayRange } from '../application/dayRange';
import type { OrgHud } from '../scene/orgScene';
import { escapeHtml as esc, fmtMin, fmtTime, pct } from '../shared/format';
import { dom } from './dom';
import { SAMPLE_PER_DAY, state } from './state';
import { scene } from './sceneHost';

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

const nameOf = (id: string) => state.def.people.find((p) => p.id === id)?.name ?? id;

/** "Área › Subárea" a partir del id de una unidad. */
function unitLabel(id: string): string {
  const trail = (list: UnitDef[], path: string[]): string[] | undefined => {
    for (const u of list) {
      const p = [...path, u.name ?? u.id];
      if (u.id === id) return p;
      const r = u.children && trail(u.children, p);
      if (r) return r;
    }
  };
  return (trail(state.def.units, []) ?? [id]).join(' › ');
}

function flatUnits(list: UnitDef[], depth = 0): Array<{ u: UnitDef; depth: number }> {
  return list.flatMap((u) => [{ u, depth }, ...flatUnits(u.children ?? [], depth + 1)]);
}

// ---------- paneles de resultados ----------
export function renderPanels() {
  const { def, result } = state;
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
  dom.kpis.innerHTML = `
    <h3>Resultado (${m.horizonDays} ${m.horizonDays === 1 ? 'día' : 'días'}, semilla ${result.options.seed})</h3>
    ${state.mode === 'explain' ? `<p class="hint">Modo «cómo funciona»: una muestra de hasta ${SAMPLE_PER_DAY} casos por día en cada proceso. Para la carga real, cambia a «Semana completa».</p>` : ''}
    <table><tr><th>Proceso</th><th>Cerrados</th><th>Ciclo</th><th>P90</th><th>SLA</th></tr>${procRows}</table>
    <h3>Mayor espera por etapa</h3>
    <table><tr><th>Etapa</th><th>Espera</th><th>Cola final</th></tr>${waits}</table>
    <p class="hint">Tiempos en horas hábiles de la empresa.</p>`;

  dom.units.innerHTML =
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
  dom.people.innerHTML = `<h3>Personas</h3><div class="scroll"><table class="clickable"><tr><th>Nombre</th><th>Rol</th><th>Uso</th><th>Tareas</th></tr>${rows}</table></div>`;
  dom.people.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => scene.select((tr as HTMLElement).dataset.id, true)));
}

// ---------- detalle de la persona elegida ----------
export function paintDetail(h?: OrgHud, force = false) {
  const id = scene.selected;
  const detail = dom.detail;
  if (!id) {
    if (force) detail.innerHTML = '<p class="hint">Haz clic en una persona del edificio o de la lista para ver su día.</p>';
    return;
  }
  const p = state.def.people.find((x) => x.id === id)!;
  const s = state.result.metrics.byPerson[id];
  const t = h?.t ?? scene.simT;
  const st0 = h?.selectedState ?? 'off';
  const day = Math.floor(t / DAY);
  const range = dayRange(state.def);
  const from = day * DAY + range.from;
  const to = day * DAY + Math.min(range.to, DAY);
  const evs = state.personEvents.get(id) ?? [];
  const segs: string[] = [];
  let cur: PersonState = 'off';
  for (const e of evs) if (e.t <= from) cur = e.state;
  let start = from;
  const push = (a: number, b: number, st: PersonState) => {
    if (b <= a || st === 'off') return;
    segs.push(`<i title="${STATE_LABEL[st]}" style="left:${((a - from) / (to - from)) * 100}%;width:${((b - a) / (to - from)) * 100}%;background:${STATE_COLOR[st]}"></i>`);
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
    <h3>${p.kind === 'responsable' ? '★ ' : ''}${esc(p.name ?? p.id)} <small>${p.kind === 'responsable' ? 'Responsable' : 'Colaborador'} · ${esc(unitLabel(p.unit))}</small></h3>
    <p class="hint">Rol: ${esc(p.role)}</p>
    <p><span class="dot" style="background:${STATE_COLOR[st0]}"></span>${STATE_LABEL[st0]}${h?.selectedCase ? ` · caso <b>${esc(h.selectedCase)}</b>` : ''}</p>
    <p>Velocidad ${p.speed ?? 1} · error ${pct(p.errorRate ?? 0)} · jefe: ${p.reportsTo ? esc(nameOf(p.reportsTo)) : '—'}</p>
    <p>Utilización ${pct(s.utilization)} · ${s.tasks} tareas · ${fmtMin(s.workedMinutes)} trabajados</p>
    <div class="daybar">${segs.join('')}<u style="left:${nowPct}%"></u></div>
    <div class="dayaxis">${[0, 1, 2, 3, 4].map((i) => `<span>${String(Math.round((range.from + ((range.to - range.from) * i) / 4) / 60) % 24).padStart(2, '0')}</span>`).join('')}</div>
    <div class="legend"><span style="--c:#4aa3ff">trabajo</span><span style="--c:#8591ad">libre</span><span style="--c:#ffb020">pausa</span><span style="--c:#b06ab3">reunión</span><span style="--c:#ff5a4a">ausente</span></div>`;
}

// ---------- HUD en vivo (reloj, progreso, detalle) ----------
let lastPlaying = false;
let lastHudPaint = 0;

export function bindHud() {
  scene.onHud = (h: OrgHud) => {
    dom.clock.textContent = fmtTime(h.t);
    if (document.activeElement !== dom.timeline) dom.timeline.value = String(h.t);
    const c = h.counters;
    const p = c.created ? (c.completed / c.created) * 100 : 0;
    dom.fill.style.width = `${p}%`;
    dom.progressText.textContent =
      `Casos ${c.completed}/${c.created} cerrados (${p.toFixed(0)}%) · en cola ${h.queued} · ` +
      `presentes ${h.present}/${h.total} · SLA rotos ${c.breaches} · excepciones ${c.exceptions} · traspasos ${c.handoffs}`;
    if (h.playing !== lastPlaying) {
      lastPlaying = h.playing;
      dom.play.textContent = h.playing ? '⏸ Pausar' : '▶ Reproducir';
    }
    const now = performance.now();
    if (now - lastHudPaint > 250) {
      lastHudPaint = now;
      paintDetail(h);
    }
  };
  scene.onSelect = () => paintDetail(undefined, true);
}
