import { useRef, useState } from 'preact/hooks';
import { ART_H, ART_W, type ArtItem, type FacilityArt } from '@office-pixel/sim';
import { Num } from './ui';

const COLORS = ['#e8edf7', '#9aa6c0', '#3a4560', '#131824', '#c0392b', '#e0883a', '#f5c451', '#7aa86a', '#4cd98a', '#5d8fc9', '#5aa9ff', '#9b6bd1', '#b98856', '#ffffff'];
const STAMPS = ['🧪', '🔬', '⚗️', '🧫', '🍳', '🔥', '🛢️', '⚙️', '🔧', '🔩', '🧰', '🖥️', '💻', '📡', '🔌', '💡', '📦', '🛒', '🏥', '💊', '🧊', '🚿', '🪑', '📋', '🔒', '⚡', '🌡️', '🪣', '🧯', '🚪'];

type Tool = 'select' | 'rect' | 'ellipse' | 'tri' | 'line';
const TOOLS: Array<{ id: Tool; label: string; hint: string }> = [
  { id: 'select', label: '↖ Mover', hint: 'Elegir, mover y cambiar el tamaño de un elemento' },
  { id: 'rect', label: '▭ Rectángulo', hint: 'Arrastra sobre el lienzo' },
  { id: 'ellipse', label: '◯ Elipse', hint: 'Arrastra sobre el lienzo' },
  { id: 'tri', label: '△ Triángulo', hint: 'Arrastra sobre el lienzo' },
  { id: 'line', label: '╱ Línea', hint: 'Arrastra de un punto a otro' },
];

const round = (n: number) => Math.round(n * 10) / 10;

/** Dibuja una ilustración propia (elementos o imagen) en un SVG del tamaño del espacio de dibujo. */
export function ArtItems({ items }: { items: ArtItem[] }) {
  return (
    <>
      {items.map((it, i) => {
        if (it.t === 'rect') return <rect key={i} x={it.x} y={it.y} width={it.w} height={it.h} rx={it.r ?? 0} fill={it.c} />;
        if (it.t === 'ellipse') return <ellipse key={i} cx={it.x + it.w / 2} cy={it.y + it.h / 2} rx={it.w / 2} ry={it.h / 2} fill={it.c} />;
        if (it.t === 'tri') return <polygon key={i} points={`${it.x + it.w / 2},${it.y} ${it.x + it.w},${it.y + it.h} ${it.x},${it.y + it.h}`} fill={it.c} />;
        if (it.t === 'line') return <line key={i} x1={it.x} y1={it.y} x2={it.x2} y2={it.y2} stroke={it.c} stroke-width={it.lw} stroke-linecap="round" />;
        return (
          <text key={i} x={it.x} y={it.y + it.s * 0.85} font-size={it.s}>
            {it.ch}
          </text>
        );
      })}
    </>
  );
}

/** Miniatura de una ilustración propia, con el mismo encuadre que en el plano. */
export function ArtSvg({ art, label, icon }: { art: FacilityArt; label?: string; icon?: string }) {
  return (
    <svg class="fac-preview" viewBox={`0 0 190 ${Math.round((190 * ART_H) / ART_W) + 22}`} role="img" aria-label={`Vista previa: ${label ?? 'ilustración'}`}>
      <rect width={190} height={Math.round((190 * ART_H) / ART_W) + 22} rx={8} fill="#1f2635" />
      <rect width={190} height={13} rx={8} fill="#5aa9ff" opacity={0.85} />
      <text x={8} y={10} font-size={8.5} font-weight={700} fill="#0c0f16">
        {icon} {label}
      </text>
      <svg x={0} y={18} width={190} height={(190 * ART_H) / ART_W} viewBox={`0 0 ${ART_W} ${ART_H}`}>
        {art.image ? <image href={art.image} x={0} y={0} width={ART_W} height={ART_H} preserveAspectRatio="xMidYMid meet" /> : <ArtItems items={art.items ?? []} />}
      </svg>
    </svg>
  );
}

/** Reduce una imagen para usarla como ilustración (cabe en 480×160, conserva la transparencia). */
export async function artImageFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const k = Math.min(1, 480 / img.naturalWidth, 160 / img.naturalHeight);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    let out = c.toDataURL('image/png');
    if (out.length > 300_000) out = c.toDataURL('image/webp', 0.8);
    if (out.length > 300_000) throw new Error('La imagen es demasiado pesada; prueba con una más simple.');
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Drag =
  | { kind: 'create'; i: number; ox: number; oy: number }
  | { kind: 'move'; i: number; dx: number; dy: number }
  | { kind: 'size'; i: number }
  | { kind: 'p1' | 'p2'; i: number };

/** Editor de ilustración: se dibuja con formas e iconos sobre un lienzo y el resultado se ve igual en el plano. */
export function ArtEditor({ items, onChange }: { items: ArtItem[]; onChange: (items: ArtItem[]) => void }) {
  const [tool, setTool] = useState<Tool>('rect');
  const [color, setColor] = useState('#5d8fc9');
  const [sel, setSel] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const pt = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: round(((e.clientX - r.left) / r.width) * ART_W), y: round(((e.clientY - r.top) / r.height) * ART_H) };
  };
  const set = (i: number, patch: Partial<ArtItem>) => onChange(items.map((it, j) => (j === i ? ({ ...it, ...patch } as ArtItem) : it)));
  const current = sel !== null ? items[sel] : undefined;

  const down = (e: PointerEvent) => {
    if (tool === 'select') return setSel(null);
    if (items.length >= 80) return;
    const p = pt(e);
    const it: ArtItem = tool === 'line' ? { t: 'line', x: p.x, y: p.y, x2: p.x, y2: p.y, c: color, lw: 3 } : ({ t: tool, x: p.x, y: p.y, w: 0, h: 0, c: color } as ArtItem);
    onChange([...items, it]);
    setSel(items.length);
    drag.current = { kind: 'create', i: items.length, ox: p.x, oy: p.y };
    svg.current!.setPointerCapture(e.pointerId);
  };
  const grab = (e: PointerEvent, i: number, kind: Drag['kind']) => {
    e.stopPropagation();
    const p = pt(e);
    const it = items[i];
    setSel(i);
    if (kind === 'move') drag.current = { kind, i, dx: p.x - ('x' in it ? it.x : 0), dy: p.y - ('y' in it ? it.y : 0) };
    else drag.current = { kind, i } as Drag;
    svg.current!.setPointerCapture(e.pointerId);
  };
  const moveEv = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = pt(e);
    const it = items[d.i];
    if (!it) return;
    if (d.kind === 'create') {
      if (it.t === 'line') set(d.i, { x2: p.x, y2: p.y });
      else set(d.i, { x: Math.min(d.ox, p.x), y: Math.min(d.oy, p.y), w: Math.abs(p.x - d.ox), h: Math.abs(p.y - d.oy) } as Partial<ArtItem>);
    } else if (d.kind === 'move') {
      if (it.t === 'line') {
        const dx = p.x - d.dx - it.x;
        const dy = p.y - d.dy - it.y;
        set(d.i, { x: round(it.x + dx), y: round(it.y + dy), x2: round(it.x2 + dx), y2: round(it.y2 + dy) });
      } else set(d.i, { x: round(p.x - d.dx), y: round(p.y - d.dy) } as Partial<ArtItem>);
    } else if (d.kind === 'size') {
      if (it.t === 'emoji') set(d.i, { s: Math.max(6, round(p.y - it.y) / 0.9) } as Partial<ArtItem>);
      else if (it.t !== 'line') set(d.i, { w: Math.max(2, round(p.x - it.x)), h: Math.max(2, round(p.y - it.y)) } as Partial<ArtItem>);
    } else if (it.t === 'line') {
      set(d.i, d.kind === 'p1' ? { x: p.x, y: p.y } : { x2: p.x, y2: p.y });
    }
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind !== 'create') return;
    const it = items[d.i];
    if (!it) return;
    // un simple clic crea una forma de tamaño estándar
    if (it.t === 'line' && Math.hypot(it.x2 - it.x, it.y2 - it.y) < 3) set(d.i, { x2: it.x + 30, y2: it.y });
    else if (it.t !== 'line' && it.t !== 'emoji' && it.w < 3 && it.h < 3) set(d.i, { w: 30, h: 20 } as Partial<ArtItem>);
    setTool('select');
  };

  const addStamp = (ch: string) => {
    if (items.length >= 80) return;
    onChange([...items, { t: 'emoji', x: ART_W / 2 - 14, y: ART_H / 2 - 14, s: 28, ch }]);
    setSel(items.length);
    setTool('select');
  };
  const pick = (c: string) => {
    setColor(c);
    if (current && current.t !== 'emoji') set(sel!, { c } as Partial<ArtItem>);
  };
  const reorder = (to: number) => {
    if (sel === null || to < 0 || to >= items.length) return;
    const next = [...items];
    const [x] = next.splice(sel, 1);
    next.splice(to, 0, x);
    onChange(next);
    setSel(to);
  };
  const remove = () => {
    if (sel === null) return;
    onChange(items.filter((_, j) => j !== sel));
    setSel(null);
  };
  const duplicate = () => {
    if (!current) return;
    const copy = structuredClone(current);
    if ('x' in copy) {
      copy.x += 8;
      copy.y += 8;
    }
    if (copy.t === 'line') {
      copy.x2 += 8;
      copy.y2 += 8;
    }
    onChange([...items, copy]);
    setSel(items.length);
  };

  const handle = (x: number, y: number, kind: Drag['kind'], i: number) => (
    <circle cx={x} cy={y} r={3.4} class="art-handle" onPointerDown={(e) => grab(e as unknown as PointerEvent, i, kind)} />
  );

  return (
    <div class="art-editor">
      <div class="art-tools">
        {TOOLS.map((t) => (
          <button type="button" key={t.id} class={tool === t.id ? 'on' : ''} title={t.hint} onClick={() => (setTool(t.id), t.id !== 'select' && setSel(null))}>
            {t.label}
          </button>
        ))}
      </div>

      <div class="art-colors">
        {COLORS.map((c) => (
          <button type="button" key={c} class={c === color ? 'on' : ''} style={{ background: c }} title={c} onClick={() => pick(c)} aria-label={`Color ${c}`} />
        ))}
        <input type="color" value={color.length === 7 ? color : '#5d8fc9'} onInput={(e) => pick((e.currentTarget as HTMLInputElement).value)} title="Otro color" />
      </div>

      <svg
        ref={svg}
        class="art-canvas"
        viewBox={`0 0 ${ART_W} ${ART_H}`}
        onPointerDown={down as never}
        onPointerMove={moveEv as never}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ cursor: tool === 'select' ? 'default' : 'crosshair', touchAction: 'none' }}
      >
        <defs>
          <pattern id="art-grid" width={10} height={10} patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="#ffffff" stroke-opacity={0.06} />
          </pattern>
        </defs>
        <rect width={ART_W} height={ART_H} fill="#1f2635" />
        <rect width={ART_W} height={ART_H} fill="url(#art-grid)" />
        {items.map((it, i) => (
          <g key={i} class={sel === i ? 'art-item sel' : 'art-item'} onPointerDown={(e) => tool === 'select' && grab(e as unknown as PointerEvent, i, 'move')}>
            <ArtItems items={[it]} />
          </g>
        ))}
        {current && sel !== null && (
          <g>
            {current.t === 'line' ? (
              <>
                {handle(current.x, current.y, 'p1', sel)}
                {handle(current.x2, current.y2, 'p2', sel)}
              </>
            ) : current.t === 'emoji' ? (
              <>
                <rect x={current.x} y={current.y} width={current.s} height={current.s * 1.05} fill="none" class="art-box" />
                {handle(current.x + current.s, current.y + current.s * 0.95, 'size', sel)}
              </>
            ) : (
              <>
                <rect x={current.x} y={current.y} width={current.w} height={current.h} fill="none" class="art-box" />
                {handle(current.x + current.w, current.y + current.h, 'size', sel)}
              </>
            )}
          </g>
        )}
      </svg>
      <p class="muted art-hint">
        {tool === 'select' ? 'Haz clic en un elemento para moverlo; arrastra el punto azul para cambiar su tamaño.' : TOOLS.find((t) => t.id === tool)!.hint + '. Un clic crea una forma de tamaño estándar.'}
      </p>

      {current && sel !== null && (
        <div class="art-props">
          <b>Elemento seleccionado</b>
          {current.t === 'line' && <Num value={current.lw} min={1} max={12} suffix="grosor" onChange={(v) => set(sel, { lw: v ?? 3 } as Partial<ArtItem>)} />}
          {current.t === 'emoji' && <Num value={Math.round(current.s)} min={6} max={80} suffix="tamaño" onChange={(v) => set(sel, { s: v ?? 28 } as Partial<ArtItem>)} />}
          {current.t === 'rect' && (
            <label class="check">
              <input type="checkbox" checked={!!current.r} onChange={(e) => set(sel, { r: (e.currentTarget as HTMLInputElement).checked ? 4 : 0 } as Partial<ArtItem>)} />
              <span>Esquinas redondeadas</span>
            </label>
          )}
          <button type="button" class="btn" onClick={() => reorder(items.length - 1)} title="Poner delante de todo">
            ⤒ Al frente
          </button>
          <button type="button" class="btn" onClick={() => reorder(0)} title="Poner detrás de todo">
            ⤓ Al fondo
          </button>
          <button type="button" class="btn" onClick={duplicate}>
            ⧉ Duplicar
          </button>
          <button type="button" class="btn danger" onClick={remove}>
            🗑 Borrar
          </button>
        </div>
      )}

      <div class="art-stamps">
        <span class="muted">Iconos:</span>
        {STAMPS.map((s) => (
          <button type="button" key={s} onClick={() => addStamp(s)} title={`Añadir ${s}`}>
            {s}
          </button>
        ))}
      </div>
      <div class="fac-actions">
        <button type="button" class="btn" disabled={!items.length} onClick={() => (onChange([]), setSel(null))}>
          Limpiar lienzo
        </button>
        <span class="muted">{items.length} elemento(s) · máx. 80</span>
      </div>
    </div>
  );
}
