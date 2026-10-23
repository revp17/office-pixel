import { useState } from 'preact/hooks';
import type { CompanyDef, NextRule, OrgProcessDef, OrgStageDef } from '@office-pixel/sim';
import { describeDuration, dropDanglingDependencies, type ProcessDependency } from '@office-pixel/sim';
import { DependencyMap, DependencySummary } from '../process/depmap';
import {
  OPS,
  addProcess,
  addStage,
  moveProcess,
  normalizeAttrName,
  defaultDist,
  flatUnits,
  formatCondition,
  parseCondition,
  removeStage,
  renameAttribute,
  rolesIn,
  toRules,
  uniqueId,
  usage,
  type Op,
} from './model';
import { AddBtn, Card, DistEditor, Field, IconBtn, NameInput, Num, Pct, Sel, Section, Text, type TabProps } from './ui';

type PMut = (fn: (p: OrgProcessDef, d: CompanyDef) => void) => void;

export function ProcesosTab({ d, up, note }: TabProps) {
  const [sel, setSel] = useState(d.processes[0]?.id ?? '');
  const proc = d.processes.find((p) => p.id === sel) ?? d.processes[0];

  const P: PMut = (fn) =>
    up((x) => {
      const p = x.processes.find((q) => q.id === proc.id);
      if (p) fn(p, x);
    });

  return (
    <div class="procs">
      <aside class="proclist">
        {d.processes.map((p, i) => (
          <div class="procrow" key={p.id}>
            <button type="button" class={`procbtn${p.id === proc?.id ? ' on' : ''}`} onClick={() => setSel(p.id)}>
              <span>
                <b class="procnum">{i + 1}.</b> {p.name ?? p.id}
              </span>
              <small>{p.stages.length} etapas</small>
            </button>
            {d.processes.length > 1 && (
              <span class="procmove">
                <IconBtn title="Subir (va antes)" disabled={i === 0} onClick={() => up((x) => void moveProcess(x, p.id, 'up'))}>
                  ▲
                </IconBtn>
                <IconBtn title="Bajar (va después)" disabled={i === d.processes.length - 1} onClick={() => up((x) => void moveProcess(x, p.id, 'down'))}>
                  ▼
                </IconBtn>
              </span>
            )}
          </div>
        ))}
        <AddBtn
          onClick={() => {
            if (!d.people.length) return note('Crea primero al menos una persona.');
            const probe = structuredClone(d);
            const created = addProcess(probe);
            up((x) => void addProcess(x));
            note('Proceso añadido al final de la lista. Usa ▲ ▼ para ponerlo donde lo necesites.');
            setSel(created.id);
          }}
        >
          Nuevo proceso
        </AddBtn>
      </aside>

      {!proc ? (
        <p class="empty">Aún no hay procesos. Crea el primero con «Nuevo proceso».</p>
      ) : (
        <div class="form" key={proc.id}>
          <Card
            title={<span class="pill">Proceso</span>}
            actions={
              <IconBtn
                title="Borrar proceso"
                danger
                onClick={() => {
                  if (d.processes.length === 1) return note('Debe quedar al menos un proceso.');
                  if (!confirm(`¿Borrar el proceso «${proc.name ?? proc.id}»?`)) return;
                  up((x) => {
                    x.processes = x.processes.filter((q) => q.id !== proc.id);
                    dropDanglingDependencies(x);
                  });
                  setSel('');
                }}
              >
                🗑
              </IconBtn>
            }
          >
            <Field label="Nombre del proceso">
              <Text value={proc.name ?? proc.id} onChange={(v) => P((p) => void (p.name = v))} />
            </Field>
          </Card>

          <Llegadas proc={proc} P={P} />
          <Dependencias d={d} proc={proc} P={P} onSelect={setSel} />
          <Datos proc={proc} P={P} note={note} />

          <Section title="Etapas" hint="El caso recorre las etapas en orden. Cada etapa la hace una persona con el rol indicado, en el área o subárea indicada.">
            {proc.stages.map((st, i) => (
              <StageCard key={st.id} d={d} proc={proc} st={st} i={i} P={P} note={note} />
            ))}
            <AddBtn onClick={() => P((p, x) => void addStage(p, x))}>Añadir etapa</AddBtn>
          </Section>
        </div>
      )}
    </div>
  );
}

function Llegadas({ proc, P }: { proc: OrgProcessDef; P: PMut }) {
  const a = proc.arrivals;
  return (
    <Section title="¿Cada cuánto llegan casos nuevos?" hint="Solo llegan en horario laboral.">
      <div class="row">
        <Field label="Tipo de llegada">
          <Sel
            value={a.type}
            options={[
              { value: 'poisson', label: 'Al azar (promedio por hora)' },
              { value: 'constant', label: 'Regular (uno cada cierto tiempo)' },
            ]}
            onChange={(v) =>
              P((p) => void (p.arrivals = v === 'poisson' ? { type: 'poisson', ratePerHour: 4 } : { type: 'constant', everyMinutes: 15 }))
            }
          />
        </Field>
        {a.type === 'poisson' ? (
          <Field label="Casos por hora hábil">
            <Num value={a.ratePerHour} min={0.1} step={0.5} onChange={(v) => P((p) => void (p.arrivals = { type: 'poisson', ratePerHour: v || 1 }))} />
          </Field>
        ) : (
          <Field label="Un caso cada">
            <Num value={a.everyMinutes} min={1} suffix="min" onChange={(v) => P((p) => void (p.arrivals = { type: 'constant', everyMinutes: v || 1 }))} />
          </Field>
        )}
      </div>
    </Section>
  );
}

function Datos({ proc, P, note }: { proc: OrgProcessDef; P: PMut; note: (m: string) => void }) {
  const entries = Object.entries(proc.attributes ?? {});
  return (
    <Section
      title="Datos de cada caso"
      hint="Valores que lleva cada caso (por ejemplo, un monto). Sirven para decidir el camino en «Según condiciones»."
    >
      {entries.map(([key, spec], idx) => (
        <div class="inline wrap" key={idx}>
          <Field label="Nombre del dato" hint="Se confirma al salir del campo. Solo letras, números y _. Los espacios se vuelven _ y las tildes se quitan (Guía → Guia).">
            <NameInput
              value={key}
              onCommit={(v) => {
                const nk = normalizeAttrName(v);
                if (!nk) return note('El nombre del dato no puede quedar vacío.') ?? 'vacío';
                if (nk === key) return;
                if ((proc.attributes ?? {})[nk]) return note(`Ya hay un dato llamado «${nk}».`) ?? 'repetido';
                P((p) => renameAttribute(p, key, nk));
              }}
            />
          </Field>
          <Field label="Cómo varía entre casos">
            <DistEditor spec={spec} minutes={false} onChange={(s) => P((p) => void (p.attributes![key] = s))} />
          </Field>
          <IconBtn
            title="Quitar dato"
            danger
            onClick={() =>
              P((p) => {
                delete p.attributes![key];
                if (!Object.keys(p.attributes!).length) delete p.attributes;
              })
            }
          >
            ✕
          </IconBtn>
        </div>
      ))}
      <AddBtn
        onClick={() =>
          P((p) => {
            const name = uniqueId('dato', new Set(Object.keys(p.attributes ?? {})));
            (p.attributes ??= {})[name] = { dist: 'lognormal', median: 100, sigma: 0.5 };
          })
        }
      >
        Añadir dato
      </AddBtn>
    </Section>
  );
}

export function StageCard(props: {
  d: CompanyDef;
  proc: OrgProcessDef;
  st: OrgStageDef;
  i: number;
  P: PMut;
  note: (m: string) => void;
  /** el tiempo y el plazo no se pueden tocar (en la optimización solo se acelera en el paso 4) */
  lockTiming?: boolean;
  /** muestra «la hace un sistema»; en la optimización eso es solo del paso 5 */
  allowAutomation?: boolean;
}) {
  const { d, proc, st, i, P, note, lockTiming = false, allowAutomation = true } = props;
  const S = (fn: (s: OrgStageDef, p: OrgProcessDef, x: CompanyDef) => void) =>
    P((p, x) => {
      const s = p.stages.find((q) => q.id === st.id);
      if (s) fn(s, p, x);
    });

  const needsWork = !!(st.unit || st.duration);
  const others = proc.stages.filter((s) => s.id !== st.id).map((s) => ({ value: s.id, label: s.label ?? s.id }));
  const unitOptions = flatUnits(d.units).map(({ unit, depth }) => ({
    value: unit.id,
    label: `${'  '.repeat(depth)}${unit.name ?? unit.id}${usage(d, unit.id).people ? '' : ' (sin personas)'}`,
  }));
  const roles = rolesIn(d, st.unit);
  const roleOptions = [{ value: '', label: '(cualquier rol)' }, ...roles.map((r) => ({ value: r, label: r }))];

  const move = (dir: -1 | 1) =>
    P((p) => {
      const j = i + dir;
      if (j < 0 || j >= p.stages.length) return;
      [p.stages[i], p.stages[j]] = [p.stages[j], p.stages[i]];
    });

  const setTerminal = (on: boolean) =>
    S((s, p, x) => {
      if (on) {
        s.terminal = true;
        delete s.next;
      } else {
        delete s.terminal;
        const after = p.stages[p.stages.indexOf(s) + 1] ?? p.stages.find((q) => q.id !== s.id);
        s.next = after?.id;
        if (!s.unit) s.unit = x.people[0]?.unit;
        if (!s.duration) s.duration = defaultDist('normal', true);
      }
    });

  const setNeedsWork = (on: boolean) =>
    S((s, _p, x) => {
      if (on) {
        s.unit ??= x.people[0]?.unit;
        s.role ??= x.people.find((q) => q.unit === s.unit)?.role;
        s.duration ??= defaultDist('normal', true);
      } else {
        delete s.unit;
        delete s.role;
        delete s.skill;
        delete s.duration;
        delete s.sla;
        delete s.exceptions;
      }
    });

  const mode: 'single' | 'rules' = Array.isArray(st.next) ? 'rules' : 'single';

  // continuación en otro proceso: vive en el proceso destino, como una dependencia «dispara» desde esta etapa
  const otherProcs = d.processes.filter((q) => q.id !== proc.id);
  const links = d.processes.flatMap((q) =>
    (q.dependsOn ?? []).filter((dep) => dep.process === proc.id && dep.kind === 'dispara' && dep.atStage === st.id).map((dep) => ({ q, dep })),
  );
  const link = links[0];
  const crossOptions = [
    { value: '', label: 'No: el caso termina aquí' },
    ...otherProcs.flatMap((q) => q.stages.map((s2, k) => ({ value: `${q.id}|${s2.id}`, label: `${q.name ?? q.id} › ${s2.label ?? s2.id}${k === 0 ? ' (primera etapa)' : ''}` }))),
  ];
  const setLink = (v: string) =>
    P((_p, x) => {
      // se quitan las continuaciones anteriores de esta etapa y se crea la nueva
      for (const q of x.processes) {
        if (!q.dependsOn) continue;
        q.dependsOn = q.dependsOn.filter((dep) => !(dep.process === proc.id && dep.kind === 'dispara' && dep.atStage === st.id));
        if (!q.dependsOn.length) delete q.dependsOn;
      }
      if (!v) return;
      const [pid, sid] = v.split('|');
      const target = x.processes.find((q) => q.id === pid)!;
      (target.dependsOn ??= []).push({ process: proc.id, kind: 'dispara', atStage: st.id, toStage: sid, inherit: true });
    });
  const setInherit = (on: boolean) =>
    P((_p, x) => {
      for (const q of x.processes)
        for (const dep of q.dependsOn ?? []) if (dep.process === proc.id && dep.kind === 'dispara' && dep.atStage === st.id) dep.inherit = on || undefined;
    });

  return (
    <Card
      class="stage"
      title={
        <span class="stagehead">
          <span class="num-badge">{i + 1}</span>
          <Text value={st.label ?? st.id} onChange={(v) => S((s) => void (s.label = v))} />
          {st.terminal && <span class="pill end">Final</span>}
        </span>
      }
      actions={
        <>
          <IconBtn title="Subir" disabled={i === 0} onClick={() => move(-1)}>
            ↑
          </IconBtn>
          <IconBtn title="Bajar" disabled={i === proc.stages.length - 1} onClick={() => move(1)}>
            ↓
          </IconBtn>
          <IconBtn
            title="Borrar etapa"
            danger
            onClick={() => {
              if (proc.stages.length <= 2) return note('Un proceso necesita al menos dos etapas.');
              P((p, x) => {
                removeStage(p, st.id);
                dropDanglingDependencies(x);
              });
            }}
          >
            🗑
          </IconBtn>
        </>
      }
    >
      <label class="check">
        <input type="checkbox" checked={!!st.terminal} onChange={(e) => setTerminal((e.target as HTMLInputElement).checked)} />
        Es el final del proceso (el caso se cierra aquí)
      </label>
      {st.terminal && (
        <label class="check">
          <input type="checkbox" checked={needsWork} onChange={(e) => setNeedsWork((e.target as HTMLInputElement).checked)} />
          Alguien debe trabajar antes de cerrar
        </label>
      )}

      {needsWork && (
        <>
          <div class="row">
            <Field label="Área / subárea que la hace" grow>
              <Sel
                value={st.unit ?? ''}
                options={unitOptions}
                onChange={(v) =>
                  S((s, _p, x) => {
                    s.unit = v;
                    const r = rolesIn(x, v);
                    if (s.role && !r.includes(s.role)) s.role = r[0];
                  })
                }
              />
            </Field>
            <Field label="Rol de quien la hace" grow hint={roles.length ? undefined : 'Nadie ahí tiene aún un rol.'}>
              <Sel
                value={st.role ?? ''}
                options={roleOptions}
                onChange={(v) =>
                  S((s) => {
                    if (v) s.role = v;
                    else delete s.role;
                  })
                }
              />
            </Field>
          </div>
          {allowAutomation && !st.terminal && (
            <label class="check">
              <input
                type="checkbox"
                checked={!!st.automated}
                onChange={(e) =>
                  S((s) => {
                    if ((e.target as HTMLInputElement).checked) s.automated = true;
                    else delete s.automated;
                  })
                }
              />
              La hace un sistema, sin personas (ya está automatizada hoy)
            </label>
          )}
          {lockTiming ? (
            <p class="hint">
              Duración {st.duration ? describeDuration(st.duration) : '—'}
              {st.sla ? ` · plazo ${Math.round((st.sla.maxMinutes / 60) * 10) / 10} h` : ''} — el tiempo se toca en el paso 4 (acelerar), no antes.
            </p>
          ) : (
            <div class="row">
              <Field label="Cuánto tarda (a velocidad normal)" grow>
                <DistEditor spec={st.duration ?? defaultDist('normal', true)} minutes onChange={(s2) => S((s) => void (s.duration = s2))} />
              </Field>
              <Field label="Plazo máximo (SLA)" hint="Horas hábiles desde que llega a esta etapa. Vacío = sin plazo.">
                <Num
                  value={st.sla ? Math.round((st.sla.maxMinutes / 60) * 10) / 10 : undefined}
                  min={0.1}
                  step={0.5}
                  suffix="h"
                  onChange={(v) =>
                    S((s) => {
                      if (!v) delete s.sla;
                      else s.sla = { maxMinutes: Math.round(v * 60) };
                    })
                  }
                />
              </Field>
            </div>
          )}
        </>
      )}

      {!st.terminal && (
        <div class="subsect">
          <div class="subtitle">¿A dónde va después?</div>
          <div class="segmented">
            <button
              type="button"
              class={mode === 'single' ? 'on' : ''}
              onClick={() =>
                S((s) => {
                  if (Array.isArray(s.next)) s.next = s.next.find((r) => r.otherwise)?.to || others[0]?.value;
                })
              }
            >
              Siempre a la misma etapa
            </button>
            <button
              type="button"
              class={mode === 'rules' ? 'on' : ''}
              onClick={() => S((s) => void (s.next = toRules(s.next, others[0]?.value ?? '')))}
            >
              Según condiciones
            </button>
          </div>
          {mode === 'single' ? (
            <Field label="Siguiente etapa">
              <Sel value={typeof st.next === 'string' ? st.next : ''} options={others} onChange={(v) => S((s) => void (s.next = v))} />
            </Field>
          ) : (
            <Rules proc={proc} st={st} others={others} S={S} note={note} />
          )}
        </div>
      )}

      {!lockTiming && otherProcs.length > 0 && (
        <div class="subsect">
          <div class="subtitle">¿Continúa en otro proceso?</div>
          <p class="sect-hint">
            Al terminar esta etapa nace un caso en la etapa que elijas de otro proceso (como si ese proceso «heredara» el trabajo). Si esta es la última etapa, márcala como final para que el caso se cierre aquí
            y siga allá.
          </p>
          <Field label="Sigue en…">
            <Sel value={link ? `${link.q.id}|${link.dep.toStage ?? link.q.stages[0].id}` : ''} options={crossOptions} onChange={setLink} />
          </Field>
          {link && (
            <>
              <label class="check">
                <input type="checkbox" checked={!!link.dep.inherit} onChange={(e) => setInherit((e.target as HTMLInputElement).checked)} />
                El caso nuevo hereda los datos de este caso (monto, prioridad…)
              </label>
              {!st.terminal && <p class="hint">Esta etapa no es final: el caso original también sigue su camino aquí, además del caso nuevo en el otro proceso.</p>}
              {links.length > 1 && <p class="hint">Hay {links.length} continuaciones desde esta etapa; el resto se ven y editan en «Dependencias» de cada proceso.</p>}
            </>
          )}
        </div>
      )}

      {needsWork && (
        <div class="subsect">
          <div class="subtitle">Excepciones</div>
          <p class="sect-hint">Cosas que pueden salir mal al terminar esta etapa. Con cierta probabilidad el caso salta a otra etapa.</p>
          {(st.exceptions ?? []).map((e, j) => (
            <div class="inline wrap" key={j}>
              <Field label="Qué pasa">
                <Text value={e.id} placeholder="p. ej. documento ilegible" onChange={(v) => S((s) => void (s.exceptions![j].id = v))} />
              </Field>
              <Field label="Probabilidad">
                <Pct value={e.probability} onChange={(v) => S((s) => void (s.exceptions![j].probability = v ?? 0))} />
              </Field>
              <Field label="El caso pasa a">
                <Sel value={e.target} options={others} onChange={(v) => S((s) => void (s.exceptions![j].target = v))} />
              </Field>
              <Field label="Demora">
                <Num value={e.penaltyMinutes ?? 0} min={0} suffix="min" onChange={(v) => S((s) => void (s.exceptions![j].penaltyMinutes = v ?? 0))} />
              </Field>
              <IconBtn title="Quitar excepción" danger onClick={() => S((s) => void s.exceptions!.splice(j, 1))}>
                ✕
              </IconBtn>
            </div>
          ))}
          <AddBtn
            onClick={() =>
              S((s, p) => {
                const target = p.stages.find((q) => q.id !== s.id)?.id ?? s.id;
                (s.exceptions ??= []).push({ id: `excepción ${(s.exceptions?.length ?? 0) + 1}`, probability: 0.05, action: 'goto', target, penaltyMinutes: 0 });
              })
            }
          >
            Añadir excepción
          </AddBtn>
        </div>
      )}
    </Card>
  );
}

function Rules(props: {
  proc: OrgProcessDef;
  st: OrgStageDef;
  others: Array<{ value: string; label: string }>;
  S: (fn: (s: OrgStageDef, p: OrgProcessDef, x: CompanyDef) => void) => void;
  note: (m: string) => void;
}) {
  const { proc, st, others, S, note } = props;
  const rules = st.next as NextRule[];
  const attrs = Object.keys(proc.attributes ?? {});
  const attrOptions = attrs.map((a) => ({ value: a, label: a }));
  const otherwise = rules.find((r) => r.otherwise);
  const conds = rules.map((r, idx) => ({ r, idx })).filter(({ r }) => !r.otherwise);

  const setRule = (idx: number, fn: (r: NextRule) => void) => S((s) => void fn((s.next as NextRule[])[idx]));
  const swap = (a: number, b: number) =>
    S((s) => {
      const l = s.next as NextRule[];
      [l[a], l[b]] = [l[b], l[a]];
    });

  return (
    <div class="rules">
      {conds.length === 0 && <p class="empty">Aún no hay condiciones. Añade una y el resto de casos irán a «en cualquier otro caso».</p>}
      {conds.map(({ r, idx }, n) => {
        const simple = parseCondition(r.when);
        return (
          <div class="rule" key={idx}>
            <span class="if">{n === 0 ? 'Si' : 'Si no, y si'}</span>
            {simple ? (
              <>
                <Sel
                  value={simple.attr}
                  options={attrOptions}
                  onChange={(v) => setRule(idx, (q) => void (q.when = formatCondition({ ...simple, attr: v })))}
                />
                <Sel
                  value={simple.op}
                  options={OPS.map((o) => ({ value: o.op, label: o.label }))}
                  onChange={(v) => setRule(idx, (q) => void (q.when = formatCondition({ ...simple, op: v as Op })))}
                />
                <Num value={simple.value} onChange={(v) => setRule(idx, (q) => void (q.when = formatCondition({ ...simple, value: v ?? 0 })))} />
              </>
            ) : (
              <Text class="expr" value={r.when ?? ''} placeholder="case.monto > 100 && case.vip == 1" onChange={(v) => setRule(idx, (q) => void (q.when = v))} />
            )}
            <span class="then">entonces ir a</span>
            <Sel value={r.to} options={others} onChange={(v) => setRule(idx, (q) => void (q.to = v))} />
            <IconBtn title="Subir" disabled={n === 0} onClick={() => swap(idx, conds[n - 1].idx)}>
              ↑
            </IconBtn>
            <IconBtn title="Bajar" disabled={n === conds.length - 1} onClick={() => swap(idx, conds[n + 1].idx)}>
              ↓
            </IconBtn>
            <IconBtn title="Quitar condición" danger onClick={() => S((s) => void (s.next as NextRule[]).splice(idx, 1))}>
              ✕
            </IconBtn>
          </div>
        );
      })}
      <div class="rule otherwise">
        <span class="if">En cualquier otro caso, ir a</span>
        <Sel
          value={otherwise?.to ?? ''}
          options={others}
          onChange={(v) =>
            S((s) => {
              const l = s.next as NextRule[];
              const o = l.find((q) => q.otherwise);
              if (o) o.to = v;
              else l.push({ otherwise: true, to: v });
            })
          }
        />
      </div>
      <AddBtn
        onClick={() => {
          if (!attrs.length) return note('Primero añade un «Dato de cada caso» (arriba) para poder usarlo en una condición.');
          S((s) => {
            const l = s.next as NextRule[];
            const at = l.findIndex((q) => q.otherwise);
            const rule: NextRule = { when: formatCondition({ attr: attrs[0], op: '>', value: 0 }), to: others[0]?.value ?? '' };
            l.splice(at < 0 ? l.length : at, 0, rule);
          });
        }}
      >
        Añadir condición
      </AddBtn>
    </div>
  );
}

const KIND_OPTIONS = [
  { value: 'dispara', label: 'Dispara: al terminar nace un caso aquí' },
  { value: 'requiere', label: 'Requiere: necesita su resultado (informativa)' },
];

/** De qué otros procesos depende este: cada dependencia se ve en el mapa y, si "dispara", también se simula. */
function Dependencias({ d, proc, P, onSelect }: { d: CompanyDef; proc: OrgProcessDef; P: PMut; onSelect: (id: string) => void }) {
  const others = d.processes.filter((p) => p.id !== proc.id);
  const deps = proc.dependsOn ?? [];
  const edit = (i: number, fn: (x: ProcessDependency) => void) => P((p) => void fn(p.dependsOn![i]));
  return (
    <Section
      title="Dependencias con otros procesos"
      hint="Un proceso puede nacer de otro (por ejemplo, un pedido dispara su despacho) o necesitar su resultado. Se ven en el mapa de dependencias."
    >
      {deps.length === 0 && <p class="empty">Este proceso no depende de ningún otro.</p>}
      {deps.map((dep, i) => {
        const from = d.processes.find((p) => p.id === dep.process);
        return (
          <div class="depcard" key={i}>
            <div class="row">
              <Field label="Depende de">
                <Sel
                  value={dep.process}
                  options={others.map((p) => ({ value: p.id, label: p.name ?? p.id }))}
                  onChange={(v) => edit(i, (x) => void ((x.process = v), delete x.atStage))}
                />
              </Field>
              <Field label="Tipo de dependencia">
                <Sel value={dep.kind} options={KIND_OPTIONS} onChange={(v) => edit(i, (x) => void (x.kind = v as ProcessDependency['kind']))} />
              </Field>
            </div>
            <div class="row">
              <Field label="¿En qué momento del otro proceso?">
                <Sel
                  value={dep.atStage ?? ''}
                  options={[{ value: '', label: 'Cuando se completa un caso' }, ...(from?.stages ?? []).map((s) => ({ value: s.id, label: `Al terminar «${s.label ?? s.id}»` }))]}
                  onChange={(v) => edit(i, (x) => void (v ? (x.atStage = v) : delete x.atStage))}
                />
              </Field>
              {dep.kind === 'dispara' && (
                <Field label="Casos que lo disparan" hint="100 % = cada caso del otro proceso genera uno aquí.">
                  <Pct value={dep.probability ?? 1} onChange={(v) => edit(i, (x) => void (v === undefined || v >= 1 ? delete x.probability : (x.probability = Math.max(v, 0.01))))} />
                </Field>
              )}
            </div>
            {dep.kind === 'dispara' && (
              <div class="row">
                <Field label="¿Por qué etapa entra el caso nuevo?" hint="Por defecto, la primera de este proceso.">
                  <Sel
                    value={dep.toStage ?? ''}
                    options={[{ value: '', label: 'La primera etapa' }, ...proc.stages.map((s) => ({ value: s.id, label: s.label ?? s.id }))]}
                    onChange={(v) => edit(i, (x) => void (v ? (x.toStage = v) : delete x.toStage))}
                  />
                </Field>
                <label class="check" style={{ alignSelf: 'end' }}>
                  <input type="checkbox" checked={!!dep.inherit} onChange={(e) => edit(i, (x) => void ((e.target as HTMLInputElement).checked ? (x.inherit = true) : delete x.inherit))} />
                  Hereda los datos del caso de origen
                </label>
              </div>
            )}
            <div class="row">
              <Field label="Nota (opcional)">
                <Text value={dep.note ?? ''} onChange={(v) => edit(i, (x) => void (v ? (x.note = v) : delete x.note))} />
              </Field>
              <IconBtn title="Quitar dependencia" danger onClick={() => P((p) => void (p.dependsOn!.splice(i, 1), p.dependsOn!.length || delete p.dependsOn))}>
                ✕
              </IconBtn>
            </div>
          </div>
        );
      })}
      {others.length > 0 && (
        <AddBtn onClick={() => P((p) => void (p.dependsOn = [...(p.dependsOn ?? []), { process: others[0].id, kind: 'dispara' }]))}>Añadir dependencia</AddBtn>
      )}
      {others.length === 0 && <p class="empty">Hacen falta al menos dos procesos para declarar una dependencia.</p>}
      <DependencySummary def={d} procId={proc.id} />
      <DependencyMap def={d} selected={proc.id} onSelect={onSelect} />
    </Section>
  );
}
