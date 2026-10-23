import { useState } from 'preact/hooks';
import { applyRetire, effectText, moveTargets, retirePlan } from './retirar';
import { Sel, type Up } from './ui';
import type { CompanyDef } from '@office-pixel/sim';

/** Asistente para quitar un área o subárea que todavía tiene personas, etapas de proceso o reuniones. */
export function RetireDialog({ d, unitId, up, note, onClose }: { d: CompanyDef; unitId: string; up: Up; note: (m: string) => void; onClose: () => void }) {
  const plan = retirePlan(d, unitId);
  const targets = moveTargets(d, unitId);
  const [mode, setMode] = useState<'move' | 'delete'>(targets.length ? 'move' : 'delete');
  const [to, setTo] = useState(targets[0]?.unit.id ?? '');

  const go = () => {
    if (mode === 'move' && !to) return note('Elige a qué área mover.');
    up((x) => void applyRetire(x, unitId, mode === 'move' ? { mode, to } : { mode }));
    note(mode === 'move' ? `«${plan.name}» quitada; sus personas y etapas pasaron a otra área.` : `«${plan.name}» quitada con todo su contenido.`);
    onClose();
  };

  return (
    <div class="modal-back" onClick={onClose}>
      <div class="modal" role="dialog" aria-label={`Quitar ${plan.name}`} onClick={(e) => e.stopPropagation()}>
        <h3>Quitar «{plan.name}»</h3>
        <p class="muted">Todavía hay cosas que dependen de esta área{plan.unitIds.length > 1 ? ' y de sus subáreas' : ''}. Elige qué hacer con ellas:</p>

        <ul class="impact">
          <li>
            <b>{plan.people.length}</b> persona(s){plan.people.length ? `: ${plan.people.slice(0, 6).map((p) => p.name ?? p.id).join(', ')}${plan.people.length > 6 ? '…' : ''}` : ''}
          </li>
          <li>
            <b>{plan.stages.length}</b> etapa(s) de proceso
          </li>
          <li>
            <b>{plan.meetings.length}</b> reunión(es)
          </li>
          {plan.procedures > 0 && (
            <li>
              <b>{plan.procedures}</b> procedimiento(s) asociado(s) a esas etapas
            </li>
          )}
        </ul>

        <label class="check">
          <input type="radio" name="retire" checked={mode === 'move'} disabled={!targets.length} onChange={() => setMode('move')} />
          <span>
            <b>Mover todo a otra área</b> (la empresa sigue funcionando igual, solo cambia de sala)
          </span>
        </label>
        {mode === 'move' && (
          <Sel value={to} options={targets.map(({ unit, depth }) => ({ value: unit.id, label: `${'  '.repeat(depth)}${unit.name ?? unit.id}` }))} onChange={setTo} />
        )}

        <label class="check">
          <input type="radio" name="retire" checked={mode === 'delete'} onChange={() => setMode('delete')} />
          <span>
            <b>Eliminar el área con todo su contenido</b> (personas, reuniones y las etapas que la usan)
          </span>
        </label>
        {mode === 'delete' && (
          <div class="impact-box">
            {plan.stages.length === 0 && <p class="muted">Ninguna etapa de proceso usa esta área.</p>}
            {plan.stages.map((s) => (
              <p key={`${s.proc}.${s.stage}`}>
                <b>{s.procName}</b> · «{s.label}»: {effectText(s.effect)}.
              </p>
            ))}
            {plan.removedProcesses.length > 0 && (
              <p class="prereq-warn">
                ⚠ Se borrarían también estos procesos completos, porque se quedan sin etapas de trabajo:{' '}
                {plan.removedProcesses.map((id) => d.processes.find((p) => p.id === id)?.name ?? id).join(', ')}.
              </p>
            )}
            <p class="muted">No se puede deshacer desde el formulario: si te equivocas, cierra «Configurar empresa» con la X sin aplicar.</p>
          </div>
        )}

        <div class="modal-actions">
          <button type="button" class="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" class={`btn ${mode === 'delete' ? 'danger' : 'primary'}`} onClick={go}>
            {mode === 'move' ? 'Mover y quitar el área' : 'Eliminar el área y su contenido'}
          </button>
        </div>
      </div>
    </div>
  );
}
