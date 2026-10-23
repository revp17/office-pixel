import { useState } from 'preact/hooks';
import {
  STEPS,
  compareVariants,
  completeStep,
  describeDuration,
  eliminateStages,
  ensureOptimization,
  isRemovable,
  reopenStep,
  reviewableStages,
  stepChecklist,
  stepCompleted,
  stepUnlocked,
  unitPath,
  variantCompany,
  type CompanyDef,
  type OrgProcessDef,
  type VariantKey,
  type VariantRow,
} from '@office-pixel/sim';
import { StageCard } from '../config/procesos';
import { AddBtn, Card, Field, Sel, Section, Text, TextArea } from '../config/ui';
import { addStage } from '../../application/editing/model';
import { FlowDiagram, type FlowMark } from './flow';
import type { HubCtx } from './documentar';

interface Props {
  ctx: HubCtx;
  step: number;
  setStep: (n: number) => void;
  onPreview: (company: CompanyDef, label: string) => void;
}

// ---------- cabecera de cada paso ----------

function StepHead({ ctx, n }: { ctx: HubCtx; n: number }) {
  const meta = STEPS[n - 1];
  const items = stepChecklist(ctx.proc, n);
  const done = stepCompleted(ctx.proc, n);
  const ready = items.every((i) => i.done);

  const complete = () => {
    const probe = structuredClone(ctx.proc);
    const r = completeStep(probe, n, ctx.today);
    if (!r.ok) return ctx.note(r.reason ?? 'No se puede completar.');
    ctx.P((p) => void completeStep(p, n, ctx.today));
    if (n < 5) ctx.goStep(n + 1);
  };
  const reopen = () => {
    const later = STEPS.filter((s) => s.n > n && stepCompleted(ctx.proc, s.n));
    const warn = later.length ? ` También se reabrirán: ${later.map((s) => `paso ${s.n}`).join(', ')} (el orden es estricto).` : '';
    if (confirm(`¿Reabrir el paso ${n}?${warn}`)) ctx.P((p) => void reopenStep(p, n));
  };

  return (
    <Card class="phasehead">
      <div class="phase-title">
        <span class="num-badge step">{meta.n}</span>
        <div>
          <h3>{meta.title}</h3>
          <p class="rule">{meta.rule}</p>
          <p class="sect-hint">{meta.summary}</p>
        </div>
        {done && <span class="pill end">Completado · {ctx.proc.optimization!.steps[meta.key]!.completedAt}</span>}
      </div>
      <ul class="checklist">
        {items.map((i) => (
          <li key={i.label} class={i.done ? 'ok' : ''}>
            <span>{i.done ? '✔' : '○'}</span> {i.label}
          </li>
        ))}
      </ul>
      <div class="inline">
        {!done ? (
          <button type="button" class="btn primary" disabled={!ready} onClick={complete}>
            Completar el paso {n}{n < 5 ? ` y pasar al ${n + 1}` : ''}
          </button>
        ) : (
          <button type="button" class="btn" onClick={reopen}>
            Reabrir el paso {n}
          </button>
        )}
      </div>
    </Card>
  );
}

const mins = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

// ---------- 1 · Requerimiento menos tonto ----------

function Paso1({ ctx }: { ctx: HubCtx }) {
  const { proc, d, P } = ctx;
  const opt = proc.optimization ?? ensureOptimization(structuredClone(proc));
  const done = stepCompleted(proc, 1);
  const set = (id: string, fn: (r: NonNullable<typeof opt.reqReview[string]>) => void) =>
    P((p) => void fn((ensureOptimization(p).reqReview[id] ??= {})));
  return (
    <>
      <StepHead ctx={ctx} n={1} />
      <fieldset disabled={done} class="plain">
        <Section
          title="Cuestiona cada requerimiento"
          hint="Cada etapa existe porque alguien lo pidió. Anota a esa persona (con nombre y apellido: «lo pide Legal» no vale), por qué existe y si de verdad hace falta."
        >
          {reviewableStages(proc).map((s) => {
            const r = opt.reqReview[s.id] ?? {};
            return (
              <Card key={s.id} title={<b>{s.label ?? s.id}</b>} class="req">
                <p class="hint">
                  {unitPath(d, s.unit)}
                  {s.role ? ` · ${s.role}` : ''} · {describeDuration(s.duration)}
                </p>
                <div class="row">
                  <Field label="¿Quién pidió este requerimiento?" hint="Una persona concreta.">
                    <Text value={r.requestedBy ?? ''} placeholder="Nombre y apellido" onChange={(v) => set(s.id, (x) => void (x.requestedBy = v))} />
                  </Field>
                  <Field label="¿Por qué existe?" grow>
                    <Text value={r.reason ?? ''} placeholder="Qué problema resuelve o qué riesgo evita" onChange={(v) => set(s.id, (x) => void (x.reason = v))} />
                  </Field>
                </div>
                <div class="row">
                  <Field label="¿Es realmente necesario?">
                    <Sel
                      value={r.needed ?? ''}
                      options={[
                        { value: '', label: '— responder —' },
                        { value: 'si', label: 'Sí, es crítico' },
                        { value: 'no', label: 'No, no hace falta' },
                        { value: 'duda', label: 'No lo sé' },
                      ]}
                      onChange={(v) => set(s.id, (x) => void (x.needed = (v || undefined) as typeof x.needed))}
                    />
                  </Field>
                  <Field label="Versión más simple del requerimiento (opcional)" grow>
                    <Text value={r.simplified ?? ''} placeholder="¿Cómo se cumpliría con la mitad del esfuerzo?" onChange={(v) => set(s.id, (x) => void (x.simplified = v))} />
                  </Field>
                </div>
              </Card>
            );
          })}
        </Section>
      </fieldset>
    </>
  );
}

// ---------- 2 · Eliminar ----------

function Paso2({ ctx }: { ctx: HubCtx }) {
  const { proc, d, P } = ctx;
  const opt = proc.optimization ?? ensureOptimization(structuredClone(proc));
  const done = stepCompleted(proc, 2);
  const toggle = (id: string, on: boolean) =>
    P((p) => {
      const o = ensureOptimization(p);
      o.eliminated = on ? [...new Set([...o.eliminated, id])] : o.eliminated.filter((x) => x !== id);
    });
  const marks: Record<string, FlowMark> = Object.fromEntries(opt.eliminated.map((id) => [id, 'removed' as const]));
  const after = eliminateStages(proc, opt.eliminated);
  return (
    <>
      <StepHead ctx={ctx} n={2} />
      <fieldset disabled={done} class="plain">
        <Section
          title="¿Qué se puede borrar?"
          hint="Borra todo lo que no afecte críticamente el resultado. Los marcados «no necesario» en el paso 1 vienen sugeridos. Regla práctica: si no tienes que volver a añadir al menos un 10 % de lo que borraste, es que no borraste lo suficiente."
        >
          {proc.stages.map((s) => {
            const removable = isRemovable(proc, s.id);
            const verdict = opt.reqReview[s.id]?.needed;
            return (
              <label class={`elim${opt.eliminated.includes(s.id) ? ' on' : ''}${removable ? '' : ' locked'}`} key={s.id}>
                <input
                  type="checkbox"
                  disabled={!removable}
                  checked={opt.eliminated.includes(s.id)}
                  onChange={(e) => toggle(s.id, (e.target as HTMLInputElement).checked)}
                />
                <span class="elim-name">
                  <b>{s.label ?? s.id}</b>
                  <small>
                    {s.unit ? unitPath(d, s.unit) : 'Cierre'} · {describeDuration(s.duration)}
                  </small>
                </span>
                {verdict === 'no' && <span class="pill bad">marcada «no necesaria»</span>}
                {verdict === 'duda' && <span class="pill warn">en duda</span>}
                {!removable && <span class="hint">{s === proc.stages[0] ? 'inicio del proceso' : 'cierre'}: no se elimina</span>}
              </label>
            );
          })}
          <Field label="Justificación" hint="Qué decidiste y por qué. Si no eliminas nada, explica por qué no se puede (mín. 15 caracteres).">
            <TextArea rows={2} value={opt.eliminationNotes ?? ''} onChange={(v) => P((p) => void (ensureOptimization(p).eliminationNotes = v))} />
          </Field>
        </Section>
      </fieldset>
      <Section title={done ? 'Proceso después de eliminar' : 'Cómo quedaría'} hint={`${proc.stages.length} etapas → ${after.stages.length}.`}>
        <FlowDiagram def={d} proc={done || opt.eliminated.length === 0 ? after : proc} marks={done ? {} : marks} />
      </Section>
    </>
  );
}

// ---------- 3 · Simplificar el diseño ----------

function Paso3({ ctx }: { ctx: HubCtx }) {
  const { proc, d, P, note } = ctx;
  const live = proc.optimization;
  const done = stepCompleted(proc, 3);
  const design = live?.design;
  if (!design) return <Locked ctx={ctx} n={3} />;
  const PD = (fn: (p: OrgProcessDef, x: CompanyDef) => void) => P((p, x) => void fn(p.optimization!.design!, x));
  return (
    <>
      <StepHead ctx={ctx} n={3} />
      <Section title="Rediseña lo que quedó" hint="Fusiona etapas, reduce traspasos entre áreas, simplifica reglas y excepciones. Los tiempos no se tocan aquí (paso 4) ni se automatiza (paso 5).">
        <FlowDiagram def={d} proc={design} />
      </Section>
      <fieldset disabled={done} class="plain">
        <Section title="Etapas del nuevo diseño">
          {design.stages.map((st, i) => (
            <StageCard key={st.id} d={d} proc={design} st={st} i={i} P={PD} note={note} lockTiming allowAutomation={false} />
          ))}
          <AddBtn onClick={() => PD((p, x) => void addStage(p, x))}>Añadir etapa</AddBtn>
        </Section>
        <Field label="Qué simplificaste y por qué" hint="Obligatorio si el diseño no cambió (mín. 10 caracteres).">
          <TextArea rows={2} value={live?.designNotes ?? ''} onChange={(v) => P((p) => void (ensureOptimization(p).designNotes = v))} />
        </Field>
      </fieldset>
    </>
  );
}

// ---------- 4 · Acelerar ----------

function Paso4({ ctx }: { ctx: HubCtx }) {
  const { proc, d, P } = ctx;
  const opt = proc.optimization;
  const design = opt?.design;
  const done = stepCompleted(proc, 4);
  if (!design || !opt) return <Locked ctx={ctx} n={4} />;
  const stages = design.stages.filter((s) => s.duration && !s.terminal);
  const marks: Record<string, FlowMark> = Object.fromEntries(Object.entries(opt.speed).filter(([, f]) => f < 1).map(([id]) => [id, 'fast' as const]));
  return (
    <>
      <StepHead ctx={ctx} n={4} />
      <fieldset disabled={done} class="plain">
        <Section title="Acelera lo que sobrevivió" hint="Indica cuánto debe durar cada etapa respecto a hoy. 100 % = igual; 70 % = un 30 % más rápida. Pregúntate qué la frena: espera, reproceso, falta de información.">
          {stages.map((s) => {
            const f = opt.speed[s.id] ?? 1;
            return (
              <div class="speedrow" key={s.id}>
                <div class="who">
                  <b>{s.label ?? s.id}</b>
                  <small>
                    {unitPath(d, s.unit)} · hoy {describeDuration(s.duration)} → <b>{describeDuration(s.duration && { ...s.duration, ...scale(s.duration, f) })}</b>
                  </small>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={Math.round(f * 100)}
                  onInput={(e) => {
                    const v = Number((e.target as HTMLInputElement).value) / 100;
                    P((p) => {
                      const o = ensureOptimization(p);
                      if (v >= 1) delete o.speed[s.id];
                      else o.speed[s.id] = v;
                    });
                  }}
                />
                <span class={`pctbadge${f < 1 ? ' on' : ''}`}>{Math.round(f * 100)} %</span>
              </div>
            );
          })}
          <Field label="Notas" hint="Qué hiciste para acelerar. Obligatorio si no aceleraste ninguna (mín. 10 caracteres).">
            <TextArea rows={2} value={opt.speedNotes ?? ''} onChange={(v) => P((p) => void (ensureOptimization(p).speedNotes = v))} />
          </Field>
        </Section>
      </fieldset>
      <Section title="Etapas aceleradas">
        <FlowDiagram def={d} proc={design} marks={marks} />
      </Section>
    </>
  );
}

/** Duración escalada solo para mostrar el «después» (misma regla que applySpeed). */
function scale(spec: NonNullable<OrgProcessDef['stages'][number]['duration']>, f: number) {
  const out: Record<string, number> = {};
  for (const k of ['value', 'minutes', 'mean', 'meanMinutes', 'sd', 'sdMinutes', 'median', 'medianMinutes']) {
    const v = spec[k];
    if (typeof v === 'number') out[k] = v * f;
  }
  return out;
}

// ---------- 5 · Automatizar ----------

function Paso5({ ctx }: { ctx: HubCtx }) {
  const { proc, d, P } = ctx;
  const opt = proc.optimization;
  const design = opt?.design;
  const done = stepCompleted(proc, 5);
  if (!design || !opt) return <Locked ctx={ctx} n={5} />;
  const candidates = design.stages.filter((s) => s.duration && s.unit && !s.terminal);
  const marks: Record<string, FlowMark> = Object.fromEntries(Object.keys(opt.auto).map((id) => [id, 'auto' as const]));
  return (
    <>
      <StepHead ctx={ctx} n={5} />
      <fieldset disabled={done} class="plain">
        <Section
          title="Automatiza al final"
          hint="Solo ahora, con el proceso ya depurado. Elige qué etapas pasa a hacer un sistema (sin personas, sin cola) y cuánto dura entonces respecto a hoy."
        >
          {candidates.map((s) => {
            const on = s.id in opt.auto;
            const f = opt.auto[s.id] ?? 0.2;
            return (
              <div class="speedrow" key={s.id}>
                <label class="check grow">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      P((p) => {
                        const o = ensureOptimization(p);
                        if ((e.target as HTMLInputElement).checked) o.auto[s.id] = 0.2;
                        else delete o.auto[s.id];
                      })
                    }
                  />
                  <span class="who">
                    <b>{s.label ?? s.id}</b>
                    <small>
                      {unitPath(d, s.unit)} · hoy {describeDuration(s.duration)}
                      {on ? ` → ${describeDuration({ ...s.duration!, ...scale(s.duration!, f) })} con sistema` : ''}
                    </small>
                  </span>
                </label>
                {on && (
                  <>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={Math.round(f * 100)}
                      onInput={(e) => P((p) => void (ensureOptimization(p).auto[s.id] = Number((e.target as HTMLInputElement).value) / 100))}
                    />
                    <span class="pctbadge on">{Math.round(f * 100)} %</span>
                  </>
                )}
              </div>
            );
          })}
          <Field label="Notas" hint="Qué sistema o herramienta. Obligatorio si no automatizaste nada (mín. 10 caracteres).">
            <TextArea rows={2} value={opt.autoNotes ?? ''} onChange={(v) => P((p) => void (ensureOptimization(p).autoNotes = v))} />
          </Field>
        </Section>
      </fieldset>
      <Section title="Etapas automatizadas">
        <FlowDiagram def={d} proc={design} marks={marks} />
      </Section>
    </>
  );
}

function Locked({ ctx, n }: { ctx: HubCtx; n: number }) {
  return (
    <Card class="locked">
      <h3>🔒 Paso {n} bloqueado</h3>
      <p class="lead">
        El orden es estricto: antes hay que completar el <b>paso {n - 1} · {STEPS[n - 2].title}</b>.
      </p>
      <p class="hint">{STEPS[n - 1].rule}</p>
      {ctx.proc.stages.length === 0 && <p class="empty">Este proceso no tiene etapas.</p>}
    </Card>
  );
}

// ---------- impacto ----------

function Impact({ ctx, onPreview }: { ctx: HubCtx; onPreview: Props['onPreview'] }) {
  const [state, setState] = useState<{ key: string; rows: VariantRow[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const curKey = JSON.stringify([ctx.proc.optimization, ctx.proc.stages, ctx.proc.arrivals]);
  const stale = state !== null && state.key !== curKey;

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        setState({ key: curKey, rows: compareVariants(ctx.d, ctx.proc.id, ctx.sim) });
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const base = state?.rows[0];
  const maxCycle = Math.max(1, ...(state?.rows.map((r) => r.cycleAvg) ?? [1]));
  const delta = (v: number, b: number | undefined) => (b && b > 0 ? `${v <= b ? '−' : '+'}${Math.abs(Math.round(((v - b) / b) * 100))} %` : '—');

  return (
    <Section
      title="Impacto de cada paso (medido con el simulador)"
      hint={`Mismo proceso, mismas semillas (${ctx.sim.seeds.length}) y ${ctx.sim.days} días: solo cambia lo que decidiste en cada paso.`}
      action={
        <button type="button" class="btn primary" disabled={busy} onClick={run}>
          {busy ? 'Calculando…' : state ? 'Recalcular' : 'Calcular impacto'}
        </button>
      }
    >
      {!state ? (
        <p class="empty">Pulsa «Calcular impacto» para comparar el As-Is con cada paso completado.</p>
      ) : (
        <>
          {stale && <p class="toast">Los datos cambiaron desde este cálculo: pulsa «Recalcular».</p>}
          <table class="impact">
            <thead>
              <tr>
                <th>Variante</th>
                <th>Etapas</th>
                <th>Ciclo medio</th>
                <th>vs As-Is</th>
                <th>Espera por caso</th>
                <th>Cerrados</th>
                <th>SLA rotos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  {r.error ? (
                    <td colSpan={6} class="bad">
                      {r.error}
                    </td>
                  ) : (
                    <>
                      <td>{r.stages}</td>
                      <td>
                        <div class="bar">
                          <div style={{ width: `${(r.cycleAvg / maxCycle) * 100}%` }} />
                          <span>{mins(r.cycleAvg)}</span>
                        </div>
                      </td>
                      <td class={r.key !== 'asis' && base && r.cycleAvg < base.cycleAvg ? 'good' : ''}>{r.key === 'asis' ? '—' : delta(r.cycleAvg, base?.cycleAvg)}</td>
                      <td>{mins(r.waitPerCase)}</td>
                      <td>{Math.round(r.completed)}</td>
                      <td>{Math.round(r.slaBreaches)}</td>
                    </>
                  )}
                  <td>
                    {!r.error && (
                      <button type="button" class="btn small" onClick={() => onPreview(variantCompany(ctx.d, ctx.proc.id, r.key as VariantKey), `${ctx.proc.name ?? ctx.proc.id} · ${r.label}`)}>
                        Ver en el plano
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Section>
  );
}

// ---------- contenedor ----------

export function Optimizar({ ctx, step, setStep, onPreview }: Props) {
  const { proc } = ctx;
  return (
    <div class="doc-layout">
      <div>
        <ol class="phase-nav steps">
          {STEPS.map((s) => {
            const done = stepCompleted(proc, s.n);
            const open = stepUnlocked(proc, s.n);
            return (
              <li key={s.key}>
                <button type="button" class={`${step === s.n ? 'on' : ''}${done ? ' done' : ''}${open ? '' : ' lock'}`} onClick={() => setStep(s.n)}>
                  <span class="num-badge">{done ? '✔' : open ? s.n : '🔒'}</span>
                  <span>{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p class="hint order">Orden estricto: 1 → 2 → 3 → 4 → 5. Un paso no se abre hasta completar el anterior.</p>
      </div>
      <div class="form">
        {!stepUnlocked(proc, step) ? (
          <Locked ctx={ctx} n={step} />
        ) : (
          <>
            {step === 1 && <Paso1 ctx={ctx} />}
            {step === 2 && <Paso2 ctx={ctx} />}
            {step === 3 && <Paso3 ctx={ctx} />}
            {step === 4 && <Paso4 ctx={ctx} />}
            {step === 5 && <Paso5 ctx={ctx} />}
          </>
        )}
        <Impact ctx={ctx} onPreview={onPreview} />
      </div>
    </div>
  );
}
