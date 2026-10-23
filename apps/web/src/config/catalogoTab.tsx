import { useState } from 'preact/hooks';
import { FACILITIES, facilityViews, type CustomFacility, type Facility, type FacilityView } from '@office-pixel/sim';
import { FacilityPreview } from './catalogo';
import { addUnit, findUnit, flatUnits, uniqueId } from './model';
import { AddBtn, Field, Sel, Text, TextArea, type TabProps } from './ui';

const ICONS = ['🏭', '🏬', '🧊', '🧪', '🧰', '⛽', '🏗', '🚧', '🖨', '🧹', '🍽', '🔌', '📡', '🛒', '🏥', '🔒'];

const LOOKS = (Object.keys(FACILITIES) as Facility[]).map((k) => ({ value: k, label: `${FACILITIES[k].icon} ${FACILITIES[k].label}` }));

/** Formulario para crear o editar un tipo de instalación propio. */
function CustomForm(props: { d: TabProps['d']; edit?: CustomFacility; up: TabProps['up']; note: TabProps['note']; onDone: () => void }) {
  const { d, edit, up, note, onDone } = props;
  const [label, setLabel] = useState(edit?.label ?? '');
  const [icon, setIcon] = useState(edit?.icon ?? '🏭');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [look, setLook] = useState<Facility>(edit?.look ?? 'oficina');

  const save = () => {
    const name = label.trim();
    if (!name) return note('Ponle un nombre al tipo de instalación.');
    if (!icon.trim()) return note('Elige un icono.');
    if (facilityViews(d).some((f) => f.id !== edit?.id && f.label.toLowerCase() === name.toLowerCase())) return note(`Ya existe un tipo llamado «${name}».`);
    up((x) => {
      const list = (x.facilityTypes ??= []);
      const data = { label: name, icon: icon.trim(), look, ...(description.trim() ? { description: description.trim() } : {}) };
      if (edit) {
        const c = list.find((q) => q.id === edit.id)!;
        delete c.description;
        Object.assign(c, data);
      } else {
        const taken = new Set([...Object.keys(FACILITIES), ...list.map((q) => q.id)]);
        list.push({ id: uniqueId(name, taken), ...data });
      }
    });
    note(edit ? `Tipo «${name}» actualizado.` : `Tipo «${name}» creado. Ya puedes aplicarlo a un área.`);
    onDone();
  };

  return (
    <article class="fac-card fac-form">
      <FacilityPreview kind={look} label={label.trim() || 'Nuevo tipo'} icon={icon || '🏭'} />
      <h4>{edit ? `Editar «${edit.label}»` : 'Nuevo tipo de instalación'}</h4>
      <div class="row">
        <Field label="Nombre">
          <Text value={label} placeholder="Laboratorio, Cocina, Taller de pintura…" onChange={setLabel} />
        </Field>
        <Field label="Icono">
          <Text value={icon} onChange={setIcon} />
        </Field>
      </div>
      <div class="icon-picks">
        {ICONS.map((i) => (
          <button type="button" key={i} class={i === icon ? 'on' : ''} onClick={() => setIcon(i)} title={`Usar ${i}`}>
            {i}
          </button>
        ))}
      </div>
      <Field label="Descripción (opcional)">
        <TextArea rows={2} value={description} onChange={setDescription} />
      </Field>
      <Field label="Se dibuja como" hint="El plano usa uno de los dibujos incluidos; tu tipo conserva su nombre e icono.">
        <Sel value={look} options={LOOKS} onChange={(v) => setLook(v as Facility)} />
      </Field>
      <div class="fac-actions">
        <button type="button" class="btn primary" onClick={save}>
          {edit ? 'Guardar cambios' : 'Crear tipo'}
        </button>
        <button type="button" class="btn" onClick={onDone}>
          Cancelar
        </button>
      </div>
    </article>
  );
}

/** Catálogo de tipos de instalación: los incluidos y los propios; permite crearlos, editarlos y aplicarlos a las áreas. */
export function CatalogoTab({ d, up, note }: TabProps) {
  const [pick, setPick] = useState<Record<string, string>>({});
  const [form, setForm] = useState<string | null>(null); // 'new' o el id del tipo que se edita
  const views = facilityViews(d);
  const units = flatUnits(d.units);
  const nameOf = (id: string | undefined) => views.find((v) => v.id === (id ?? 'oficina'))?.label ?? id;
  const unitOptions = [
    { value: '', label: 'Aplicar a un área existente…' },
    ...units.map(({ unit, depth }) => ({ value: unit.id, label: `${'  '.repeat(depth)}${unit.name ?? unit.id}  (${nameOf(unit.facility)})` })),
  ];
  const usedBy = (id: string) => units.filter(({ unit }) => (unit.facility ?? 'oficina') === id).map(({ unit }) => unit.name ?? unit.id);

  const apply = (v: FacilityView) => {
    const id = pick[v.id];
    if (!id) return note('Elige primero el área o subárea a la que aplicar este tipo.');
    up((x) => {
      const u = findUnit(x.units, id)!;
      if (v.id === 'oficina') delete u.facility;
      else u.facility = v.id;
    });
    setPick({ ...pick, [v.id]: '' });
    note(`«${units.find((q) => q.unit.id === id)?.unit.name ?? id}» ahora es ${v.label}.`);
  };
  const create = (v: FacilityView) => {
    const name = v.builtin ? FACILITIES[v.id as Facility].defaultName : v.label;
    up((x) => {
      const id = addUnit(x, null, name);
      if (v.id !== 'oficina') findUnit(x.units, id)!.facility = v.id;
    });
    note(`Área «${name}» creada. Añádele personas en «Áreas y subáreas».`);
  };
  const remove = (v: FacilityView) => {
    const used = usedBy(v.id);
    const msg = used.length ? `«${v.label}» se usa en: ${used.join(', ')}. Esas áreas pasarán a ser oficinas. ¿Borrar el tipo?` : `¿Borrar el tipo «${v.label}»?`;
    if (!confirm(msg)) return;
    up((x) => {
      x.facilityTypes = (x.facilityTypes ?? []).filter((q) => q.id !== v.id);
      if (!x.facilityTypes.length) delete x.facilityTypes;
      for (const { unit } of flatUnits(x.units)) if (unit.facility === v.id) delete unit.facility;
    });
    note(`Tipo «${v.label}» borrado.`);
  };

  const editing = form && form !== 'new' ? d.facilityTypes?.find((c) => c.id === form) : undefined;

  return (
    <div class="form">
      <p class="lead">
        Cada área o subárea es de un <b>tipo de instalación</b>. Solo cambia cómo se dibuja la sala en el plano; las personas, los procesos y la simulación funcionan igual. Si tu empresa necesita un
        tipo que no está aquí (un laboratorio, una cocina, un taller de pintura…), <b>créalo</b>: tendrá su nombre e icono y se dibujará como el tipo incluido que elijas.
      </p>
      {form === 'new' ? <CustomForm d={d} up={up} note={note} onDone={() => setForm(null)} /> : <AddBtn onClick={() => setForm('new')}>Nuevo tipo de instalación</AddBtn>}
      <div class="catalog">
        {editing && <CustomForm key={editing.id} d={d} edit={editing} up={up} note={note} onDone={() => setForm(null)} />}
        {views.map((v) => {
          const info = v.builtin ? FACILITIES[v.id as Facility] : undefined;
          const used = usedBy(v.id);
          return (
            <article class="fac-card" key={v.id}>
              <FacilityPreview kind={v.look} label={v.label} icon={v.icon} />
              <h4>
                {v.icon} {v.label} {!v.builtin && <span class="chip own">propio</span>}
              </h4>
              <p>{v.description}</p>
              <dl>
                {info ? (
                  <>
                    <dt>Se dibuja</dt>
                    <dd>{info.equipment.join(' · ')}</dd>
                    <dt>Puestos típicos</dt>
                    <dd>
                      {info.roles.map((r) => (
                        <span class="chip" key={r}>
                          {r}
                        </span>
                      ))}
                    </dd>
                    <dt>Procesos típicos</dt>
                    <dd>{info.processes.join(' · ')}</dd>
                  </>
                ) : (
                  <>
                    <dt>Se dibuja como</dt>
                    <dd>{FACILITIES[v.look].label}</dd>
                  </>
                )}
                <dt>En tu empresa</dt>
                <dd>{used.length ? used.join(', ') : <i>ninguna todavía</i>}</dd>
              </dl>
              <div class="fac-actions">
                <Sel value={pick[v.id] ?? ''} options={unitOptions} onChange={(x) => setPick({ ...pick, [v.id]: x })} />
                <button type="button" class="btn" onClick={() => apply(v)}>
                  Aplicar
                </button>
              </div>
              <AddBtn onClick={() => create(v)}>Crear área de este tipo</AddBtn>
              {!v.builtin && (
                <div class="fac-actions">
                  <button type="button" class="btn" onClick={() => setForm(v.id)}>
                    Editar
                  </button>
                  <button type="button" class="btn danger" onClick={() => remove(v)}>
                    Borrar tipo
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
