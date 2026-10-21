import { useState } from 'preact/hooks';
import {
  addPerson,
  addUnit,
  allRoles,
  findUnit,
  flatUnits,
  removePerson,
  removeUnit,
  subtreeIds,
  usage,
} from './model';
import { AddBtn, Card, Days, Field, IconBtn, Num, Pct, Sel, Section, Text, Time, type TabProps } from './ui';

// ---------- Empresa ----------

export function EmpresaTab({ d, up }: TabProps) {
  const cal = d.calendar;
  const travel = d.travel ?? {};
  return (
    <div class="form">
      <Section title="Empresa">
        <Field label="Nombre de la empresa">
          <Text value={d.company} onChange={(v) => up((x) => void (x.company = v))} />
        </Field>
      </Section>

      <Section title="Jornada de trabajo" hint="Las llegadas de casos, los SLA y los tiempos de ciclo se miden solo en horas hábiles.">
        <div class="row">
          <Field label="Entrada">
            <Time value={cal.hours.start} onChange={(v) => up((x) => void (x.calendar.hours.start = v))} />
          </Field>
          <Field label="Salida">
            <Time value={cal.hours.end} onChange={(v) => up((x) => void (x.calendar.hours.end = v))} />
          </Field>
          <Field label="Ausentismo diario" hint="Probabilidad de que una persona falte un día.">
            <Pct value={cal.absenteeism ?? 0} onChange={(v) => up((x) => void (x.calendar.absenteeism = v ?? 0))} />
          </Field>
        </div>
        <Field label="Días laborables">
          <Days value={cal.workDays} onChange={(v) => up((x) => void (x.calendar.workDays = v))} />
        </Field>
        <Field label="Pausas (almuerzo, descansos)">
          <div class="list">
            {(cal.breaks ?? []).map((b, i) => (
              <div class="inline" key={i}>
                <Time value={b.start} onChange={(v) => up((x) => void (x.calendar.breaks![i].start = v))} />
                <span>a</span>
                <Time value={b.end} onChange={(v) => up((x) => void (x.calendar.breaks![i].end = v))} />
                <IconBtn title="Quitar pausa" danger onClick={() => up((x) => void x.calendar.breaks!.splice(i, 1))}>
                  ✕
                </IconBtn>
              </div>
            ))}
            <AddBtn onClick={() => up((x) => void (x.calendar.breaks = [...(x.calendar.breaks ?? []), { start: '16:00', end: '16:15' }]))}>
              Añadir pausa
            </AddBtn>
          </div>
        </Field>
      </Section>

      <Section title="Traslado de casos" hint="Minutos que tarda un caso en llegar a otro equipo cuando cambia de lugar.">
        <div class="row">
          <Field label="Dentro del mismo equipo">
            <Num value={travel.sameTeam ?? 0} min={0} suffix="min" onChange={(v) => up((x) => void ((x.travel ??= {}).sameTeam = v ?? 0))} />
          </Field>
          <Field label="Entre equipos de una misma área">
            <Num value={travel.sameArea ?? 2} min={0} suffix="min" onChange={(v) => up((x) => void ((x.travel ??= {}).sameArea = v ?? 0))} />
          </Field>
          <Field label="Entre áreas distintas">
            <Num value={travel.crossArea ?? 5} min={0} suffix="min" onChange={(v) => up((x) => void ((x.travel ??= {}).crossArea = v ?? 0))} />
          </Field>
        </div>
      </Section>
    </div>
  );
}

// ---------- Áreas y equipos ----------

export function AreasTab({ d, up, note }: TabProps) {
  const people = d.people.map((p) => ({ value: p.id, label: p.name ?? p.id }));
  const headOptions = [{ value: '', label: '— sin responsable —' }, ...people];

  const rename = (id: string, name: string) => up((x) => void (findUnit(x.units, id)!.name = name));
  const setHead = (id: string, v: string) =>
    up((x) => {
      const u = findUnit(x.units, id)!;
      if (v) u.head = v;
      else delete u.head;
    });
  const remove = (id: string) => {
    const probe = structuredClone(d);
    const r = removeUnit(probe, id);
    if (!r.ok) return note(r.reason);
    up((x) => void removeUnit(x, id));
  };

  return (
    <div class="form">
      <p class="lead">
        Cada <b>área</b> es una planta del edificio y cada <b>equipo</b> es una sala donde se sientan las personas.
      </p>
      {d.units.map((area) => {
        const rows = flatUnits([area]).slice(1);
        return (
          <Card
            key={area.id}
            title={<span class="pill">Área</span>}
            actions={
              <IconBtn title="Borrar área" danger onClick={() => remove(area.id)}>
                🗑
              </IconBtn>
            }
          >
            <div class="row">
              <Field label="Nombre del área" grow>
                <Text value={area.name ?? area.id} onChange={(v) => rename(area.id, v)} />
              </Field>
              <Field label="Responsable del área" grow>
                <Sel value={area.head ?? ''} options={headOptions} onChange={(v) => setHead(area.id, v)} />
              </Field>
            </div>
            <div class="sublist">
              {rows.length === 0 && <p class="empty">Esta área aún no tiene equipos. Añade uno para poder sentar personas.</p>}
              {rows.map(({ unit, depth }) => (
                <div class="subrow" key={unit.id} style={{ marginLeft: `${(depth - 1) * 18}px` }}>
                  <span class="pill sub">Equipo</span>
                  <Text value={unit.name ?? unit.id} onChange={(v) => rename(unit.id, v)} />
                  <span class="badge">{usage(d, unit.id).people} personas</span>
                  <Sel value={unit.head ?? ''} options={headOptions} onChange={(v) => setHead(unit.id, v)} />
                  <IconBtn title="Borrar equipo" danger onClick={() => remove(unit.id)}>
                    ✕
                  </IconBtn>
                </div>
              ))}
              <AddBtn onClick={() => up((x) => void addUnit(x, area.id, 'Nuevo equipo'))}>Añadir equipo</AddBtn>
            </div>
          </Card>
        );
      })}
      <AddBtn onClick={() => up((x) => void addUnit(x, null, 'Nueva área'))}>Añadir área</AddBtn>
    </div>
  );
}

// ---------- Personas ----------

export function PersonasTab({ d, up, note }: TabProps) {
  const [filter, setFilter] = useState('');
  const units = flatUnits(d.units);
  const unitOptions = units.map(({ unit, depth }) => ({ value: unit.id, label: `${'  '.repeat(depth)}${unit.name ?? unit.id}` }));
  const ids = filter ? new Set(subtreeIds(findUnit(d.units, filter)!)) : null;
  const rows = d.people.map((p, i) => ({ p, i })).filter(({ p }) => !ids || ids.has(p.unit));
  const bosses = [{ value: '', label: '— sin jefe —' }, ...d.people.map((p) => ({ value: p.id, label: p.name ?? p.id }))];
  const schedules = [{ value: '', label: 'Horario general' }, ...Object.keys(d.schedules ?? {}).map((k) => ({ value: k, label: k }))];

  const edit = (id: string, fn: (p: (typeof d.people)[number]) => void) => up((x) => void fn(x.people.find((q) => q.id === id)!));

  const add = () => {
    const target = filter || units.find((u) => !u.unit.children?.length)?.unit.id || units[0]?.unit.id;
    if (!target) return note('Crea primero un área y un equipo.');
    up((x) => void addPerson(x, target));
  };

  return (
    <div class="form">
      <p class="lead">
        Una fila por persona. El <b>rol</b> es lo que piden las etapas de los procesos: quien tenga ese rol (y esté en el equipo
        correcto) puede tomar el trabajo.
      </p>
      <div class="toolbar-row">
        <Field label="Mostrar">
          <Sel value={filter} options={[{ value: '', label: 'Todas las personas' }, ...unitOptions]} onChange={setFilter} />
        </Field>
        <span class="badge">{rows.length} personas</span>
        <AddBtn onClick={add}>Añadir persona</AddBtn>
      </div>
      <datalist id="roles">
        {allRoles(d).map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <div class="tablewrap">
        <table class="grid">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Equipo</th>
              <th>Rol</th>
              <th>Jefe</th>
              <th title="1 = velocidad normal; 1.2 = 20 % más rápido">Veloc.</th>
              <th title="Probabilidad de rehacer una tarea">Errores</th>
              <th title="Si se deja vacío se usa el ausentismo general">Ausent.</th>
              <th>Horario</th>
              <th title="Habilidades separadas por coma">Habilidades</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p }) => (
              <tr key={p.id}>
                <td>
                  <Text value={p.name ?? ''} onChange={(v) => edit(p.id, (q) => void (q.name = v))} />
                </td>
                <td>
                  <Sel value={p.unit} options={unitOptions} onChange={(v) => edit(p.id, (q) => void (q.unit = v))} />
                </td>
                <td>
                  <Text value={p.role} list="roles" onChange={(v) => edit(p.id, (q) => void (q.role = v))} />
                </td>
                <td>
                  <Sel
                    value={p.reportsTo ?? ''}
                    options={bosses.filter((b) => b.value !== p.id)}
                    onChange={(v) =>
                      edit(p.id, (q) => {
                        if (v) q.reportsTo = v;
                        else delete q.reportsTo;
                      })
                    }
                  />
                </td>
                <td>
                  <Num
                    class="s"
                    value={p.speed ?? 1}
                    min={0.1}
                    step={0.05}
                    onChange={(v) =>
                      edit(p.id, (q) => {
                        if (v === undefined || v === 1) delete q.speed;
                        else q.speed = v;
                      })
                    }
                  />
                </td>
                <td>
                  <Pct
                    value={p.errorRate ?? 0}
                    onChange={(v) =>
                      edit(p.id, (q) => {
                        if (!v) delete q.errorRate;
                        else q.errorRate = Math.min(v, 0.99);
                      })
                    }
                  />
                </td>
                <td>
                  <Pct
                    value={p.absenteeism}
                    placeholder={`${Math.round((d.calendar.absenteeism ?? 0) * 100)}%`}
                    onChange={(v) =>
                      edit(p.id, (q) => {
                        if (v === undefined) delete q.absenteeism;
                        else q.absenteeism = v;
                      })
                    }
                  />
                </td>
                <td>
                  <Sel
                    value={p.schedule ?? ''}
                    options={schedules}
                    onChange={(v) =>
                      edit(p.id, (q) => {
                        if (v) q.schedule = v;
                        else delete q.schedule;
                      })
                    }
                  />
                </td>
                <td>
                  <Text
                    value={(p.skills ?? []).join(', ')}
                    placeholder="—"
                    onChange={(v) =>
                      edit(p.id, (q) => {
                        const s = v.split(',').map((t) => t.trim()).filter(Boolean);
                        if (s.length) q.skills = s;
                        else delete q.skills;
                      })
                    }
                  />
                </td>
                <td>
                  <IconBtn title="Borrar persona" danger onClick={() => up((x) => void removePerson(x, p.id))}>
                    ✕
                  </IconBtn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p class="empty">No hay personas en esta selección.</p>}
    </div>
  );
}
