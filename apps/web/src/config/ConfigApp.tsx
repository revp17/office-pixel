import { render } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { validateCompany, type CompanyDef } from '@office-pixel/sim';
import { emptyCompany } from './model';
import { CatalogoTab } from './catalogoTab';
import { EmpresaTab, AreasTab, PersonasTab } from './tabs';
import { ProcesosTab } from './procesos';
import { YamlTab } from './extras';
import type { Up } from './ui';

export type TabId = 'empresa' | 'areas' | 'catalogo' | 'personas' | 'procesos' | 'yaml';

interface Props {
  initial: CompanyDef;
  initialTab?: TabId;
  templates: Array<{ id: string; label: string; make: () => CompanyDef }>;
  onApply: (d: CompanyDef) => void;
  onClose: () => void;
}

function ConfigApp({ initial, initialTab, templates, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<CompanyDef>(initial);
  const [tab, setTab] = useState<TabId>(initialTab ?? 'empresa');
  const [toast, setToast] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const errors = useMemo(() => validateCompany(draft).errors, [draft]);

  const up: Up = (fn) =>
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const note = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? '' : t)), 4500);
  };

  const replace = (make: () => CompanyDef, what: string) => {
    if (confirm(`Esto reemplaza lo que hay ahora en el formulario por ${what}. ¿Continuar?`)) setDraft(make());
  };

  const tabs: Array<{ id: TabId; label: string; count?: number; sub?: boolean }> = [
    { id: 'empresa', label: 'Empresa' },
    { id: 'catalogo', label: 'Instalaciones', sub: true },
    { id: 'areas', label: 'Áreas y subáreas', count: draft.units.length, sub: true },
    { id: 'personas', label: 'Personas', count: draft.people.length },
    { id: 'procesos', label: 'Procesos', count: draft.processes.length },
    { id: 'yaml', label: 'YAML (avanzado)' },
  ];
  const props = { d: draft, up, note };

  return (
    <div class="cfg">
      <header class="cfg-head">
        <h2>
          Configurar empresa <small>{draft.company}</small>
        </h2>
        <div class="cfg-head-actions">
          <select
            class="btn"
            title="Cargar una empresa de ejemplo"
            value=""
            onChange={(e) => {
              const t = templates.find((q) => q.id === e.currentTarget.value);
              e.currentTarget.value = '';
              if (t) replace(t.make, `«${t.label}»`);
            }}
          >
            <option value="">Cargar plantilla…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button type="button" class="btn" onClick={() => replace(emptyCompany, 'una empresa en blanco')}>
            Empezar en blanco
          </button>
          <button type="button" class="btn" onClick={onClose} title="Cerrar sin aplicar">
            ✕
          </button>
        </div>
      </header>

      <div class="cfg-body">
        <nav class="cfg-nav">
          {tabs.map((t) => (
            <button key={t.id} type="button" class={`${tab === t.id ? 'on' : ''}${t.sub ? ' sub' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.count !== undefined && <span class="count">{t.count}</span>}
            </button>
          ))}
        </nav>
        <main class="cfg-main">
          {tab === 'empresa' && <EmpresaTab {...props} />}
          {tab === 'areas' && <AreasTab {...props} />}
          {tab === 'catalogo' && <CatalogoTab {...props} />}
          {tab === 'personas' && <PersonasTab {...props} />}
          {tab === 'procesos' && <ProcesosTab {...props} />}
          {tab === 'yaml' && <YamlTab d={draft} setDraft={setDraft} />}
        </main>
      </div>

      <footer class="cfg-foot">
        <div class="status">
          {errors.length === 0 ? (
            <span class="ok">✔ Todo listo para simular</span>
          ) : (
            <button type="button" class="errbtn" onClick={() => setShowErrors(!showErrors)}>
              ⚠ {errors.length} {errors.length === 1 ? 'problema' : 'problemas'} por resolver {showErrors ? '▾' : '▸'}
            </button>
          )}
          {toast && <span class="toast">{toast}</span>}
        </div>
        <div class="foot-actions">
          <button type="button" class="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" class="btn primary" disabled={errors.length > 0} onClick={() => onApply(draft)}>
            Aplicar y simular
          </button>
        </div>
        {showErrors && errors.length > 0 && (
          <ul class="errs">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}
      </footer>
    </div>
  );
}

export function openConfig(root: HTMLElement, props: Props) {
  root.classList.add('open');
  render(<ConfigApp {...props} />, root);
}

export function closeConfig(root: HTMLElement) {
  render(null, root);
  root.classList.remove('open');
}
