import { useState } from 'preact/hooks';
import {
  PROC_STEPS,
  WARNING_LABEL,
  allFieldExceptions,
  approveProcedure,
  completeProcStep,
  distinctOperators,
  isPersonName,
  lintStep,
  newProcedure,
  procChecklist,
  procStepCompleted,
  procStepUnlocked,
  procStepsDone,
  procedureCoverage,
  procedureStatus,
  reopenProcStep,
  stepSentence,
  uncoveredExceptions,
  allProcedures,
  dropDanglingDependencies,
  unpublishedPrerequisites,
  type CompanyDef,
  type OrgProcessDef,
  type ProcFieldRecord,
  type Procedure,
  type SignStatus,
  type WarningKind,
} from '@office-pixel/sim';
import { AddBtn, Card, Field, IconBtn, Num, Sel, Section, Text, TextArea } from '../config/ui';
import { ProcDoc } from './procDoc';
import { ProcedureChain } from './depmap';
import type { HubCtx } from './documentar';
import { Annotator, TaskFlow, WarningBox, fileToDataUrl } from './visuales';

type PM = (fn: (pc: Procedure, p: OrgProcessDef, d: CompanyDef) => void) => void;

const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const stageLabel = (p: OrgProcessDef, id: string | undefined) => p.stages.find((s) => s.id === id)?.label ?? id ?? '—';

// ---------- cabecera de cada paso ----------

function StepHead({ ctx, pc, n, PM, go }: { ctx: HubCtx; pc: Procedure; n: number; PM: PM; go: (n: number) => void }) {
  const meta = PROC_STEPS[n - 1];
  const items = procChecklist(ctx.d, pc, n);
  const done = procStepCompleted(pc, n);
  const ready = items.every((i) => i.done);
  const open = procStepUnlocked(pc, n);

  const complete = () => {
    const probe = structuredClone(pc);
    const r = completeProcStep(ctx.d, probe, n, ctx.today);
    if (!r.ok) return ctx.note(r.reason ?? 'No se puede completar.');
    PM((x, _p, d) => void completeProcStep(d, x, n, ctx.today));
    if (n < 5) go(n + 1);
  };
  const reopen = () => {
    const later = PROC_STEPS.filter((s) => s.n > n && procStepCompleted(pc, s.n));
    if (confirm(`¿Reabrir el paso ${n}?${later.length ? ` También se reabrirán: ${later.map((s) => `paso ${s.n}`).join(', ')}.` : ''}`)) PM((x) => void reopenProcStep(x, n));
  };

  return (
    <Card class="phasehead">
      <div class="phase-title">
        <span class="num-badge">{meta.n}</span>
        <div>
          <h3>{meta.title}</h3>
          <p class="sect-hint">{meta.summary}</p>
        </div>
        {done && <span class="pill end">Completado · {pc.done[meta.key]!.completedAt}</span>}
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
          <button type="button" class="btn primary" disabled={!ready || !open} onClick={complete}>
            Completar el paso {n}
            {n < 5 ? ` y pasar al ${n + 1}` : ''}
          </button>
        ) : (
          <button type="button" class="btn" onClick={reopen}>
            Reabrir el paso {n}
          </button>
        )}
        {!open && <span class="hint">Antes completa el paso {n - 1}.</span>}
      </div>
    </Card>
  );
}

// ---------- 1 · Entrevista de tarea a tarea y observación crítica ----------

function Paso1({ ctx, pc, PM, go }: { ctx: HubCtx; pc: Procedure; PM: PM; go: (n: number) => void }) {
  const setRec = (i: number, fn: (r: ProcFieldRecord) => void) => PM((x) => void fn(x.fieldwork[i]));
  return (
    <>
      <StepHead ctx={ctx} pc={pc} n={1} PM={PM} go={go} />
      <Card class="guide">
        <b>Cómo levantarlo</b>
        <ul>
          <li>
            <b>Habla con los operadores directos</b> (quienes hacen la tarea a diario), no con directores.
          </li>
          <li>
            <b>Pídeles que lo ejecuten en vivo.</b> Mira qué software usan, qué carpetas abren, qué herramientas manipulan. No te quedes solo con lo que dicen.
          </li>
          <li>
            <b>Pregunta por las excepciones:</b> «¿Qué pasa si el sistema falla aquí?», «¿Qué haces si el cliente no envía este dato?».
          </li>
          <li>
            <b>Anota los «trucos»:</b> el conocimiento informal que usan para resolver rápido y no está en ningún manual.
          </li>
        </ul>
      </Card>
      <Section title="Registros del levantamiento">
        <datalist id="operadores">
          {ctx.d.people.map((p) => (
            <option key={p.id} value={p.name ?? p.id} />
          ))}
        </datalist>
        {pc.fieldwork.length === 0 && <p class="empty">Aún no hay registros. Empieza con una observación en vivo.</p>}
        {pc.fieldwork.map((f, i) => (
          <Card
            key={f.id}
            title={<span class="pill sub">{f.method === 'en_vivo' ? 'Observación en vivo' : 'Entrevista'}</span>}
            actions={
              <IconBtn title="Borrar registro" danger onClick={() => PM((x) => void x.fieldwork.splice(i, 1))}>
                🗑
              </IconBtn>
            }
          >
            <div class="row">
              <Field label="Operador (quien hace la tarea)" grow>
                <Text value={f.operator} list="operadores" placeholder="Nombre de la persona" onChange={(v) => setRec(i, (r) => void (r.operator = v))} />
              </Field>
              <Field label="Cómo se levantó">
                <Sel
                  value={f.method}
                  options={[
                    { value: 'en_vivo', label: 'Observación en vivo' },
                    { value: 'entrevista', label: 'Entrevista' },
                  ]}
                  onChange={(v) => setRec(i, (r) => void (r.method = v as ProcFieldRecord['method']))}
                />
              </Field>
              <Field label="Fecha">
                <input type="date" value={f.date ?? ''} onInput={(e) => setRec(i, (r) => void (r.date = (e.target as HTMLInputElement).value))} />
              </Field>
            </div>
            <Field label="Qué hace, con qué sistema, carpeta o herramienta" hint="Describe lo que viste, paso a paso.">
              <TextArea rows={3} value={f.notes ?? ''} onChange={(v) => setRec(i, (r) => void (r.notes = v))} />
            </Field>
            <div class="row">
              <div class="field grow">
                <span class="lbl">Excepciones («¿qué pasa si…?»)</span>
                {f.exceptions.map((e, k) => (
                  <div class="inline" key={e.id}>
                    <Text value={e.text} placeholder="p. ej. el cliente no envía el documento" onChange={(v) => setRec(i, (r) => void (r.exceptions[k].text = v))} />
                    <IconBtn title="Quitar" danger onClick={() => setRec(i, (r) => void r.exceptions.splice(k, 1))}>
                      ✕
                    </IconBtn>
                  </div>
                ))}
                <AddBtn onClick={() => setRec(i, (r) => void r.exceptions.push({ id: uid('e'), text: '' }))}>Excepción</AddBtn>
              </div>
              <div class="field grow">
                <span class="lbl">Trucos operativos (lo que no está en ningún manual)</span>
                {f.tricks.map((t, k) => (
                  <div class="inline" key={k}>
                    <Text value={t} placeholder="p. ej. si el nombre tiene tilde, buscarlo también sin ella" onChange={(v) => setRec(i, (r) => void (r.tricks[k] = v))} />
                    <IconBtn title="Quitar" danger onClick={() => setRec(i, (r) => void r.tricks.splice(k, 1))}>
                      ✕
                    </IconBtn>
                  </div>
                ))}
                <AddBtn onClick={() => setRec(i, (r) => void r.tricks.push(''))}>Truco</AddBtn>
              </div>
            </div>
          </Card>
        ))}
        <div class="inline wrapbtn">
          <AddBtn onClick={() => PM((x) => void x.fieldwork.push({ id: uid('f'), operator: '', method: 'en_vivo', date: ctx.today, exceptions: [], tricks: [] }))}>Observación en vivo</AddBtn>
          <AddBtn onClick={() => PM((x) => void x.fieldwork.push({ id: uid('f'), operator: '', method: 'entrevista', date: ctx.today, exceptions: [], tricks: [] }))}>Entrevista</AddBtn>
        </div>
        <label class="check">
          <input type="checkbox" checked={!!pc.noTricks} onChange={(e) => PM((x) => void (x.noTricks = (e.target as HTMLInputElement).checked))} />
          No hay trucos operativos que registrar (lo confirmé con los operadores)
        </label>
      </Section>
    </>
  );
}

/** Procedimientos que deben estar hechos antes de este (de cualquier proceso). */
function Requisitos({ ctx, pc, PM }: { ctx: HubCtx; pc: Procedure; PM: PM }) {
  const all = allProcedures(ctx.d).filter((r) => r.pc.id !== pc.id);
  // los que ya dependen de este (directa o indirectamente) no pueden ser su requisito: formarían un ciclo
  const downstream = new Set<string>();
  const walk = (id: string) => {
    for (const r of allProcedures(ctx.d)) if (r.pc.prerequisites?.includes(id) && !downstream.has(r.pc.id)) (downstream.add(r.pc.id), walk(r.pc.id));
  };
  walk(pc.id);
  const chosen = new Set(pc.prerequisites ?? []);
  const toggle = (id: string) =>
    PM((x) => {
      const set = new Set(x.prerequisites ?? []);
      set.has(id) ? set.delete(id) : set.add(id);
      if (set.size) x.prerequisites = [...set];
      else delete x.prerequisites;
    });
  const pending = unpublishedPrerequisites(ctx.d, pc);
  return (
    <Section title="Requisitos previos (opcional)" hint="Procedimientos de este u otros procesos que deben estar hechos o disponibles antes de ejecutar este.">
      {all.length === 0 && <p class="empty">Aún no hay otros procedimientos.</p>}
      <div class="list">
        {all.map((r) => (
          <label class="check" key={r.pc.id}>
            <input type="checkbox" checked={chosen.has(r.pc.id)} disabled={downstream.has(r.pc.id)} onChange={() => toggle(r.pc.id)} />
            <span>
              <b>{r.pc.code}</b> — {r.pc.title} <small>({r.proc.name ?? r.proc.id} · {procedureStatus(r.pc) === 'publicado' ? `v${r.pc.version}` : 'borrador'})</small>
              {downstream.has(r.pc.id) && <small> · ya depende de este</small>}
            </span>
          </label>
        ))}
      </div>
      <ProcedureChain def={ctx.d} pc={pc} />
      {pending.length > 0 && (
        <p class="prereq-warn">⚠ Antes de publicar este procedimiento conviene publicar sus requisitos: {pending.map((r) => r.pc.code).join(', ')}.</p>
      )}
    </Section>
  );
}

// ---------- 2 · Los 5 bloques ----------

function Paso2({ ctx, pc, PM, go }: { ctx: HubCtx; pc: Procedure; PM: PM; go: (n: number) => void }) {
  const roles = [...new Set(ctx.d.people.map((p) => p.role))].sort();
  return (
    <>
      <StepHead ctx={ctx} pc={pc} n={2} PM={PM} go={go} />
      <Section title="1 · Objetivo y alcance">
        <Field label="Objetivo" hint="Qué busca lograr la tarea.">
          <TextArea rows={2} value={pc.objective ?? ''} onChange={(v) => PM((x) => void (x.objective = v))} />
        </Field>
        <div class="row">
          <Field label="Empieza cuando…" grow>
            <Text value={pc.startsWhen ?? ''} placeholder="Llega la solicitud capturada" onChange={(v) => PM((x) => void (x.startsWhen = v))} />
          </Field>
          <Field label="Termina cuando…" grow>
            <Text value={pc.endsWhen ?? ''} placeholder="La identidad queda validada o rechazada" onChange={(v) => PM((x) => void (x.endsWhen = v))} />
          </Field>
        </div>
        <div class="row">
          <Field label="Incluye (opcional)">
            <TextArea rows={2} value={pc.includes ?? ''} onChange={(v) => PM((x) => void (x.includes = v))} />
          </Field>
          <Field label="No incluye (opcional)">
            <TextArea rows={2} value={pc.excludes ?? ''} onChange={(v) => PM((x) => void (x.excludes = v))} />
          </Field>
        </div>
      </Section>

      <Requisitos ctx={ctx} pc={pc} PM={PM} />

      <Section title="2 · Responsabilidades" hint="Puestos específicos (por ejemplo, Analista de Compras o Gerente de Finanzas). Evita nombres propios.">
        <datalist id="puestos">
          {roles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        {pc.responsibilities.map((r, i) => (
          <div class="inline wrap" key={i}>
            <Field label="Puesto" grow>
              <Text value={r.role} list="puestos" onChange={(v) => PM((x) => void (x.responsibilities[i].role = v))} />
              {isPersonName(ctx.d, r.role) && <span class="hint bad">Es un nombre propio: usa el puesto.</span>}
            </Field>
            <Field label="Qué le corresponde" grow>
              <Text value={r.description ?? ''} onChange={(v) => PM((x) => void (x.responsibilities[i].description = v))} />
            </Field>
            <IconBtn title="Quitar" danger onClick={() => PM((x) => void x.responsibilities.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn onClick={() => PM((x) => void x.responsibilities.push({ role: '', description: '' }))}>Responsabilidad</AddBtn>
      </Section>

      <Section title="3 · Definiciones o glosario" hint="Siglas, sistemas informáticos (SAP, CRM…) y términos técnicos indispensables.">
        {pc.glossary.map((g, i) => (
          <div class="inline wrap" key={i}>
            <Field label="Término">
              <Text value={g.term} onChange={(v) => PM((x) => void (x.glossary[i].term = v))} />
            </Field>
            <Field label="Definición" grow>
              <Text value={g.definition} onChange={(v) => PM((x) => void (x.glossary[i].definition = v))} />
            </Field>
            <IconBtn title="Quitar" danger onClick={() => PM((x) => void x.glossary.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn onClick={() => PM((x) => void x.glossary.push({ term: '', definition: '' }))}>Término</AddBtn>
        <label class="check">
          <input type="checkbox" checked={!!pc.noGlossary} onChange={(e) => PM((x) => void (x.noGlossary = (e.target as HTMLInputElement).checked))} />
          No hace falta glosario
        </label>
      </Section>

      <Section title="4 · Desarrollo paso a paso" hint="Es el cuerpo del procedimiento: se redacta en el paso 3 del levantamiento.">
        <p class="hint">
          {pc.steps.length ? `${pc.steps.length} paso(s) redactados.` : 'Aún no hay pasos.'}
        </p>
      </Section>

      <Section title="5 · Anexos y control de cambios" hint="Enlaces a plantillas, formatos y capturas. El historial de versiones se llena solo al publicar.">
        {pc.annexes.map((a, i) => (
          <div class="inline wrap" key={a.id}>
            <Field label="Título" grow>
              <Text value={a.title} onChange={(v) => PM((x) => void (x.annexes[i].title = v))} />
            </Field>
            <Field label="Tipo">
              <Sel
                value={a.kind}
                options={['plantilla', 'formato', 'captura', 'enlace', 'otro'].map((k) => ({ value: k, label: k }))}
                onChange={(v) => PM((x) => void (x.annexes[i].kind = v as Procedure['annexes'][number]['kind']))}
              />
            </Field>
            <Field label="Enlace (opcional)" grow>
              <Text value={a.url ?? ''} placeholder="https://…" onChange={(v) => PM((x) => void (x.annexes[i].url = v))} />
            </Field>
            <IconBtn title="Quitar" danger onClick={() => PM((x) => void x.annexes.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn onClick={() => PM((x) => void x.annexes.push({ id: uid('a'), title: '', kind: 'plantilla' }))}>Anexo</AddBtn>
        {pc.changes.length > 0 && (
          <table class="mini-table">
            <tbody>
              {pc.changes.map((c) => (
                <tr key={c.version}>
                  <td>v{c.version}</td>
                  <td>{c.date}</td>
                  <td>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

// ---------- 3 · Redacción acción-resultado ----------

function Paso3({ ctx, pc, PM, go }: { ctx: HubCtx; pc: Procedure; PM: PM; go: (n: number) => void }) {
  const roles = pc.responsibilities.map((r) => r.role).filter(Boolean);
  const uncovered = uncoveredExceptions(pc);
  const move = (i: number, dir: -1 | 1) =>
    PM((x) => {
      const j = i + dir;
      if (j < 0 || j >= x.steps.length) return;
      [x.steps[i], x.steps[j]] = [x.steps[j], x.steps[i]];
    });
  return (
    <>
      <StepHead ctx={ctx} pc={pc} n={3} PM={PM} go={go} />
      <Card class="guide">
        <b>Estructura ideal de un paso</b>: <code>[Actor]</code> + <code>[Acción]</code> + <code>[Herramienta o medio]</code> + <code>[Resultado esperado]</code>.
        <br />
        Ejemplo: <i>Analista de Cuentas — Registrar la factura · Herramienta: módulo SAP ERP · Resultado: código de validación interna generado.</i>
        <ul>
          <li>Empieza con un verbo en infinitivo o imperativo (Ingresar, Verificar, Descargar, Aprobar).</li>
          <li>Frases cortas: una sola acción por paso numerado.</li>
          <li>El actor es un puesto, no un nombre propio.</li>
        </ul>
      </Card>

      {uncovered.length > 0 && (
        <Card class="uncovered">
          <b>Excepciones del levantamiento sin camino alternativo ({uncovered.length})</b>
          <p class="hint">Los procedimientos fallan si no documentan los caminos alternativos. Cúbrelas en el paso donde ocurren.</p>
          {uncovered.map((e) => (
            <div class="inline wrap" key={e.id}>
              <span class="exc-text">«{e.text}»</span>
              <Sel
                value=""
                options={[{ value: '', label: pc.steps.length ? 'Cubrir en el paso…' : 'Crea primero un paso' }, ...pc.steps.map((s, i) => ({ value: s.id, label: `Paso ${i + 1}: ${s.action.slice(0, 40) || '(sin acción)'}` }))]}
                onChange={(sid) => {
                  if (!sid) return;
                  PM((x) => void x.steps.find((s) => s.id === sid)!.alternatives.push({ id: uid('al'), condition: e.text.trim().replace(/^si\s+/i, ''), action: '', exceptionId: e.id }));
                }}
              />
            </div>
          ))}
        </Card>
      )}

      <Section title="Pasos del procedimiento">
        <datalist id="actores">
          {roles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
        <datalist id="herramientas">
          {pc.glossary.filter((g) => g.term).map((g) => (
            <option key={g.term} value={g.term} />
          ))}
        </datalist>
        {pc.steps.length === 0 && <p class="empty">Aún no hay pasos. Añade el primero.</p>}
        {pc.steps.map((s, i) => {
          const issues = lintStep(ctx.d, s);
          return (
            <Card
              key={s.id}
              class="stage"
              title={
                <span class="stagehead">
                  <span class="num-badge">{i + 1}</span>
                  <span class="sentence">{stepSentence(s)}</span>
                </span>
              }
              actions={
                <>
                  <IconBtn title="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </IconBtn>
                  <IconBtn title="Bajar" disabled={i === pc.steps.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </IconBtn>
                  <IconBtn title="Borrar paso" danger onClick={() => PM((x) => void x.steps.splice(i, 1))}>
                    🗑
                  </IconBtn>
                </>
              }
            >
              <div class="row">
                <Field label="Actor (puesto)">
                  <Text value={s.actor} list="actores" placeholder="Analista de Cuentas" onChange={(v) => PM((x) => void (x.steps[i].actor = v))} />
                </Field>
                <Field label="Acción (verbo + qué)" grow>
                  <Text value={s.action} placeholder="Registrar la factura" onChange={(v) => PM((x) => void (x.steps[i].action = v))} />
                </Field>
              </div>
              <div class="row">
                <Field label="Herramienta o medio">
                  <Text value={s.tool ?? ''} list="herramientas" placeholder="Módulo SAP ERP" onChange={(v) => PM((x) => void (x.steps[i].tool = v))} />
                </Field>
                <Field label="Resultado esperado" grow>
                  <Text value={s.result ?? ''} placeholder="Código de validación interna generado" onChange={(v) => PM((x) => void (x.steps[i].result = v))} />
                </Field>
              </div>
              {issues.length > 0 && (
                <ul class="lint">
                  {issues.map((it, k) => (
                    <li key={k} class={it.level}>
                      {it.level === 'error' ? '✖' : it.level === 'warn' ? '⚠' : 'ℹ'} {it.msg}
                    </li>
                  ))}
                </ul>
              )}
              <div class="subsect">
                <div class="subtitle">Caminos alternativos («si… entonces…»)</div>
                {s.alternatives.map((a, k) => (
                  <div class="inline wrap" key={a.id}>
                    <Field label="Si…" grow>
                      <Text value={a.condition} placeholder="el cliente no envía el documento" onChange={(v) => PM((x) => void (x.steps[i].alternatives[k].condition = v))} />
                    </Field>
                    <Field label="Entonces…" grow>
                      <Text value={a.action} placeholder="Solicitarlo por correo y pausar el caso" onChange={(v) => PM((x) => void (x.steps[i].alternatives[k].action = v))} />
                    </Field>
                    {a.exceptionId && <span class="pill sub">del levantamiento</span>}
                    <IconBtn title="Quitar" danger onClick={() => PM((x) => void x.steps[i].alternatives.splice(k, 1))}>
                      ✕
                    </IconBtn>
                  </div>
                ))}
                <AddBtn onClick={() => PM((x) => void x.steps[i].alternatives.push({ id: uid('al'), condition: '', action: '' }))}>Camino alternativo</AddBtn>
              </div>
            </Card>
          );
        })}
        <AddBtn onClick={() => PM((x) => void x.steps.push({ id: uid('s'), actor: x.steps[x.steps.length - 1]?.actor ?? x.responsibilities[0]?.role ?? '', action: '', alternatives: [] }))}>Añadir paso</AddBtn>
      </Section>
    </>
  );
}

// ---------- 4 · Ayudas visuales ----------

const WARNING_OPTS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Sin advertencia' },
  ...(Object.keys(WARNING_LABEL) as WarningKind[]).map((k) => ({ value: k, label: WARNING_LABEL[k] })),
];

function Paso4({ ctx, pc, PM, go }: { ctx: HubCtx; pc: Procedure; PM: PM; go: (n: number) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const upload = async (stepId: string, file: File | undefined) => {
    if (!file) return;
    setBusy(stepId);
    try {
      const src = await fileToDataUrl(file);
      PM((x) => void (x.steps.find((s) => s.id === stepId)!.image = { src, marks: [], caption: '' }));
    } catch (e) {
      ctx.note((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <StepHead ctx={ctx} pc={pc} n={4} PM={PM} go={go} />
      <Section title="Diagrama de flujo a nivel de tarea" hint="Se dibuja solo con tus pasos: 🛑/⚠ marca los pasos con advertencia, 📷 los que tienen captura y ↳ los que tienen caminos alternativos.">
        <TaskFlow steps={pc.steps} />
      </Section>

      <Section title="Señales de advertencia y capturas anotadas">
        <label class="check">
          <input type="checkbox" checked={pc.digital} onChange={(e) => PM((x) => void (x.digital = (e.target as HTMLInputElement).checked))} />
          Es un procedimiento digital (necesita capturas de pantalla con flechas y círculos)
        </label>
        {pc.steps.length === 0 && <p class="empty">Aún no hay pasos. Redáctalos en el paso 3.</p>}
        {pc.steps.map((s, i) => (
          <Card key={s.id} title={<span class="stagehead"><span class="num-badge">{i + 1}</span><span class="sentence">{s.action || '(sin acción)'}</span></span>}>
            <div class="row">
              <Field label="Señal de advertencia">
                <Sel
                  value={s.warning?.kind ?? ''}
                  options={WARNING_OPTS}
                  onChange={(v) =>
                    PM((x) => {
                      const st = x.steps[i];
                      if (!v) delete st.warning;
                      else st.warning = { kind: v as WarningKind, text: st.warning?.text ?? '' };
                    })
                  }
                />
              </Field>
              {s.warning && (
                <Field label="Texto de la advertencia" grow hint="Ej.: No avanzar sin la firma del director.">
                  <Text value={s.warning.text} onChange={(v) => PM((x) => void (x.steps[i].warning!.text = v))} />
                </Field>
              )}
            </div>
            {s.warning && s.warning.text && <WarningBox warning={s.warning} />}
            <div class="subsect">
              <div class="subtitle">Captura de pantalla</div>
              {!s.image ? (
                <label class="filebtn btn">
                  {busy === s.id ? 'Procesando…' : 'Subir captura…'}
                  <input type="file" accept="image/*" onChange={(e) => upload(s.id, (e.target as HTMLInputElement).files?.[0])} />
                </label>
              ) : (
                <>
                  <Annotator image={s.image} onChange={(img) => PM((x) => void (x.steps[i].image = img))} />
                  <div class="inline">
                    <Field label="Pie de la captura" grow>
                      <Text value={s.image.caption ?? ''} placeholder="Qué se ve y dónde dar clic" onChange={(v) => PM((x) => void (x.steps[i].image!.caption = v))} />
                    </Field>
                    <IconBtn title="Quitar captura" danger onClick={() => PM((x) => void delete x.steps[i].image)}>
                      🗑
                    </IconBtn>
                  </div>
                </>
              )}
            </div>
          </Card>
        ))}
        <label class="check">
          <input type="checkbox" checked={!!pc.noWarnings} onChange={(e) => PM((x) => void (x.noWarnings = (e.target as HTMLInputElement).checked))} />
          Este procedimiento no tiene pasos críticos que advertir
        </label>
      </Section>
    </>
  );
}

// ---------- 5 · Prueba del novato y firma del ejecutor ----------

const SIGN_LABEL: Record<SignStatus, string> = { pendiente: 'Pendiente', conforme: 'Conforme', observado: 'Con observaciones' };

function Paso5({ ctx, pc, PM, go }: { ctx: HubCtx; pc: Procedure; PM: PM; go: (n: number) => void }) {
  const operators = distinctOperators(pc);
  const norm = (s: string) => s.trim().toLowerCase();
  const signFor = (name: string) => pc.signoffs.find((s) => norm(s.name) === norm(name));
  const setSign = (name: string, fn: (s: Procedure['signoffs'][number]) => void) =>
    PM((x) => {
      let s = x.signoffs.find((q) => norm(q.name) === norm(name));
      if (!s) x.signoffs.push((s = { id: uid('g'), name, status: 'pendiente' }));
      fn(s);
    });
  const last = pc.attempts[pc.attempts.length - 1];
  const extra = pc.signoffs.filter((s) => !operators.some((o) => norm(o) === norm(s.name)));
  const [desc, setDesc] = useState('');
  const published = procedureStatus(pc) === 'publicado';

  const publish = () => {
    const probe = structuredClone(pc);
    const r = approveProcedure(probe, ctx.today, desc);
    if (!r.ok) return ctx.note(r.reason ?? 'No se puede publicar.');
    PM((x) => void approveProcedure(x, ctx.today, desc));
    setDesc('');
  };

  return (
    <>
      <StepHead ctx={ctx} pc={pc} n={5} PM={PM} go={go} />
      <Section title="La prueba del novato" hint="Entrega el borrador a una persona del mismo departamento que no haga esta tarea habitualmente. Si logra completarla siguiendo los pasos y sin hacer preguntas, el procedimiento está bien levantado.">
        {pc.attempts.map((a, i) => (
          <div class="inline wrap" key={a.id}>
            <Field label="Quién lo probó" grow>
              <Text value={a.tester} list="operadores" onChange={(v) => PM((x) => void (x.attempts[i].tester = v))} />
              {operators.some((o) => norm(o) === norm(a.tester)) && <span class="hint bad">Debe ser alguien que no haga la tarea habitualmente.</span>}
            </Field>
            <Field label="Fecha">
              <input type="date" value={a.date ?? ''} onInput={(e) => PM((x) => void (x.attempts[i].date = (e.target as HTMLInputElement).value))} />
            </Field>
            <label class="check">
              <input type="checkbox" checked={a.completed} onChange={(e) => PM((x) => void (x.attempts[i].completed = (e.target as HTMLInputElement).checked))} />
              Completó la tarea
            </label>
            <Field label="Preguntas que hizo">
              <Num value={a.questions} min={0} onChange={(v) => PM((x) => void (x.attempts[i].questions = v ?? 0))} />
            </Field>
            <Field label="Qué falló o se aclaró" grow>
              <Text value={a.notes ?? ''} onChange={(v) => PM((x) => void (x.attempts[i].notes = v))} />
            </Field>
            <span class={`pill ${a.completed && a.questions === 0 ? 'end' : 'bad'}`}>{a.completed && a.questions === 0 ? 'Superada' : 'No superada'}</span>
            <IconBtn title="Quitar" danger onClick={() => PM((x) => void x.attempts.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn onClick={() => PM((x) => void x.attempts.push({ id: uid('t'), tester: '', date: ctx.today, completed: false, questions: 0 }))}>Prueba</AddBtn>
        {last && !(last.completed && last.questions === 0) && <p class="hint">Si falla: corrige los pasos (paso 3) y repite la prueba. Cuenta la última.</p>}
      </Section>

      <Section title="Firma del ejecutor" hint="Cada operador que dio la información revisa el documento final y firma su conformidad: así se asegura que lo escrito refleja la realidad.">
        {operators.length === 0 && <p class="empty">No hay operadores en el levantamiento (paso 1).</p>}
        {operators.map((o) => {
          const s = signFor(o);
          return (
            <div class="inline wrap" key={o}>
              <div class="who">
                <b>{o}</b>
                <small>operador consultado</small>
              </div>
              <Field label="Estado">
                <Sel
                  value={s?.status ?? 'pendiente'}
                  options={(Object.keys(SIGN_LABEL) as SignStatus[]).map((k) => ({ value: k, label: SIGN_LABEL[k] }))}
                  onChange={(v) =>
                    setSign(o, (r) => {
                      r.status = v as SignStatus;
                      r.date = v === 'pendiente' ? undefined : ctx.today;
                    })
                  }
                />
              </Field>
              <Field label="Comentario" grow>
                <Text value={s?.comment ?? ''} onChange={(v) => setSign(o, (r) => void (r.comment = v))} />
              </Field>
            </div>
          );
        })}
        {extra.map((s) => (
          <div class="inline wrap" key={s.id}>
            <div class="who">
              <b>{s.name}</b>
              <small>otra firma</small>
            </div>
            <span class="pill">{SIGN_LABEL[s.status]}</span>
          </div>
        ))}
      </Section>

      <Section title="Publicar el procedimiento">
        <p class="lead">Al publicar, queda con número de versión y fecha, y se añade al control de cambios. Para una nueva versión describe qué cambió.</p>
        <div class="inline wrap">
          {pc.version && (
            <Field label="Qué cambió en esta versión" grow>
              <Text value={desc} placeholder="Se añade el caso del padrón caído" onChange={setDesc} />
            </Field>
          )}
          <button type="button" class="btn primary" disabled={procStepsDone(pc) < 5 || (published && !desc.trim())} onClick={publish}>
            {pc.version ? `Publicar versión ${pc.version.replace(/(\d+)\.(\d+)/, (_m, a, b) => `${a}.${Number(b) + 1}`)}` : 'Publicar versión 1.0'}
          </button>
        </div>
        {published && <p class="hint">Publicado: versión <b>{pc.version}</b> el {pc.approvedAt}.</p>}
        {procStepsDone(pc) < 5 && <p class="hint">Completa los 5 pasos (incluido este) para poder publicar.</p>}
      </Section>
    </>
  );
}

// ---------- editor y lista ----------

function Editor({ ctx, pc, back }: { ctx: HubCtx; pc: Procedure; back: () => void }) {
  const [step, setStep] = useState(Math.min(5, (PROC_STEPS.find((s) => !procStepCompleted(pc, s.n))?.n ?? 5)));
  const [view, setView] = useState<'levantar' | 'documento'>('levantar');
  const PM: PM = (fn) =>
    ctx.P((p, d) => {
      const x = p.procedures!.find((q) => q.id === pc.id);
      if (x) fn(x, p, d);
    });
  const stageOptions = [{ value: '', label: '— sin etapa —' }, ...ctx.proc.stages.map((s) => ({ value: s.id, label: s.label ?? s.id }))];
  const status = procedureStatus(pc);

  return (
    <>
      <div class="inline wrap proc-head">
        <button type="button" class="btn" onClick={back}>
          ← Procedimientos
        </button>
        <span class="pill sub">{pc.code}</span>
        <Field label="Título" grow>
          <Text value={pc.title} onChange={(v) => PM((x) => void (x.title = v))} />
        </Field>
        <Field label="Etapa que detalla">
          <Sel
            value={pc.stageId ?? ''}
            options={stageOptions}
            onChange={(v) =>
              PM((x) => {
                if (v) x.stageId = v;
                else delete x.stageId;
              })
            }
          />
        </Field>
        <span class={`pill ${status === 'publicado' ? 'end' : 'warn'}`}>{status === 'publicado' ? `Publicado v${pc.version}` : 'Borrador'}</span>
      </div>
      <div class="hub-modes">
        <div class="seg">
          <button type="button" class={view === 'levantar' ? 'on' : ''} onClick={() => setView('levantar')}>
            Levantar (5 pasos)
          </button>
          <button type="button" class={view === 'documento' ? 'on' : ''} onClick={() => setView('documento')}>
            Documento
          </button>
        </div>
        <span class="hint">{procStepsDone(pc)} de 5 pasos completados</span>
      </div>

      {view === 'documento' ? (
        <ProcDoc ctx={ctx} pc={pc} />
      ) : (
        <div class="doc-layout">
          <ol class="phase-nav">
            {PROC_STEPS.map((s) => {
              const done = procStepCompleted(pc, s.n);
              return (
                <li key={s.key}>
                  <button type="button" class={`${step === s.n ? 'on' : ''}${done ? ' done' : ''}`} onClick={() => setStep(s.n)}>
                    <span class="num-badge">{done ? '✔' : s.n}</span>
                    <span>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div class="form">
            {step === 1 && <Paso1 ctx={ctx} pc={pc} PM={PM} go={setStep} />}
            {step === 2 && <Paso2 ctx={ctx} pc={pc} PM={PM} go={setStep} />}
            {step === 3 && <Paso3 ctx={ctx} pc={pc} PM={PM} go={setStep} />}
            {step === 4 && <Paso4 ctx={ctx} pc={pc} PM={PM} go={setStep} />}
            {step === 5 && <Paso5 ctx={ctx} pc={pc} PM={PM} go={setStep} />}
          </div>
        </div>
      )}
    </>
  );
}

export function Procedimientos({ ctx }: { ctx: HubCtx }) {
  const [sel, setSel] = useState<string | null>(null);
  const list = ctx.proc.procedures ?? [];
  const pc = list.find((p) => p.id === sel);
  const cov = procedureCoverage(ctx.proc);

  const create = (stageId?: string) => {
    const created = newProcedure(ctx.d, ctx.proc, stageId);
    ctx.P((p) => void (p.procedures ??= []).push(created));
    setSel(created.id);
  };

  if (pc) return <Editor ctx={ctx} pc={pc} back={() => setSel(null)} />;

  return (
    <div class="form">
      <details class="infobox">
        <summary>¿Proceso o procedimiento?</summary>
        <table class="mini-table">
          <thead>
            <tr>
              <th />
              <th>Proceso</th>
              <th>Procedimiento</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Enfoque</td><td>Estratégico / macro</td><td>Táctico / micro</td></tr>
            <tr><td>Responde a</td><td>¿Qué se hace? y ¿Para qué?</td><td>¿Cómo se hace? y ¿Quién lo hace?</td></tr>
            <tr><td>Formato común</td><td>Diagrama de flujo (departamentos)</td><td>Documento narrativo + capturas de pantalla</td></tr>
            <tr><td>Se levanta con…</td><td>Directores y dueños</td><td>Los operadores directos</td></tr>
          </tbody>
        </table>
        <p class="hint">Un procedimiento detalla una <b>etapa</b> del proceso, con tanta claridad que cualquier persona capacitada pueda ejecutarla sin errores.</p>
      </details>

      <Section
        title="Cobertura: etapas con procedimiento"
        hint="Cada etapa con trabajo debería tener su procedimiento publicado."
        action={<AddBtn onClick={() => create()}>Nuevo procedimiento</AddBtn>}
      >
        <table class="impact">
          <thead>
            <tr>
              <th>Etapa</th>
              <th>Procedimientos</th>
              <th>Publicados</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cov.map((c) => (
              <tr key={c.stageId}>
                <td>{c.label}</td>
                <td>{c.procedures}</td>
                <td class={c.published ? 'good' : ''}>{c.published}</td>
                <td>
                  <button type="button" class="btn small" onClick={() => create(c.stageId)}>
                    + Crear
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Procedimientos de este proceso">
        {list.length === 0 && <p class="empty">Aún no hay procedimientos. Crea el primero desde la tabla de arriba.</p>}
        {list.map((p) => (
          <Card
            key={p.id}
            class="proccard"
            title={
              <span class="stagehead">
                <span class="pill sub">{p.code}</span>
                <b>{p.title}</b>
              </span>
            }
            actions={
              <IconBtn
                title="Borrar procedimiento"
                danger
                onClick={() => {
                  if (confirm(`¿Borrar el procedimiento ${p.code}?`)) ctx.P((x, c) => {
                      x.procedures = (x.procedures ?? []).filter((q) => q.id !== p.id);
                      dropDanglingDependencies(c);
                    });
                }}
              >
                🗑
              </IconBtn>
            }
          >
            <div class="inline wrap">
              <span class="hint">Etapa: {stageLabel(ctx.proc, p.stageId)}</span>
              <span class="hint">{procStepsDone(p)}/5 pasos</span>
              <span class="hint">{p.steps.length} paso(s) redactados</span>
              {allFieldExceptions(p).length > 0 && <span class="hint">{allFieldExceptions(p).length} excepción(es)</span>}
              <span class={`pill ${procedureStatus(p) === 'publicado' ? 'end' : 'warn'}`}>{procedureStatus(p) === 'publicado' ? `Publicado v${p.version}` : 'Borrador'}</span>
              <button type="button" class="btn primary" onClick={() => setSel(p.id)}>
                Abrir
              </button>
            </div>
          </Card>
        ))}
      </Section>
    </div>
  );
}
