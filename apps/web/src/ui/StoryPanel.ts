import type { CompanyDef, OrgEvent } from '@office-pixel/sim';
import { narrate, type StoryLine } from '../application/narration';
import { fmtTime } from '../shared/format';

const MAX_LINES = 80;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

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
