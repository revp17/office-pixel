import {
  allProcedures,
  dependencyEdges,
  dependencyLevels,
  dependencyText,
  procedureStatus,
  type CompanyDef,
  unpublishedPrerequisites,
  type DepEdge,
  type OrgProcessDef,
  type Procedure,
} from '@office-pixel/sim';
import { Section } from '../config/ui';

const W = 214;
const H = 66;
const GAP_X = 250;
const GAP_Y = 26;
const PAD = 18;

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Mapa de dependencias entre procesos: columnas según de quién dependen, flechas continuas (dispara) o discontinuas (requiere). */
export function DependencyMap(props: {
  def: CompanyDef;
  selected?: string;
  onSelect?: (id: string) => void;
  /** muestra también los procesos que no dependen de nadie ni de los que nadie depende */
  showAlone?: boolean;
}) {
  const { def, selected, onSelect } = props;
  const edges = dependencyEdges(def);
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
  const alone = def.processes.filter((p) => !linked.has(p.id));
  const shown = def.processes.filter((p) => linked.has(p.id));
  if (!shown.length)
    return (
      <p class="empty">
        Ningún proceso depende de otro todavía. Se declara en <b>Configurar empresa → Procesos → Dependencias</b>.
      </p>
    );

  const level = dependencyLevels(def);
  const rows = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const p of shown) {
    const l = level.get(p.id) ?? 0;
    const r = rows.get(l) ?? 0;
    rows.set(l, r + 1);
    pos.set(p.id, { x: PAD + l * (W + GAP_X), y: PAD + r * (H + GAP_Y) });
  }
  const cols = Math.max(...[...rows.keys()]) + 1;
  const maxRows = Math.max(...rows.values());
  const width = PAD * 2 + cols * W + (cols - 1) * GAP_X;
  const height = PAD * 2 + maxRows * H + (maxRows - 1) * GAP_Y;

  // relacionado con la selección: se resalta y lo demás se atenúa
  const related = new Set<string>();
  if (selected) {
    related.add(selected);
    for (const e of edges) if (e.from === selected || e.to === selected) (related.add(e.from), related.add(e.to));
  }
  const dim = (id: string) => !!selected && !related.has(id);

  const stageLabel = (e: DepEdge) => {
    const base = e.atStage ? (def.processes.find((p) => p.id === e.from)?.stages.find((s) => s.id === e.atStage)?.label ?? e.atStage) : 'al cerrar';
    const pct = e.kind === 'dispara' && e.probability < 1 ? ` · ${Math.round(e.probability * 100)} %` : '';
    const into = e.kind === 'dispara' && e.toStage ? ` → ${def.processes.find((p) => p.id === e.to)?.stages.find((s) => s.id === e.toStage)?.label ?? e.toStage}` : '';
    return trim(`${e.kind === 'dispara' ? '' : 'requiere · '}${base}${pct}${into}`, 44);
  };

  // varias flechas que salen del mismo nodo se separan un poco
  const outIdx = new Map<string, number>();
  const inIdx = new Map<string, number>();
  const outN = new Map<string, number>();
  const inN = new Map<string, number>();
  for (const e of edges) {
    outN.set(e.from, (outN.get(e.from) ?? 0) + 1);
    inN.set(e.to, (inN.get(e.to) ?? 0) + 1);
  }

  return (
    <div>
      <div class="flowwrap">
        <svg class="flow depmap" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mapa de dependencias entre procesos">
          <defs>
            <marker id="dep-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" class="arrow-dep" />
            </marker>
            <marker id="dep-arr-req" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" class="arrow" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = pos.get(e.from);
            const b = pos.get(e.to);
            if (!a || !b) return null;
            const oi = outIdx.get(e.from) ?? 0;
            outIdx.set(e.from, oi + 1);
            const ii = inIdx.get(e.to) ?? 0;
            inIdx.set(e.to, ii + 1);
            const ay = a.y + H / 2 + (oi - ((outN.get(e.from) ?? 1) - 1) / 2) * 10;
            const by = b.y + H / 2 + (ii - ((inN.get(e.to) ?? 1) - 1) / 2) * 10;
            const ax = a.x + W;
            const bx = b.x;
            const mx = (ax + bx) / 2;
            const hot = !selected || e.from === selected || e.to === selected;
            const req = e.kind === 'requiere';
            return (
              <g key={i} opacity={hot ? 1 : 0.25}>
                <path
                  d={`M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`}
                  class={req ? 'edge dep-req' : 'edge dep'}
                  marker-end={req ? 'url(#dep-arr-req)' : 'url(#dep-arr)'}
                  fill="none"
                />
                <text x={mx} y={(ay + by) / 2 - 5} class="elabel" text-anchor="middle">
                  {stageLabel(e)}
                </text>
              </g>
            );
          })}
          {shown.map((p) => {
            const at = pos.get(p.id)!;
            const pcs = p.procedures ?? [];
            const published = pcs.filter((pc) => procedureStatus(pc) === 'publicado').length;
            const cls = ['fnode', 'depnode', selected === p.id ? 'sel' : '', dim(p.id) ? 'dim' : ''].filter(Boolean).join(' ');
            return (
              <g key={p.id} class={cls} transform={`translate(${at.x},${at.y})`} onClick={() => onSelect?.(p.id)} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
                <rect width={W} height={H} rx={12} />
                <text x={12} y={22} class="t1">
                  {trim(p.name ?? p.id, 26)}
                </text>
                <text x={12} y={40} class="t2">
                  {p.stages.length} etapas ·{' '}
                  {p.arrivals.type === 'poisson' ? `${p.arrivals.ratePerHour}/h propios` : `1 cada ${p.arrivals.everyMinutes} min`}
                </text>
                <text x={12} y={56} class="t3">
                  {pcs.length ? `📄 ${published}/${pcs.length} procedimientos publicados` : 'Sin procedimientos'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p class="muted legend">
        <span>
          <i class="swatch dep" /> <b>dispara</b>: al terminar la etapa indicada nace un caso en el otro proceso (se simula)
        </span>
        <span>
          <i class="swatch req" /> <b>requiere</b>: necesita su resultado; informativa, no cambia la simulación
        </span>
      </p>
      {props.showAlone && alone.length > 0 && (
        <p class="muted legend">
          Sin dependencias: {alone.map((p) => p.name ?? p.id).join(', ')}.
        </p>
      )}
    </div>
  );
}

/** Lista legible de lo que un proceso necesita y de lo que dispara. */
export function DependencySummary({ def, procId }: { def: CompanyDef; procId: string }) {
  const edges = dependencyEdges(def);
  const up = edges.filter((e) => e.to === procId);
  const down = edges.filter((e) => e.from === procId);
  if (!up.length && !down.length) return <p class="muted">Este proceso no tiene dependencias con otros.</p>;
  return (
    <ul class="deplist">
      {up.map((e, i) => (
        <li key={`u${i}`} class={e.kind}>
          <span class="dir">⇠</span> {dependencyText(def, e, 'to')}
          {e.note ? <em> — {e.note}</em> : null}
        </li>
      ))}
      {down.map((e, i) => (
        <li key={`d${i}`} class={e.kind}>
          <span class="dir">⇢</span> {dependencyText(def, e, 'from')}
        </li>
      ))}
    </ul>
  );
}

/** Requisitos de un procedimiento y quién depende de él, como cadena de pastillas. */
export function ProcedureChain({ def, pc }: { def: CompanyDef; pc: Procedure }) {
  const all = allProcedures(def);
  const find = (id: string) => all.find((r) => r.pc.id === id);
  const before = (pc.prerequisites ?? []).map(find).filter((r) => !!r);
  const after = all.filter((r) => r.pc.prerequisites?.includes(pc.id));
  if (!before.length && !after.length) return null;
  const chip = (r: NonNullable<ReturnType<typeof find>>) => (
    <span key={r.pc.id} class={`chain-chip ${procedureStatus(r.pc) === 'publicado' ? 'ok' : 'draft'}`} title={`${r.proc.name ?? r.proc.id} · ${procedureStatus(r.pc)}`}>
      {r.pc.code}
      <small>{trim(r.pc.title, 28)}</small>
    </span>
  );
  return (
    <div class="chain">
      {before.length > 0 && <div class="chain-side">{before.map((r) => chip(r!))}</div>}
      {before.length > 0 && <span class="chain-arrow">→</span>}
      <span class="chain-chip me">
        {pc.code}
        <small>{trim(pc.title, 28)}</small>
      </span>
      {after.length > 0 && <span class="chain-arrow">→</span>}
      {after.length > 0 && <div class="chain-side">{after.map((r) => chip(r))}</div>}
    </div>
  );
}

/** Pestaña «Dependencias» de la gestión de procesos: el mapa, lo que depende del proceso elegido y los procedimientos encadenados. */
export function DependenciasView({ d, proc, onSelect, onEdit }: { d: CompanyDef; proc: OrgProcessDef; onSelect: (id: string) => void; onEdit: () => void }) {
  const chained = allProcedures(d).filter((r) => r.pc.prerequisites?.length || allProcedures(d).some((o) => o.pc.prerequisites?.includes(r.pc.id)));
  const blocked = chained.filter((r) => unpublishedPrerequisites(d, r.pc).length > 0 && procedureStatus(r.pc) === 'publicado');
  return (
    <div class="form">
      <p class="lead">
        Los procesos no viven solos: un pedido dispara su despacho, un ingreso de mercadería alimenta la bodega, una alerta de seguridad genera una orden de mantenimiento.
        Aquí ves cómo se conectan. Haz clic en un proceso para resaltar sus conexiones.
      </p>
      <Section title="Mapa de dependencias entre procesos">
        <DependencyMap def={d} selected={proc.id} onSelect={onSelect} showAlone />
      </Section>
      <Section
        title={`«${proc.name ?? proc.id}»: qué necesita y qué dispara`}
        action={
          <button type="button" class="btn" onClick={onEdit}>
            Editar dependencias…
          </button>
        }
      >
        <DependencySummary def={d} procId={proc.id} />
      </Section>
      <Section title="Procedimientos encadenados" hint="Un procedimiento puede exigir que otros estén hechos antes (se declara dentro de cada procedimiento, en el paso 2).">
        {chained.length === 0 && <p class="empty">Ningún procedimiento tiene requisitos todavía.</p>}
        {chained.map((r) => (
          <div key={r.pc.id}>
            <ProcedureChain def={d} pc={r.pc} />
          </div>
        ))}
        {blocked.length > 0 && (
          <p class="prereq-warn">
            ⚠ Publicados con requisitos aún en borrador: {blocked.map((r) => r.pc.code).join(', ')}.
          </p>
        )}
      </Section>
    </div>
  );
}
