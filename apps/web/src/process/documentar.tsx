import { useState } from 'preact/hooks';
import {
  PHASES,
  captureBaseline,
  docChecklist,
  ensureDoc,
  phaseCompleted,
  type CompanyDef,
  type FieldType,
  type OrgProcessDef,
  type PhaseKey,
  type ValidationStatus,
} from '@office-pixel/sim';
import { AddBtn, Card, Field, IconBtn, Sel, Section, Text, TextArea } from '../config/ui';
import { FlowDiagram } from './flow';

export type PMut = (fn: (p: OrgProcessDef, d: CompanyDef) => void) => void;

export interface HubCtx {
  d: CompanyDef;
  proc: OrgProcessDef;
  P: PMut;
  note: (m: string) => void;
  today: string;
  sim: { seeds: number[]; days: number };
  goFicha: () => void;
  editProcess: () => void;
  /** abre un paso de la optimización (al completar uno se pasa al siguiente) */
  goStep: (n: number) => void;
}

const uid = (prefix: string, taken: string[]) => {
  let i = taken.length + 1;
  while (taken.includes(`${prefix}${i}`)) i++;
  return `${prefix}${i}`;
};

const FIELD_LABEL: Record<FieldType, string> = { entrevista: 'Entrevista', observacion: 'Observación en sitio', documento: 'Documento revisado', datos: 'Datos recogidos' };

/** Cabecera de cada fase: qué es, la lista de comprobación y el botón para darla por completada. */
function PhaseHead({ ctx, phase }: { ctx: HubCtx; phase: PhaseKey }) {
  const meta = PHASES.find((p) => p.key === phase)!;
  const items = docChecklist(ctx.d, ctx.proc, phase);
  const ready = items.every((i) => i.done);
  const done = phaseCompleted(ctx.proc, phase);
  return (
    <Card class="phasehead">
      <div class="phase-title">
        <span class="num-badge">{meta.n}</span>
        <div>
          <h3>{meta.title}</h3>
          <p class="sect-hint">{meta.summary}</p>
        </div>
        {done && <span class="pill end">Completada · {ctx.proc.doc!.phases[phase]!.completedAt}</span>}
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
          <button
            type="button"
            class="btn primary"
            disabled={!ready}
            onClick={() => ctx.P((p) => void (ensureDoc(p).phases[phase] = { completedAt: ctx.today }))}
          >
            Marcar fase como completada
          </button>
        ) : (
          <button type="button" class="btn" onClick={() => ctx.P((p) => void delete ensureDoc(p).phases[phase])}>
            Reabrir fase
          </button>
        )}
        {!ready && !done && <span class="hint">Completa la lista para poder cerrar la fase.</span>}
      </div>
    </Card>
  );
}

// ---------- 1 · Planificación y alcance ----------

function Alcance({ ctx }: { ctx: HubCtx }) {
  const { d, proc, P } = ctx;
  const sc = ensureDoc(structuredClone(proc)).scope;
  const set = (fn: (s: ReturnType<typeof ensureDoc>['scope']) => void) => P((p) => void fn(ensureDoc(p).scope));
  const people = [{ value: '', label: '— elegir —' }, ...d.people.map((p) => ({ value: p.id, label: p.name ?? p.id }))];
  return (
    <>
      <PhaseHead ctx={ctx} phase="alcance" />
      <Section title="Objetivo y alcance">
        <Field label="Objetivo del proceso" hint="¿Para qué existe? Una o dos frases.">
          <TextArea value={sc.objective ?? ''} onChange={(v) => set((s) => void (s.objective = v))} />
        </Field>
        <div class="row">
          <Field label="Entradas (qué lo dispara)">
            <TextArea rows={2} value={sc.inputs ?? ''} onChange={(v) => set((s) => void (s.inputs = v))} />
          </Field>
          <Field label="Salidas (qué entrega)">
            <TextArea rows={2} value={sc.outputs ?? ''} onChange={(v) => set((s) => void (s.outputs = v))} />
          </Field>
        </div>
        <div class="row">
          <Field label="Dentro del alcance">
            <TextArea rows={2} value={sc.inScope ?? ''} onChange={(v) => set((s) => void (s.inScope = v))} />
          </Field>
          <Field label="Fuera del alcance">
            <TextArea rows={2} value={sc.outOfScope ?? ''} onChange={(v) => set((s) => void (s.outOfScope = v))} />
          </Field>
        </div>
        <Field label="Criterios de éxito" hint="¿Cómo sabremos que el levantamiento sirvió? Mejor con números.">
          <TextArea rows={2} value={sc.successCriteria ?? ''} onChange={(v) => set((s) => void (s.successCriteria = v))} />
        </Field>
        <div class="row">
          <Field label="Dueño del proceso">
            <Sel value={sc.owner ?? ''} options={people} onChange={(v) => set((s) => void (s.owner = v))} />
          </Field>
          <Field label="Inicio del levantamiento">
            <input type="date" value={sc.startDate ?? ''} onInput={(e) => set((s) => void (s.startDate = (e.target as HTMLInputElement).value))} />
          </Field>
          <Field label="Fin previsto">
            <input type="date" value={sc.endDate ?? ''} onInput={(e) => set((s) => void (s.endDate = (e.target as HTMLInputElement).value))} />
          </Field>
        </div>
      </Section>

      <Section title="Involucrados" hint="Quienes conocen, usan o se ven afectados por el proceso. Cada uno validará el modelo en la fase 4.">
        {sc.stakeholders.length === 0 && <p class="empty">Aún no hay involucrados.</p>}
        {sc.stakeholders.map((s, i) => (
          <div class="inline wrap" key={s.id}>
            <Field label="Nombre">
              <Text value={s.name} onChange={(v) => set((x) => void (x.stakeholders[i].name = v))} />
            </Field>
            <Field label="Rol en el proceso">
              <Text value={s.role ?? ''} placeholder="Usuario, dueño, auditor…" onChange={(v) => set((x) => void (x.stakeholders[i].role = v))} />
            </Field>
            <Field label="¿Es alguien de la empresa?">
              <Sel
                value={s.personId ?? ''}
                options={[{ value: '', label: '— no / externo —' }, ...d.people.map((p) => ({ value: p.id, label: p.name ?? p.id }))]}
                onChange={(v) =>
                  set((x) => {
                    if (v) {
                      x.stakeholders[i].personId = v;
                      if (!x.stakeholders[i].name) x.stakeholders[i].name = d.people.find((p) => p.id === v)?.name ?? v;
                    } else delete x.stakeholders[i].personId;
                  })
                }
              />
            </Field>
            <IconBtn title="Quitar involucrado" danger onClick={() => set((x) => void x.stakeholders.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn
          onClick={() =>
            set((x) => void x.stakeholders.push({ id: uid('inv', x.stakeholders.map((s) => s.id)), name: `Involucrado ${x.stakeholders.length + 1}` }))
          }
        >
          Añadir involucrado
        </AddBtn>
      </Section>
    </>
  );
}

// ---------- 2 · Trabajo de campo ----------

function Campo({ ctx }: { ctx: HubCtx }) {
  const { proc, P } = ctx;
  const doc = proc.doc ?? ensureDoc(structuredClone(proc));
  const set = (fn: (recs: typeof doc.fieldwork) => void) => P((p) => void fn(ensureDoc(p).fieldwork));
  return (
    <>
      <PhaseHead ctx={ctx} phase="campo" />
      <Section title="Registros de campo" hint="Anota lo que viste y escuchaste, no lo que crees que debería pasar. Los hallazgos alimentan la ficha.">
        <datalist id="fuentes">
          {doc.scope.stakeholders.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
        {doc.fieldwork.length === 0 && <p class="empty">Aún no hay registros. Añade la primera entrevista u observación.</p>}
        {doc.fieldwork.map((f, i) => (
          <Card
            key={f.id}
            title={<span class="pill sub">{FIELD_LABEL[f.type]}</span>}
            actions={
              <IconBtn title="Borrar registro" danger onClick={() => set((r) => void r.splice(i, 1))}>
                🗑
              </IconBtn>
            }
          >
            <div class="row">
              <Field label="Tipo">
                <Sel
                  value={f.type}
                  options={(Object.keys(FIELD_LABEL) as FieldType[]).map((k) => ({ value: k, label: FIELD_LABEL[k] }))}
                  onChange={(v) => set((r) => void (r[i].type = v as FieldType))}
                />
              </Field>
              <Field label="Fecha">
                <input type="date" value={f.date ?? ''} onInput={(e) => set((r) => void (r[i].date = (e.target as HTMLInputElement).value))} />
              </Field>
              <Field label="Fuente (persona, lugar o documento)" grow>
                <Text value={f.source ?? ''} list="fuentes" onChange={(v) => set((r) => void (r[i].source = v))} />
              </Field>
            </div>
            <div class="row">
              <Field label="Notas de lo observado">
                <TextArea value={f.notes ?? ''} onChange={(v) => set((r) => void (r[i].notes = v))} />
              </Field>
              <Field label="Hallazgos (problemas, repeticiones, esperas, excepciones)">
                <TextArea value={f.findings ?? ''} onChange={(v) => set((r) => void (r[i].findings = v))} />
              </Field>
            </div>
          </Card>
        ))}
        <div class="inline wrapbtn">
          {(Object.keys(FIELD_LABEL) as FieldType[]).map((k) => (
            <AddBtn key={k} onClick={() => set((r) => void r.push({ id: uid('c', r.map((x) => x.id)), type: k, date: ctx.today }))}>
              {FIELD_LABEL[k]}
            </AddBtn>
          ))}
        </div>
      </Section>
    </>
  );
}

// ---------- 3 · Modelado As-Is ----------

const mins = (m: number) => (m >= 90 ? `${(m / 60).toFixed(1)} h` : `${Math.round(m)} min`);

function AsIs({ ctx }: { ctx: HubCtx }) {
  const { d, proc, P } = ctx;
  const [busy, setBusy] = useState(false);
  const b = proc.doc?.baseline;
  const measure = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        const base = captureBaseline(d, proc.id, ctx.sim, new Date().toISOString());
        P((p) => void (ensureDoc(p).baseline = base));
      } finally {
        setBusy(false);
      }
    }, 30);
  };
  return (
    <>
      <PhaseHead ctx={ctx} phase="asis" />
      <Section
        title="Diagrama del proceso tal como funciona hoy"
        hint="Se dibuja solo a partir de las etapas, reglas y excepciones del proceso. Si algo no coincide con lo que viste en campo, corrígelo en «Configurar empresa → Procesos»."
        action={
          <button type="button" class="btn" onClick={ctx.editProcess}>
            Editar el proceso…
          </button>
        }
      >
        <FlowDiagram def={d} proc={proc} />
      </Section>

      <Section
        title="Línea base"
        hint={`Mide el proceso actual con el simulador (${ctx.sim.seeds.length} semillas × ${ctx.sim.days} días, promedio). Sirve para comparar después de optimizar.`}
        action={
          <button type="button" class="btn primary" disabled={busy} onClick={measure}>
            {busy ? 'Midiendo…' : b ? 'Volver a medir' : 'Medir línea base'}
          </button>
        }
      >
        {!b ? (
          <p class="empty">Aún no hay línea base.</p>
        ) : (
          <table class="mini-table">
            <tbody>
              <tr><td>Medida el</td><td>{b.capturedAt.slice(0, 16).replace('T', ' ')}</td></tr>
              <tr><td>Etapas</td><td>{b.stages}</td></tr>
              <tr><td>Casos cerrados ({b.days} días)</td><td>{Math.round(b.completed)}</td></tr>
              <tr><td>Tiempo de ciclo medio (hábil)</td><td>{mins(b.cycleAvg)}</td></tr>
              <tr><td>Tiempo de ciclo P90 (hábil)</td><td>{mins(b.cycleP90)}</td></tr>
              <tr><td>Espera total por caso</td><td>{mins(b.waitPerCase)}</td></tr>
              <tr><td>Plazos incumplidos</td><td>{Math.round(b.slaBreaches)}</td></tr>
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

// ---------- 4 · Validación ----------

const STATUS_LABEL: Record<ValidationStatus, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', observado: 'Con observaciones' };

function Validacion({ ctx }: { ctx: HubCtx }) {
  const { proc, P } = ctx;
  const doc = proc.doc ?? ensureDoc(structuredClone(proc));
  const status = (id: string) => doc.validations.find((v) => v.stakeholderId === id);
  const setV = (id: string, fn: (v: { stakeholderId: string; status: ValidationStatus; comment?: string; date?: string }) => void) =>
    P((p) => {
      const list = ensureDoc(p).validations;
      let v = list.find((x) => x.stakeholderId === id);
      if (!v) list.push((v = { stakeholderId: id, status: 'pendiente' }));
      fn(v);
    });
  const ok = doc.scope.stakeholders.filter((s) => status(s.id)?.status === 'aprobado').length;
  return (
    <>
      <PhaseHead ctx={ctx} phase="validacion" />
      <Section
        title="Validación con los involucrados"
        hint="Muéstrales el diagrama As-Is (fase 3) y registra su respuesta. Con observaciones, corrige el modelo y vuelve a pedir validación."
      >
        {doc.scope.stakeholders.length === 0 ? (
          <p class="empty">No hay involucrados. Añádelos en la fase 1.</p>
        ) : (
          <>
            <div class="meter">
              <div style={{ width: `${(ok / doc.scope.stakeholders.length) * 100}%` }} />
              <span>
                {ok} de {doc.scope.stakeholders.length} aprobaron
              </span>
            </div>
            {doc.scope.stakeholders.map((s) => {
              const v = status(s.id);
              return (
                <div class="inline wrap" key={s.id}>
                  <div class="who">
                    <b>{s.name}</b>
                    <small>{s.role ?? ''}</small>
                  </div>
                  <Field label="Respuesta">
                    <Sel
                      value={v?.status ?? 'pendiente'}
                      options={(Object.keys(STATUS_LABEL) as ValidationStatus[]).map((k) => ({ value: k, label: STATUS_LABEL[k] }))}
                      onChange={(x) =>
                        setV(s.id, (r) => {
                          r.status = x as ValidationStatus;
                          r.date = x === 'pendiente' ? undefined : ctx.today;
                        })
                      }
                    />
                  </Field>
                  <Field label="Comentario" grow>
                    <Text value={v?.comment ?? ''} placeholder="Observaciones o condiciones" onChange={(x) => setV(s.id, (r) => void (r.comment = x))} />
                  </Field>
                  <Field label="Fecha">
                    <input type="date" value={v?.date ?? ''} onInput={(e) => setV(s.id, (r) => void (r.date = (e.target as HTMLInputElement).value))} />
                  </Field>
                </div>
              );
            })}
          </>
        )}
      </Section>
    </>
  );
}

// ---------- 5 · Documentación final y ficha ----------

function nextVersion(v: string | undefined): string {
  if (!v) return '1.0';
  const m = /^(\d+)\.(\d+)$/.exec(v);
  return m ? `${m[1]}.${Number(m[2]) + 1}` : '1.0';
}

function FichaFase({ ctx }: { ctx: HubCtx }) {
  const { proc, P } = ctx;
  const doc = proc.doc;
  const ready = docChecklist(ctx.d, proc, 'ficha').every((i) => i.done);
  const approved = !!doc?.approvedAt && phaseCompleted(proc, 'ficha');
  return (
    <>
      <PhaseHead ctx={ctx} phase="ficha" />
      <Section title="Aprobar y publicar la ficha">
        <p class="lead">
          Al aprobar, la ficha queda con un número de versión y la fecha de hoy. Si después el proceso cambia, reabre la fase y vuelve a
          aprobar para generar la siguiente versión.
        </p>
        <div class="inline">
          <button
            type="button"
            class="btn primary"
            disabled={!ready || approved}
            onClick={() =>
              P((p) => {
                const dd = ensureDoc(p);
                dd.version = nextVersion(dd.version);
                dd.approvedAt = ctx.today;
                dd.phases.ficha = { completedAt: ctx.today };
              })
            }
          >
            {approved ? `Versión ${doc!.version} aprobada` : doc?.version ? `Aprobar versión ${nextVersion(doc.version)}` : 'Aprobar versión 1.0'}
          </button>
          <button type="button" class="btn" onClick={ctx.goFicha}>
            Ver la ficha de proceso →
          </button>
        </div>
        {doc?.version && (
          <p class="hint">
            Última versión: <b>{doc.version}</b>, aprobada el {doc.approvedAt}.
          </p>
        )}
      </Section>
    </>
  );
}

// ---------- contenedor ----------

export function Documentar({ ctx, phase, setPhase }: { ctx: HubCtx; phase: PhaseKey; setPhase: (k: PhaseKey) => void }) {
  return (
    <div class="doc-layout">
      <ol class="phase-nav">
        {PHASES.map((p) => {
          const done = phaseCompleted(ctx.proc, p.key);
          return (
            <li key={p.key}>
              <button type="button" class={`${phase === p.key ? 'on' : ''}${done ? ' done' : ''}`} onClick={() => setPhase(p.key)}>
                <span class="num-badge">{done ? '✔' : p.n}</span>
                <span>{p.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div class="form">
        {phase === 'alcance' && <Alcance ctx={ctx} />}
        {phase === 'campo' && <Campo ctx={ctx} />}
        {phase === 'asis' && <AsIs ctx={ctx} />}
        {phase === 'validacion' && <Validacion ctx={ctx} />}
        {phase === 'ficha' && <FichaFase ctx={ctx} />}
      </div>
    </div>
  );
}
