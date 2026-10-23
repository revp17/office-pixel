import { parseCompany } from '@office-pixel/sim';
import { emptyCompany } from '../application/editing/model';
import { $ } from './dom';
import { startWith, templateOptions } from './controller';
import { TEMPLATES } from './templates';

/** La pantalla «Todavía no tienes ninguna empresa»: empezar en blanco, con una plantilla o importando un archivo. */
export function bindEmptyState() {
  const template = $<HTMLSelectElement>('empty-template');
  const file = $<HTMLInputElement>('empty-file');
  template.innerHTML = templateOptions();
  $('empty-blank').addEventListener('click', () => void startWith(emptyCompany()));
  template.addEventListener('change', () => {
    const t = TEMPLATES.find((q) => q.id === template.value);
    template.value = '';
    if (t) void startWith(t.make());
  });
  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (!chosen) return;
    const r = parseCompany(await chosen.text());
    if (!r.def) return alert(`El archivo no es una empresa válida:\n- ${r.errors.slice(0, 5).join('\n- ')}`);
    void startWith(r.def);
  });
}
