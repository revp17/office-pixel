import { AUTO_ACTOR, unitPath, type CompanyDef, type OrgEvent } from '@office-pixel/sim';
import { fmtTime } from '../scene/orgScene';

export interface StoryLine {
  t: number;
  icon: string;
  text: string;
  /** para colorear: llega, trabajo, traspaso, problema, fin */
  kind: 'in' | 'work' | 'move' | 'warn' | 'end' | 'people';
}

const MAX_LINES = 80;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Convierte un hecho de la simulación en una frase que cualquiera entienda; null si no vale la pena contarlo. */
export function narrate(def: CompanyDef, ev: OrgEvent): StoryLine | null {
  const procOf = (id: string) => def.processes.find((p) => p.id === id);
  const stageLabel = (pid: string, sid: string) => procOf(pid)?.stages.find((s) => s.id === sid)?.label ?? sid;
  const who = (id: string) => (id === AUTO_ACTOR ? 'El sistema' : (def.people.find((p) => p.id === id)?.name ?? id));
  const caseName = (caseId: string) => {
    const [pid, n] = caseId.split('#');
    return `${procOf(pid)?.name ?? pid} n.º ${n}`;
  };
  const caseProc = (caseId: string) => caseId.split('#')[0];

  switch (ev.type) {
    case 'case.created': {
      const data = Object.entries(ev.attrs ?? {})
        .map(([k, v]) => `${k}: ${Number.isInteger(v) ? v : v.toFixed(1)}`)
        .join(', ');
      const from = ev.cause ? ` Nace porque terminó «${caseName(ev.cause)}».` : '';
      return { t: ev.t, icon: '📥', kind: 'in', text: `Llega un caso nuevo: ${caseName(ev.caseId)}${data ? ` (${data})` : ''}.${from}` };
    }
    case 'stage.entered': {
      const pid = caseProc(ev.caseId);
      const unit = procOf(pid)?.stages.find((s) => s.id === ev.stage)?.unit;
      return { t: ev.t, icon: '📌', kind: 'move', text: `«${caseName(ev.caseId)}» pasa a «${stageLabel(pid, ev.stage)}»${unit ? ` (${unitPath(def, unit)})` : ''} y espera a quien lo atienda.` };
    }
    case 'handoff.started':
      return {
        t: ev.t,
        icon: '🚶',
        kind: 'move',
        text: `El caso «${caseName(ev.caseId)}» viaja de ${unitPath(def, ev.fromUnit)} a ${unitPath(def, ev.toUnit)} (${ev.minutes} min).`,
      };
    case 'work.started':
      return { t: ev.t, icon: ev.person === AUTO_ACTOR ? '⚙️' : '🧑‍💼', kind: 'work', text: `${who(ev.person)} empieza «${stageLabel(caseProc(ev.caseId), ev.stage)}» del caso «${caseName(ev.caseId)}».` };
    case 'work.finished':
      return { t: ev.t, icon: '✅', kind: 'work', text: `${who(ev.person)} termina «${stageLabel(caseProc(ev.caseId), ev.stage)}».` };
    case 'work.paused':
      return { t: ev.t, icon: '⏸', kind: 'work', text: `${who(ev.person)} deja el trabajo a medias (fin de jornada, pausa o reunión); lo retoma después.` };
    case 'work.resumed':
      return { t: ev.t, icon: '▶️', kind: 'work', text: `${who(ev.person)} retoma el trabajo pendiente.` };
    case 'exception': {
      const rework = ev.exceptionId.startsWith('error:');
      return rework
        ? { t: ev.t, icon: '↩️', kind: 'warn', text: `${who(ev.exceptionId.slice(6))} cometió un error: la etapa «${stageLabel(caseProc(ev.caseId), ev.stage)}» se rehace.` }
        : { t: ev.t, icon: '⚠️', kind: 'warn', text: `Excepción «${ev.exceptionId}» en «${stageLabel(caseProc(ev.caseId), ev.stage)}»: el caso salta a «${stageLabel(caseProc(ev.caseId), ev.target)}».` };
    }
    case 'sla.breached':
      return { t: ev.t, icon: '⏰', kind: 'warn', text: `Se pasó el plazo (SLA) de «${stageLabel(caseProc(ev.caseId), ev.stage)}» en el caso «${caseName(ev.caseId)}».` };
    case 'case.completed':
      return { t: ev.t, icon: '🏁', kind: 'end', text: `El caso «${caseName(ev.caseId)}» termina en «${stageLabel(caseProc(ev.caseId), ev.stage)}».` };
    case 'person.state':
      if (ev.state === 'break') return { t: ev.t, icon: '☕', kind: 'people', text: `${who(ev.person)} sale a su pausa.` };
      if (ev.state === 'meeting') return { t: ev.t, icon: '🗣', kind: 'people', text: `${who(ev.person)} entra a una reunión.` };
      if (ev.state === 'absent') return { t: ev.t, icon: '🤒', kind: 'people', text: `${who(ev.person)} hoy no está (ausencia).` };
      return null;
    default:
      return null;
  }
}

/** Panel flotante «Qué está pasando» sobre el plano. */
export class StoryPanel {
  private lines: StoryLine[] = [];
  private body: HTMLElement;
  private count: HTMLElement;

  constructor(private root: HTMLElement) {
    root.innerHTML = `
      <header>
        <b>📖 Qué está pasando</b>
        <span class="count"></span>
        <button type="button" data-a="clear" title="Borrar el relato">Limpiar</button>
        <button type="button" data-a="fold" title="Plegar o desplegar">▾</button>
      </header>
      <div class="body" aria-live="polite"></div>`;
    this.body = root.querySelector('.body')!;
    this.count = root.querySelector('.count')!;
    root.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'clear') this.clear();
      if (a === 'fold') root.classList.toggle('folded');
    });
  }

  show(on: boolean) {
    this.root.hidden = !on;
  }

  clear() {
    this.lines = [];
    this.paint();
  }

  /** Añade hechos; si hubo un salto en el tiempo, empieza un relato nuevo. */
  feed(def: CompanyDef, events: OrgEvent[], jumped: boolean) {
    if (jumped) {
      this.lines = [];
      if (events.length > 60) return this.paint(`⏩ Se saltó en el tiempo (${events.length} hechos omitidos). El relato sigue desde aquí.`);
    }
    for (const ev of events) {
      const l = narrate(def, ev);
      if (l) this.lines.push(l);
    }
    if (this.lines.length > MAX_LINES) this.lines.splice(0, this.lines.length - MAX_LINES);
    this.paint();
  }

  private paint(note?: string) {
    const shown = this.lines.slice(-40);
    this.body.innerHTML =
      (note ? `<p class="note">${esc(note)}</p>` : '') +
      (shown.length || note ? '' : '<p class="note">Pulsa ▶ o «Siguiente paso» y aquí se irá contando, en palabras, qué hace cada persona con cada caso.</p>') +
      shown.map((l) => `<p class="line ${l.kind}"><time>${esc(fmtTime(l.t).replace(/^Día \d+ · /, ''))}</time><span>${l.icon}</span><em>${esc(l.text)}</em></p>`).join('');
    this.count.textContent = this.lines.length ? `${this.lines.length}` : '';
    this.body.scrollTop = this.body.scrollHeight;
  }
}
