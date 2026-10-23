import { companyToYaml } from '@office-pixel/sim';
import { emptyCompany } from '../application/editing/model';
import { escapeHtml as esc, fmtDateTime } from '../shared/format';
import { $ } from './dom';
import { closeOverlays, removeCurrentCompany, run, switchTo } from './controller';
import { backend, persist } from './services';
import { state } from './state';

/** El selector de empresas, su menú «⋯», el indicador de guardado y las versiones anteriores. */

const companyPick = $<HTMLSelectElement>('company-pick');
const companyMenu = $<HTMLButtonElement>('company-menu');
const companyActions = $<HTMLDivElement>('company-actions');
const dbStatus = $<HTMLSpanElement>('db-status');

const STATUS_TEXT: Record<string, string> = {
  checking: 'Conectando…',
  db: backend.kind === 'nhost' ? '☁ Guardado en Nhost' : '💾 Guardado en la base de datos',
  saving: '⏳ Guardando…',
  local: '⚠ Solo en este navegador',
  error: '⚠ No se pudo guardar',
};

/** Descarga la empresa abierta como archivo .yaml. */
export function downloadBackup() {
  const blob = new Blob([companyToYaml(state.company)], { type: 'text/yaml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${state.company.company.replace(/[^\w-]+/g, '_') || 'empresa'}_copia.yaml`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function showVersions() {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML =
    '<div class="modal" role="dialog" aria-label="Versiones anteriores"><h3>🕘 Versiones anteriores</h3><p class="muted">Cada vez que aplicas un cambio se guarda la versión anterior (las últimas 40).</p><div class="revlist"><p class="muted">Cargando…</p></div><div class="modal-actions"><button type="button" class="btn" data-a="close">Cerrar</button></div></div>';
  document.body.append(back);
  const close = () => back.remove();
  back.addEventListener('click', (e) => {
    if (e.target === back || (e.target as HTMLElement).dataset.a === 'close') close();
  });
  persist
    .revisions()
    .then((list) => {
      const box = back.querySelector('.revlist')!;
      box.innerHTML = list.length
        ? list
            .map(
              (r) =>
                `<div class="rev"><span><b>Versión ${r.version}</b> · ${esc(r.name)}<small>${fmtDateTime(r.savedAt)}${r.note ? ' · ' + esc(r.note) : ''} · ${Math.round(r.bytes / 1024)} KB</small></span><button type="button" class="btn" data-restore="${r.id}">Restaurar</button></div>`,
            )
            .join('')
        : '<p class="muted">Todavía no hay versiones anteriores: aparecen cuando guardas un cambio.</p>';
      box.addEventListener('click', (e) => {
        const id = (e.target as HTMLElement).dataset.restore;
        if (!id) return;
        if (!confirm('Se restaura esa versión. La que tienes ahora queda en el historial. ¿Continuar?')) return;
        close();
        void switchTo(() => persist.restore(Number(id)));
      });
    })
    .catch((e: Error) => {
      back.querySelector('.revlist')!.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
    });
}

export function bindCompanyMenu() {
  dbStatus.addEventListener('click', () => {
    // con un aviso naranja, un clic muestra el motivo completo
    if ((persist.status === 'local' || persist.status === 'error') && persist.detail) alert(persist.detail);
  });
  persist.onStatus = () => {
    dbStatus.className = `dbstatus ${persist.status}`;
    dbStatus.textContent = STATUS_TEXT[persist.status];
    dbStatus.title =
      persist.detail ||
      (persist.status === 'db' ? `Todo lo que aplicas se guarda en ${backend.label}${backend.account?.user ? ` (cuenta ${backend.account.user.email})` : ''}.` : '');
  };
  persist.onList = () => {
    companyPick.innerHTML = persist.list.length ? persist.list.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('') : '<option value="">(sin empresas)</option>';
    companyPick.value = persist.currentId ?? '';
    companyPick.disabled = !persist.online || !persist.list.length;
    companyMenu.disabled = !persist.online || !persist.currentId;
  };
  persist.onConflict = async (cur) => {
    const overwrite = confirm(
      `La empresa «${cur.name}» se guardó desde otra pestaña el ${fmtDateTime(cur.updatedAt)} (versión ${cur.version}).\n\nAceptar = guardar lo que ves aquí y reemplazar ese cambio (la versión anterior queda en el historial).\nCancelar = descartar lo de aquí y abrir lo que se guardó.`,
    );
    return overwrite ? 'overwrite' : 'reload';
  };
  persist.onReloaded = (d) => {
    closeOverlays();
    run(d, undefined, false);
  };
  persist.onStatus();
  persist.onList();

  companyPick.addEventListener('change', () => void switchTo(() => persist.open(companyPick.value)));
  companyMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    companyActions.hidden = !companyActions.hidden;
  });
  document.addEventListener('click', () => (companyActions.hidden = true));

  companyActions.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (!a) return;
    if (a === 'new') void switchTo(() => persist.create(emptyCompany()));
    if (a === 'dup') void switchTo(() => persist.duplicate());
    if (a === 'versions') showVersions();
    if (a === 'backup') downloadBackup();
    if (a === 'delete') {
      if (!confirm(`¿Borrar la empresa «${state.company.company}» de la base de datos, con todo su historial? No se puede deshacer.\n\nTe recomiendo descargar antes una copia (⋯ → Descargar copia).`)) return;
      void removeCurrentCompany();
    }
  });
}
