import { useState } from 'preact/hooks';
import { FACILITIES, type Facility } from '@office-pixel/sim';
import { addUnit, findUnit, flatUnits } from './model';
import { AddBtn, Sel, type TabProps } from './ui';

const ORDER = Object.keys(FACILITIES) as Facility[];
const BOX = ['#c98f4c', '#9c7a4d', '#d6a35f', '#5d8fc9', '#7aa86a'];

/** Miniatura de cómo se dibuja la sala en el plano. */
export function FacilityPreview({ kind }: { kind: Facility }) {
  const crate = (x: number, y: number, w: number, h: number, i: number) => (
    <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill={BOX[i % BOX.length]} stroke="#00000055" />
  );
  const hazard = (x: number, y: number, w: number) => (
    <g>
      <rect x={x} y={y} width={w} height={5} fill="#1b1f2a" />
      {Array.from({ length: Math.floor(w / 12) }, (_, i) => (
        <polygon key={i} points={`${x + i * 12},${y + 5} ${x + i * 12 + 6},${y} ${x + i * 12 + 12},${y}`} fill="#f5c451" />
      ))}
    </g>
  );
  const truck = (x: number, y: number, c: string) => (
    <g>
      <rect x={x} y={y + 2} width={42} height={24} rx={3} fill={c} />
      <rect x={x + 42} y={y + 10} width={18} height={16} rx={3} fill="#f5c451" />
      <rect x={x + 50} y={y + 13} width={8} height={7} fill="#9ad1ff" />
      <circle cx={x + 10} cy={y + 27} r={4.5} fill="#131824" />
      <circle cx={x + 50} cy={y + 27} r={4.5} fill="#131824" />
    </g>
  );
  const pallet = (x: number, y: number, n: number) => (
    <g>
      <rect x={x} y={y + 24} width={30} height={5} fill="#7a5a34" />
      {Array.from({ length: n }, (_, i) => crate(x + 2 + (i % 2) * 13, y + 12 - Math.floor(i / 2) * 11, 12, 11, i + Math.floor(x)))}
    </g>
  );
  const desk = (x: number, y: number) => (
    <g key={x}>
      <rect x={x} y={y} width={38} height={22} rx={4} fill="#b98856" />
      <rect x={x + 11} y={y + 2} width={16} height={11} rx={2} fill="#131824" />
      <rect x={x + 13} y={y + 4} width={12} height={7} rx={1} fill="#7fe3b4" />
      <circle cx={x + 19} cy={y + 32} r={7} fill="#34405c" />
    </g>
  );

  return (
    <svg class="fac-preview" viewBox="0 0 190 84" role="img" aria-label={`Vista previa: ${FACILITIES[kind].label}`}>
      <rect width={190} height={84} rx={8} fill="#1f2635" />
      <rect width={190} height={13} rx={8} fill="#5aa9ff" opacity={0.85} />
      <text x={8} y={10} fontSize={8.5} fontWeight={700} fill="#0c0f16">
        {FACILITIES[kind].icon} {FACILITIES[kind].label}
      </text>
      {kind === 'oficina' && (
        <g>
          {desk(12, 22)}
          {desk(62, 22)}
          {desk(112, 22)}
        </g>
      )}
      {kind !== 'oficina' && (
        <g>
          {desk(12, 18)}
          {desk(62, 18)}
        </g>
      )}
      {kind === 'bodega' && (
        <g transform="translate(10,50)">
          {Array.from({ length: 4 }, (_, i) => (
            <g key={i} transform={`translate(${i * 42},0)`}>
              <rect x={0} y={0} width={3} height={32} fill="#2d3d5e" />
              <rect x={33} y={0} width={3} height={32} fill="#2d3d5e" />
              <rect x={0} y={14} width={36} height={3} fill="#e0883a" />
              <rect x={0} y={30} width={36} height={3} fill="#e0883a" />
              {crate(4, 3, 12, 11, i)}
              {crate(19, 4, 12, 10, i + 2)}
              {crate(5, 17, 14, 12, i + 1)}
            </g>
          ))}
        </g>
      )}
      {kind === 'ingreso' && (
        <g transform="translate(10,48)">
          {truck(0, 0, '#e8edf7')}
          {pallet(76, 0, 3)}
          {pallet(112, 0, 2)}
          {hazard(0, 30, 170)}
          <circle cx={172} cy={5} r={2.5} fill="#4cd98a" />
        </g>
      )}
      {kind === 'despacho' && (
        <g transform="translate(10,48)">
          <rect x={0} y={0} width={38} height={30} rx={3} fill="#3a4560" />
          {[3, 7, 11, 15, 19, 23].map((y) => (
            <rect key={y} x={3} y={y} width={32} height={2} fill="#8793b0" />
          ))}
          {pallet(48, 0, 4)}
          {pallet(84, 0, 3)}
          {hazard(0, 30, 170)}
          <circle cx={34} cy={5} r={2.5} fill="#ff8a3d" />
        </g>
      )}
      {kind === 'seguridad' && (
        <g transform="translate(10,50)">
          <rect x={0} y={0} width={78} height={22} rx={3} fill="#0b0e16" />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={4 + i * 24} y={3} width={21} height={16} fill="#1b2c3d" />
              <rect x={6 + i * 24} y={10 + (i % 2) * 2} width={17} height={2} fill="#4aa889" opacity={0.7} />
            </g>
          ))}
          <circle cx={5} cy={3} r={2.2} fill="#ff4d4d" />
          <rect x={92} y={6} width={4} height={18} fill="#9aa6c0" />
          <rect x={116} y={6} width={4} height={18} fill="#9aa6c0" />
          <rect x={96} y={10} width={20} height={3} fill="#f5c451" />
        </g>
      )}
      {kind === 'mantenimiento' && (
        <g transform="translate(10,50)">
          <rect x={0} y={10} width={70} height={8} rx={2} fill="#6b4f30" />
          <rect x={3} y={18} width={4} height={12} fill="#3a4560" />
          <rect x={63} y={18} width={4} height={12} fill="#3a4560" />
          <rect x={8} y={3} width={22} height={8} rx={2} fill="#c0392b" />
          <rect x={78} y={0} width={40} height={26} rx={3} fill="#2b3550" />
          <line x1={85} y1={5} x2={85} y2={21} stroke="#c9d2e6" strokeWidth={2.4} />
          <line x1={94} y1={5} x2={98} y2={21} stroke="#c9d2e6" strokeWidth={2.4} />
          <line x1={106} y1={6} x2={112} y2={20} stroke="#f5c451" strokeWidth={2.4} />
        </g>
      )}
      {kind === 'transporte' && (
        <g transform="translate(10,48)">
          {truck(0, 0, '#8cc4ff')}
          {truck(68, 0, '#ffd479')}
          {hazard(0, 30, 170)}
        </g>
      )}
    </svg>
  );
}

/** Catálogo de tipos de instalación: qué es cada una, cómo se ve, quién trabaja ahí, y cómo crear o asignar una. */
export function CatalogoTab({ d, up, note }: TabProps) {
  const [pick, setPick] = useState<Record<string, string>>({});
  const units = flatUnits(d.units);
  const unitOptions = [
    { value: '', label: 'Aplicar a un área existente…' },
    ...units.map(({ unit, depth }) => ({ value: unit.id, label: `${'  '.repeat(depth)}${unit.name ?? unit.id}  (${FACILITIES[unit.facility ?? 'oficina'].label})` })),
  ];
  const usedBy = (k: Facility) => units.filter(({ unit }) => (unit.facility ?? 'oficina') === k).map(({ unit }) => unit.name ?? unit.id);

  const apply = (k: Facility) => {
    const id = pick[k];
    if (!id) return note('Elige primero el área o subárea a la que aplicar este tipo.');
    up((x) => {
      const u = findUnit(x.units, id)!;
      if (k === 'oficina') delete u.facility;
      else u.facility = k;
    });
    setPick({ ...pick, [k]: '' });
    note(`«${units.find((q) => q.unit.id === id)?.unit.name ?? id}» ahora es ${FACILITIES[k].label}.`);
  };
  const create = (k: Facility) => {
    up((x) => {
      const id = addUnit(x, null, FACILITIES[k].defaultName);
      if (k !== 'oficina') findUnit(x.units, id)!.facility = k;
    });
    note(`Área «${FACILITIES[k].defaultName}» creada. Añádele personas en «Áreas y subáreas».`);
  };

  return (
    <div class="form">
      <p class="lead">
        Cada área o subárea es de un <b>tipo de instalación</b>. Solo cambia cómo se dibuja la sala en el plano; las personas, los procesos y la simulación funcionan igual. Elige un tipo para
        crear un área nueva o aplícalo a una existente.
      </p>
      <div class="catalog">
        {ORDER.map((k) => {
          const f = FACILITIES[k];
          const used = usedBy(k);
          return (
            <article class="fac-card" key={k}>
              <FacilityPreview kind={k} />
              <h4>
                {f.icon} {f.label}
              </h4>
              <p>{f.description}</p>
              <dl>
                <dt>Se dibuja</dt>
                <dd>{f.equipment.join(' · ')}</dd>
                <dt>Puestos típicos</dt>
                <dd>
                  {f.roles.map((r) => (
                    <span class="chip" key={r}>
                      {r}
                    </span>
                  ))}
                </dd>
                <dt>Procesos típicos</dt>
                <dd>{f.processes.join(' · ')}</dd>
                <dt>En tu empresa</dt>
                <dd>{used.length ? used.join(', ') : <i>ninguna todavía</i>}</dd>
              </dl>
              <div class="fac-actions">
                <Sel value={pick[k] ?? ''} options={unitOptions} onChange={(v) => setPick({ ...pick, [k]: v })} />
                <button type="button" class="btn" onClick={() => apply(k)}>
                  Aplicar
                </button>
              </div>
              <AddBtn onClick={() => create(k)}>Crear área de este tipo</AddBtn>
            </article>
          );
        })}
      </div>
    </div>
  );
}
