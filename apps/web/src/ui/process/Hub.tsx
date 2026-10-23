import { render } from 'preact';
import { useState } from 'preact/hooks';
import { PHASES, currentStep, phasesDone, stepCompleted, type CompanyDef, type OrgProcessDef, type PhaseKey } from '@office-pixel/sim';
import { DependenciasView } from './depmap';
import { Documentar, type HubCtx } from './documentar';
import { FichaView } from './fichaView';
import { Optimizar } from './optimizar';
import { Procedimientos } from './procedimientos';
import { useDraftSaver } from '../draft';

type Mode = 'documentar' | 'optimizar' | 'procedimientos' | 'dependencias' | 'ficha';

export interface HubProps {
  initial: CompanyDef;
  /** días y semillas con que se mide el proceso */
  days: number;
  /** el borrador cambió (se guarda para no perderlo) */
  onDraft?: (d: CompanyDef) => void;
  onSave: (d: CompanyDef) => void;
  /** simula una variante en el plano; recibe el borrador (para no perderlo), la variante y su nombre */
  onPreview: (draft: CompanyDef, variant: CompanyDef, label: string) => void;
  onEditProcess: (d: CompanyDef, procId: string) => void;
  onClose: () => void;
}

const SEEDS = [1, 2, 3];

function stepsDone(p: OrgProcessDef) {
  return [1, 2, 3, 4, 5].filter((n) => stepCompleted(p, n)).length;
}

function Hub(props: HubProps) {
  const [draft, setDraft] = useState<CompanyDef>(props.initial);
  const [dirty, setDirty] = useState(false);
  useDraftSaver(draft, props.onDraft);
  const [sel, setSel] = useState(props.initial.processes[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>('documentar');
  const [phase, setPhase] = useState<PhaseKey>('alcance');
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState('');

  const proc = draft.processes.find((p) => p.id === sel) ?? draft.processes[0];
  const today = new Date().toISOString().slice(0, 10);

  const note = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? '' : t)), 4500);
  };

  const ctx: HubCtx | null = proc
    ? {
        d: draft,
        proc,
        note,
        today,
        sim: { seeds: SEEDS, days: props.days },
        P: (fn) => {
          setDraft((prev) => {
            const c = structuredClone(prev);
            const p = c.processes.find((q) => q.id === proc.id);
            if (p) fn(p, c);
            return c;
          });
          setDirty(true);
        },
        goFicha: () => setMode('ficha'),
        goStep: setStep,
        editProcess: () => props.onEditProcess(draft, proc.id),
      }
    : null;

  const close = () => {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) return;
    props.onClose();
  };

  const choose = (id: string) => {
    setSel(id);
    const p = draft.processes.find((q) => q.id === id);
    if (p) setStep(currentStep(p) ?? 5);
  };

  return (
    <div class="cfg hub">
      <header class="cfg-head">
        <h2>
          Gestión de procesos <small>{draft.company}</small>
        </h2>
        <div class="cfg-head-actions">
          <button type="button" class="btn primary" onClick={() => props.onSave(draft)}>
            Guardar y cerrar
          </button>
          <button type="button" class="btn" onClick={close} title="Cerrar sin guardar">
            ✕
          </button>
        </div>
      </header>

      <div class="cfg-body hub-body">
        <nav class="cfg-nav hub-list">
          <h4>Procesos</h4>
          {draft.processes.map((p, i) => (
            <button key={p.id} type="button" class={p.id === proc?.id ? 'on' : ''} onClick={() => choose(p.id)}>
              <span class="pname">
                <b class="procnum">{i + 1}.</b> {p.name ?? p.id}
              </span>
              <span class="prog">
                <span title="Fases de documentación">Doc {phasesDone(p)}/5</span>
                <span title="Pasos de optimización">Opt {stepsDone(p)}/5</span>
                <span title="Procedimientos asociados">Proc {(p.procedures ?? []).length}</span>
                {(p.dependsOn ?? []).length > 0 && <span title="Depende de otros procesos">🔗 {(p.dependsOn ?? []).length}</span>}
                {p.doc?.version && <span class="ver">v{p.doc.version}</span>}
              </span>
            </button>
          ))}
        </nav>

        <main class="cfg-main">
          {!proc || !ctx ? (
            <p class="empty">No hay procesos. Créalos en «Configurar empresa → Procesos».</p>
          ) : (
            <>
              <div class="hub-modes">
                <div class="seg">
                  <button type="button" class={mode === 'documentar' ? 'on' : ''} onClick={() => setMode('documentar')}>
                    1 · Documentar (5 fases)
                  </button>
                  <button type="button" class={mode === 'optimizar' ? 'on' : ''} onClick={() => setMode('optimizar')}>
                    2 · Optimizar (5 pasos)
                  </button>
                  <button type="button" class={mode === 'procedimientos' ? 'on' : ''} onClick={() => setMode('procedimientos')}>
                    3 · Procedimientos
                  </button>
                  <button type="button" class={mode === 'dependencias' ? 'on' : ''} onClick={() => setMode('dependencias')}>
                    🔗 Dependencias
                  </button>
                  <button type="button" class={mode === 'ficha' ? 'on' : ''} onClick={() => setMode('ficha')}>
                    Ficha de proceso
                  </button>
                </div>
                <span class="hint">
                  {mode === 'documentar'
                    ? `Fase ${PHASES.find((p) => p.key === phase)!.n} de 5`
                    : mode === 'optimizar'
                      ? 'Proceso de 5 pasos · orden estricto'
                      : mode === 'procedimientos'
                        ? 'El cómo, quién y cuándo de cada etapa'
                        : mode === 'dependencias'
                          ? 'Cómo se conectan los procesos y los procedimientos'
                          : 'Documento final'}
                </span>
              </div>
              {mode === 'documentar' && <Documentar ctx={ctx} phase={phase} setPhase={setPhase} />}
              {mode === 'optimizar' && (
                <Optimizar ctx={ctx} step={step} setStep={setStep} onPreview={(c, label) => props.onPreview(draft, c, label)} />
              )}
              {mode === 'procedimientos' && <Procedimientos key={proc.id} ctx={ctx} />}
              {mode === 'dependencias' && <DependenciasView d={draft} proc={proc} onSelect={choose} onEdit={ctx.editProcess} />}
              {mode === 'ficha' && <FichaView ctx={ctx} />}
            </>
          )}
        </main>
      </div>

      <footer class="cfg-foot">
        <div class="status">
          {dirty ? <span class="toast">Cambios sin guardar</span> : <span class="ok">✔ Todo guardado</span>}
          {toast && <span class="toast">{toast}</span>}
        </div>
        <div class="foot-actions">
          <button type="button" class="btn" onClick={close}>
            Cerrar
          </button>
          <button type="button" class="btn primary" onClick={() => props.onSave(draft)}>
            Guardar y cerrar
          </button>
        </div>
      </footer>
    </div>
  );
}

export function openHub(root: HTMLElement, props: HubProps) {
  root.classList.add('open');
  render(<Hub {...props} />, root);
}

export function closeHub(root: HTMLElement) {
  render(null, root);
  root.classList.remove('open');
}
