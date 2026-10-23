import { render } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { validateCompany, type CompanyDef } from '@office-pixel/sim';
import { emptyCompany } from './model';
import { EmpresaTab, AreasTab, PersonasTab } from './tabs';
import { ProcesosTab } from './procesos';
import { HorariosTab, YamlTab } from './extras';
import type { Up } from './ui';

type TabId = 'empresa' | 'areas' | 'personas' | 'procesos' | 'horarios' | 'yaml';

interface Props {
  initial: CompanyDef;
  example: () => CompanyDef;
  onApply: (d: CompanyDef) => void;
  onClose: () => void;
}

function ConfigApp({ initial, example, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<CompanyDef>(initial);
  const [tab, setTab] = useState<TabId>('empresa');
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

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'empresa', label: 'Empresa' },
    { id: 'areas', label: 'Áreas y subáreas', count: draft.units.length },
    { id: 'personas', label: 'Personas', count: draft.people.length },
    { id: 'procesos', label: 'Procesos', count: draft.processes.length },
    { id: 'horarios', label: 'Horarios y reuniones' },
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
          <button type="button" class="btn" onClick={() => replace(example, 'el ejemplo «Banco Pixel»')}>
            Cargar ejemplo
          </button>
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
            <button key={t.id} type="button" class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
              {t.count !== undefined && <span class="count">{t.count}</span>}
            </button>
          ))}
        </nav>
        <main class="cfg-main">
          {tab === 'empresa' && <EmpresaTab {...props} />}
          {tab === 'areas' && <AreasTab {...props} />}
          {tab === 'personas' && <PersonasTab {...props} />}
          {tab === 'procesos' && <ProcesosTab {...props} />}
          {tab === 'horarios' && <HorariosTab {...props} />}
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
