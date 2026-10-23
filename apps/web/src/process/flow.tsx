import type { CompanyDef, OrgProcessDef, OrgStageDef } from '@office-pixel/sim';
import { dependencyEdges, describeDuration, unitPath } from '@office-pixel/sim';

/** Marcas para comparar variantes: etapa eliminada, automatizada o acelerada. */
export type FlowMark = 'removed' | 'auto' | 'fast';

interface Node {
  id: string;
  stage: OrgStageDef;
  depth: number;
  row: number;
  x: number;
  y: number;
}
interface Edge {
  from: string;
  to: string;
  kind: 'next' | 'rule' | 'exception';
  label?: string;
  /** índice de la arista saliente, para separar trazados */
  k: number;
}

const W = 196;
const H = 70;
const GAP_X = 74;
const GAP_Y = 30;
const PAD = 24;

const trim = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const cond = (when: string | undefined) => (when ?? '').replace(/\bcase\./g, '');

export function layoutFlow(proc: OrgProcessDef) {
  const stages = proc.stages;
  const edges: Edge[] = [];
  for (const s of stages) {
    let k = 0;
    if (typeof s.next === 'string') edges.push({ from: s.id, to: s.next, kind: 'next', k: k++ });
    else if (Array.isArray(s.next))
      for (const r of s.next) edges.push({ from: s.id, to: r.to, kind: 'rule', label: r.otherwise ? 'en otro caso' : cond(r.when), k: k++ });
    for (const e of s.exceptions ?? []) edges.push({ from: s.id, to: e.target, kind: 'exception', label: `${e.id} · ${Math.round(e.probability * 100)} %`, k: k++ });
  }

  // columna = distancia desde la primera etapa (primero por el camino normal, luego por excepciones)
  const depth = new Map<string, number>([[stages[0].id, 0]]);
  for (const pass of ['main', 'all'] as const) {
    const queue = [...depth.keys()];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of edges) {
        if (e.from !== cur || depth.has(e.to)) continue;
        if (pass === 'main' && e.kind === 'exception') continue;
        depth.set(e.to, depth.get(cur)! + 1);
        queue.push(e.to);
      }
    }
  }
  let extra = Math.max(...depth.values()) + 1;
  for (const s of stages) if (!depth.has(s.id)) depth.set(s.id, extra++);

  const rows = new Map<number, number>();
  const nodes = new Map<string, Node>();
  for (const s of stages) {
    const d = depth.get(s.id)!;
    const row = rows.get(d) ?? 0;
    rows.set(d, row + 1);
    nodes.set(s.id, { id: s.id, stage: s, depth: d, row, x: PAD + d * (W + GAP_X), y: PAD + row * (H + GAP_Y) });
  }
  const cols = Math.max(...[...nodes.values()].map((n) => n.depth)) + 1;
  const maxRow = Math.max(...[...nodes.values()].map((n) => n.row)) + 1;
  return { nodes, edges, width: PAD * 2 + cols * W + (cols - 1) * GAP_X, height: PAD * 2 + maxRow * H + (maxRow - 1) * GAP_Y + 30 };
}

function edgePath(a: Node, b: Node, e: Edge, outCount: number): { d: string; lx: number; ly: number } {
  const ax = a.x + W;
  const ay = a.y + H / 2;
  if (b.depth > a.depth) {
    const bx = b.x;
    const by = b.y + H / 2;
    const mx = ax + GAP_X / 2 + (e.k - (outCount - 1) / 2) * 8;
    return { d: `M${ax},${ay} H${mx} V${by} H${bx}`, lx: mx, ly: (ay + by) / 2 };
  }
  if (b.depth === a.depth && b.row !== a.row) {
    // misma columna: de borde a borde
    const down = b.row > a.row;
    const x = a.x + W / 2 + (e.k % 3) * 10 - 10;
    const y1 = down ? a.y + H : a.y;
    const y2 = down ? b.y : b.y + H;
    return { d: `M${x},${y1} V${y2}`, lx: x, ly: (y1 + y2) / 2 };
  }
  // vuelta atrás (retrabajo): por encima de los nodos
  const top = Math.min(a.y, b.y) - 12 - (e.k % 3) * 7;
  const x1 = a.x + W / 2 + (e.k % 3) * 9 - 9;
  const x2 = b.x + W / 2 + (e.k % 3) * 9 - 9;
  return { d: `M${x1},${a.y} V${top} H${x2} V${b.y}`, lx: (x1 + x2) / 2, ly: top };
}

export function FlowDiagram(props: { def: CompanyDef; proc: OrgProcessDef; marks?: Record<string, FlowMark>; ghosts?: OrgStageDef[]; showProcedures?: boolean }) {
  const { def, proc, marks = {} } = props;
  // procedimientos asociados a cada etapa (📄 n)
  const procCount: Record<string, number> = {};
  if (props.showProcedures) for (const pc of proc.procedures ?? []) if (pc.stageId) procCount[pc.stageId] = (procCount[pc.stageId] ?? 0) + 1;
  // dependencias con otros procesos, bajo la etapa que las dispara (⇢) o recibe (⇠)
  const links: Record<string, string[]> = {};
  if (props.showProcedures) {
    const name = (id: string) => def.processes.find((p) => p.id === id)?.name ?? id;
    const first = proc.stages[0]?.id;
    const ends = proc.stages.filter((s) => s.terminal).map((s) => s.id);
    const add = (id: string | undefined, t: string) => id && (links[id] = [...(links[id] ?? []), t]);
    for (const e of dependencyEdges(def)) {
      const pct = e.probability < 1 ? ` ${Math.round(e.probability * 100)} %` : '';
      if (e.from === proc.id) for (const id of e.atStage ? [e.atStage] : ends) add(id, `${e.kind === 'dispara' ? '⇢' : '⇢ lo requiere'} ${name(e.to)}${pct}`);
      if (e.to === proc.id) add(first, `⇠ ${e.kind === 'dispara' ? 'nace de' : 'requiere'} ${name(e.from)}`);
    }
  }
  // las etapas eliminadas se dibujan atenuadas para ver qué se quitó
  const withGhosts: OrgProcessDef = props.ghosts?.length
    ? { ...proc, stages: [...proc.stages, ...props.ghosts.filter((g) => !proc.stages.some((s) => s.id === g.id))] }
    : proc;
  if (!withGhosts.stages.length) return <p class="empty">El proceso aún no tiene etapas.</p>;
  const { nodes, edges, width, height } = layoutFlow(withGhosts);
  const outCount = new Map<string, number>();
  for (const e of edges) outCount.set(e.from, (outCount.get(e.from) ?? 0) + 1);

  return (
    <div class="flowwrap">
      <svg class="flow" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Diagrama de ${proc.name ?? proc.id}`}>
        <defs>
          <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" class="arrow" />
          </marker>
          <marker id="arr-x" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" class="arrow-x" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = nodes.get(e.from);
          const b = nodes.get(e.to);
          if (!a || !b) return null;
          const p = edgePath(a, b, e, outCount.get(e.from) ?? 1);
          const exc = e.kind === 'exception';
          return (
            <g key={i}>
              <path d={p.d} class={exc ? 'edge exc' : 'edge'} marker-end={exc ? 'url(#arr-x)' : 'url(#arr)'} fill="none" />
              {e.label && (
                <text x={p.lx} y={p.ly - 4} class={exc ? 'elabel exc' : 'elabel'} text-anchor="middle">
                  {trim(e.label, 28)}
                </text>
              )}
            </g>
          );
        })}

        {[...nodes.values()].map((n) => {
          const s = n.stage;
          const mark = marks[s.id];
          const who = s.automated ? '⚙ Sistema' : s.role ?? '';
          const where = s.unit ? unitPath(def, s.unit) : '';
          const meta = [s.duration ? describeDuration(s.duration) : '', s.sla ? `SLA ${Math.round((s.sla.maxMinutes / 60) * 10) / 10} h` : ''].filter(Boolean).join(' · ');
          const cls = ['fnode', s.terminal ? 'end' : '', s.automated ? 'auto' : '', mark ? `mark-${mark}` : ''].filter(Boolean).join(' ');
          return (
            <g key={n.id} class={cls} transform={`translate(${n.x},${n.y})`}>
              <rect width={W} height={H} rx={s.terminal ? H / 2 : 10} />
              <text x={12} y={21} class="t1">
                {mark === 'auto' && !s.automated ? '⚙ ' : ''}
                {trim(s.label ?? s.id, 24)}
              </text>
              <text x={12} y={38} class="t2">
                {trim([where, who].filter(Boolean).join(' · ') || (s.terminal ? 'Fin del proceso' : ''), 30)}
              </text>
              <text x={12} y={55} class="t3">
                {trim(meta, 32)}
              </text>
              {(links[s.id] ?? []).slice(0, 2).map((t, i) => (
                <text key={i} x={4} y={H + 12 + i * 11} class="tag link">
                  {trim(t, 38)}
                </text>
              ))}
              {procCount[s.id] > 0 && (
                <text x={W - 10} y={H - 9} class="tag proc" text-anchor="end">
                  📄 {procCount[s.id]} {procCount[s.id] === 1 ? 'procedimiento' : 'procedimientos'}
                </text>
              )}
              {mark === 'removed' && (
                <text x={W - 10} y={19} class="tag" text-anchor="end">
                  ELIMINADA
                </text>
              )}
              {mark === 'fast' && (
                <text x={W - 10} y={19} class="tag" text-anchor="end">
                  ACELERADA
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
