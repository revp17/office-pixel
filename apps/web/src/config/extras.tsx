import { useState } from 'preact/hooks';
import { companyToYaml, parseCompany, type CompanyDef } from '@office-pixel/sim';
import { flatUnits, uniqueId } from './model';
import { AddBtn, Card, Days, Field, IconBtn, Num, Sel, Section, Text, Time, type TabProps } from './ui';

// ---------- Horarios, reuniones y ausencias ----------

export function HorariosTab({ d, up, note }: TabProps) {
  const schedules = Object.entries(d.schedules ?? {});
  const meetings = d.meetings ?? [];
  const absences = d.scenario?.absences ?? [];
  const unitOptions = flatUnits(d.units).map(({ unit, depth }) => ({
    value: unit.id,
    label: `${'  '.repeat(depth)}${unit.name ?? unit.id}`,
  }));
  const personOptions = d.people.map((p) => ({ value: p.id, label: p.name ?? p.id }));

  const renameSchedule = (from: string, to: string) => {
    const name = to.trim();
    if (!name || name === from) return;
    if (d.schedules?.[name]) return note(`Ya existe un horario llamado «${name}».`);
    up((x) => {
      x.schedules = Object.fromEntries(Object.entries(x.schedules!).map(([k, v]) => [k === from ? name : k, v]));
      for (const p of x.people) if (p.schedule === from) p.schedule = name;
    });
  };

  return (
    <div class="form">
      <Section
        title="Horarios especiales (turnos)"
        hint="Para personas que no siguen la jornada general, como un turno de tarde. Luego se asignan en la pestaña Personas."
      >
        {schedules.length === 0 && <p class="empty">Todos usan la jornada general.</p>}
        {schedules.map(([key, s]) => (
          <Card key={key} actions={
            <IconBtn
              title="Borrar horario"
              danger
              onClick={() => {
                if (d.people.some((p) => p.schedule === key)) return note('Hay personas con este horario. Cámbialas primero.');
                up((x) => {
                  delete x.schedules![key];
                  if (!Object.keys(x.schedules!).length) delete x.schedules;
                });
              }}
            >
              🗑
            </IconBtn>
          }>
            <div class="row">
              <Field label="Nombre" grow>
                <Text value={key} onChange={(v) => renameSchedule(key, v)} />
              </Field>
              <Field label="Entrada">
                <Time value={s.hours.start} onChange={(v) => up((x) => void (x.schedules![key].hours.start = v))} />
              </Field>
              <Field label="Salida">
                <Time value={s.hours.end} onChange={(v) => up((x) => void (x.schedules![key].hours.end = v))} />
              </Field>
            </div>
            <Field label="Pausas">
              <div class="list">
                {(s.breaks ?? []).map((b, i) => (
                  <div class="inline" key={i}>
                    <Time value={b.start} onChange={(v) => up((x) => void (x.schedules![key].breaks![i].start = v))} />
                    <span>a</span>
                    <Time value={b.end} onChange={(v) => up((x) => void (x.schedules![key].breaks![i].end = v))} />
                    <IconBtn title="Quitar pausa" danger onClick={() => up((x) => void x.schedules![key].breaks!.splice(i, 1))}>
                      ✕
                    </IconBtn>
                  </div>
                ))}
                <AddBtn onClick={() => up((x) => void (x.schedules![key].breaks = [...(x.schedules![key].breaks ?? []), { start: '13:00', end: '14:00' }]))}>
                  Añadir pausa
                </AddBtn>
              </div>
            </Field>
          </Card>
        ))}
        <AddBtn
          onClick={() =>
            up((x) => {
              const name = uniqueId('turno', new Set(Object.keys(x.schedules ?? {})));
              (x.schedules ??= {})[name] = { hours: { start: '12:00', end: '21:00' }, breaks: [{ start: '16:00', end: '17:00' }] };
            })
          }
        >
          Añadir horario
        </AddBtn>
      </Section>

      <Section title="Reuniones recurrentes" hint="Bloquean a todas las personas del equipo (y sus subequipos) mientras duran.">
        {meetings.length === 0 && <p class="empty">No hay reuniones.</p>}
        {meetings.map((m, i) => (
          <div class="inline wrap" key={i}>
            <Field label="Reunión">
              <Text value={m.id} onChange={(v) => up((x) => void (x.meetings![i].id = v))} />
            </Field>
            <Field label="Equipo">
              <Sel value={m.unit} options={unitOptions} onChange={(v) => up((x) => void (x.meetings![i].unit = v))} />
            </Field>
            <Field label="Empieza">
              <Time value={m.start} onChange={(v) => up((x) => void (x.meetings![i].start = v))} />
            </Field>
            <Field label="Dura">
              <Num value={m.minutes} min={5} suffix="min" onChange={(v) => up((x) => void (x.meetings![i].minutes = v || 5))} />
            </Field>
            <Field label="Días" hint="Vacío = todos los laborables">
              <Days
                value={m.days ?? []}
                onChange={(v) =>
                  up((x) => {
                    if (v.length) x.meetings![i].days = v;
                    else delete x.meetings![i].days;
                  })
                }
              />
            </Field>
            <IconBtn title="Quitar reunión" danger onClick={() => up((x) => void x.meetings!.splice(i, 1))}>
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn
          onClick={() => {
            if (!unitOptions.length) return note('Crea primero un equipo.');
            up((x) => void (x.meetings = [...(x.meetings ?? []), { id: 'Reunión semanal', unit: unitOptions[0].value, start: '09:30', minutes: 30, days: [0] }]));
          }}
        >
          Añadir reunión
        </AddBtn>
      </Section>

      <Section
        title="Ausencias planificadas"
        hint="Días concretos en que alguien no está (vacaciones, licencia). El día 0 es el primer lunes de la simulación."
      >
        {absences.length === 0 && <p class="empty">Sin ausencias planificadas. El ausentismo general sigue aplicando.</p>}
        {absences.map((a, i) => (
          <div class="inline wrap" key={i}>
            <Field label="Persona">
              <Sel value={a.person} options={personOptions} onChange={(v) => up((x) => void (x.scenario!.absences![i].person = v))} />
            </Field>
            <Field label="Días (separados por coma)">
              <Text
                value={a.days.join(', ')}
                placeholder="1, 2"
                onChange={(v) =>
                  up((x) => {
                    x.scenario!.absences![i].days = v
                      .split(/[,\s]+/)
                      .map(Number)
                      .filter((n) => Number.isInteger(n) && n >= 0);
                  })
                }
              />
            </Field>
            <IconBtn
              title="Quitar ausencia"
              danger
              onClick={() =>
                up((x) => {
                  x.scenario!.absences!.splice(i, 1);
                  if (!x.scenario!.absences!.length) delete x.scenario;
                })
              }
            >
              ✕
            </IconBtn>
          </div>
        ))}
        <AddBtn
          onClick={() => {
            if (!personOptions.length) return note('Crea primero una persona.');
            up((x) => void ((x.scenario ??= {}).absences = [...(x.scenario?.absences ?? []), { person: personOptions[0].value, days: [1] }]));
          }}
        >
          Añadir ausencia
        </AddBtn>
      </Section>
    </div>
  );
}

// ---------- YAML avanzado ----------

export function YamlTab({ d, setDraft }: { d: CompanyDef; setDraft: (d: CompanyDef) => void }) {
  const [text, setText] = useState(() => companyToYaml(d));
  const [msg, setMsg] = useState<string[]>([]);

  const load = () => {
    const r = parseCompany(text);
    if (r.def) {
      setDraft(r.def);
      setMsg([]);
    } else setMsg(r.errors);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/yaml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.company.replace(/[^\w-]+/g, '_') || 'empresa'}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="form yaml">
      <p class="lead">
        Vista avanzada: es el mismo contenido que los formularios, como texto. Puedes copiarlo, guardarlo o pegar uno nuevo y
        pulsar «Cargar en los formularios».
      </p>
      <textarea spellcheck={false} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />
      <div class="inline">
        <button type="button" class="btn primary" onClick={load}>
          Cargar en los formularios
        </button>
        <button type="button" class="btn" onClick={() => setText(companyToYaml(d))}>
          Volver a lo del formulario
        </button>
        <button type="button" class="btn" onClick={download}>
          Descargar .yaml
        </button>
        <label class="btn filebtn">
          Abrir archivo…
          <input
            type="file"
            accept=".yaml,.yml,.txt"
            onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) setText(await f.text());
            }}
          />
        </label>
      </div>
      {msg.length > 0 && (
        <ul class="errs">
          {msg.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
