import { useRef, useState } from 'preact/hooks';
import { WARNING_LABEL, type ImageMark, type ProcStep, type StepImage, type WarningKind } from '@office-pixel/sim';

export const WARNING_COLOR: Record<WarningKind, string> = {
  critico: '#ff4d3d',
  financiero: '#f5c451',
  seguridad: '#ff8a3d',
  error_comun: '#5aa9ff',
};
export const WARNING_ICON: Record<WarningKind, string> = { critico: '🛑', financiero: '💰', seguridad: '🦺', error_comun: '⚠️' };

/** Reduce y comprime una imagen para no inflar el documento (máx. ~900 px de ancho, JPEG). */
export async function fileToDataUrl(file: File, maxW = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const W = 1000;

/** Dibuja las marcas (círculos, flechas y números) en rojo sobre una imagen de ancho 1000. */
function Marks({ marks, h }: { marks: ImageMark[]; h: number }) {
  return (
    <>
      <defs>
        <marker id="mk-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" fill="#ff2d2d" />
        </marker>
      </defs>
      {marks.map((m, i) => {
        const x = m.x * W;
        const y = m.y * h;
        if (m.kind === 'circle')
          return <circle key={i} cx={x} cy={y} r={44} fill="none" stroke="#ff2d2d" stroke-width={6} />;
        if (m.kind === 'arrow')
          return <line key={i} x1={x} y1={y} x2={(m.x2 ?? m.x) * W} y2={(m.y2 ?? m.y) * h} stroke="#ff2d2d" stroke-width={7} stroke-linecap="round" marker-end="url(#mk-arrow)" />;
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={24} fill="#ff2d2d" stroke="#fff" stroke-width={3} />
            <text x={x} y={y + 9} text-anchor="middle" font-size={26} font-weight={800} fill="#fff" font-family="Segoe UI, sans-serif">
              {m.n}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** Captura de pantalla con sus marcas, solo lectura. */
export function AnnotatedImage({ image }: { image: StepImage }) {
  const [ratio, setRatio] = useState(0.62);
  return (
    <div class="annot ro">
      <img src={image.src} alt={image.caption ?? 'Captura'} onLoad={(e) => setRatio((e.target as HTMLImageElement).naturalHeight / (e.target as HTMLImageElement).naturalWidth)} />
      <svg viewBox={`0 0 ${W} ${W * ratio}`} preserveAspectRatio="none">
        <Marks marks={image.marks} h={W * ratio} />
      </svg>
    </div>
  );
}

type Tool = 'circle' | 'arrow' | 'num';

/** Editor de marcas: clic = círculo o número; arrastrar = flecha. */
export function Annotator({ image, onChange }: { image: StepImage; onChange: (img: StepImage) => void }) {
  const [tool, setTool] = useState<Tool>('circle');
  const [ratio, setRatio] = useState(0.62);
  const [drag, setDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const h = W * ratio;

  const point = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const add = (m: ImageMark) => onChange({ ...image, marks: [...image.marks, m] });
  const nextN = () => Math.max(0, ...image.marks.filter((m) => m.kind === 'num').map((m) => m.n ?? 0)) + 1;

  return (
    <div class="annotator">
      <div class="annot-tools">
        <div class="seg">
          <button type="button" class={tool === 'circle' ? 'on' : ''} onClick={() => setTool('circle')} title="Clic para marcar con un círculo">
            ◯ Círculo
          </button>
          <button type="button" class={tool === 'arrow' ? 'on' : ''} onClick={() => setTool('arrow')} title="Arrastra para dibujar una flecha">
            ➜ Flecha
          </button>
          <button type="button" class={tool === 'num' ? 'on' : ''} onClick={() => setTool('num')} title="Clic para numerar">
            ① Número
          </button>
        </div>
        <button type="button" class="btn small" disabled={!image.marks.length} onClick={() => onChange({ ...image, marks: image.marks.slice(0, -1) })}>
          ↶ Deshacer
        </button>
        <button type="button" class="btn small" disabled={!image.marks.length} onClick={() => onChange({ ...image, marks: [] })}>
          Quitar marcas
        </button>
        <span class="hint">{image.marks.length} marca(s) · {tool === 'arrow' ? 'arrastra sobre la imagen' : 'haz clic sobre la imagen'}</span>
      </div>
      <div class="annot">
        <img src={image.src} alt="Captura" draggable={false} onLoad={(e) => setRatio((e.target as HTMLImageElement).naturalHeight / (e.target as HTMLImageElement).naturalWidth)} />
        <svg
          ref={ref}
          class="edit"
          viewBox={`0 0 ${W} ${h}`}
          preserveAspectRatio="none"
          onPointerDown={(e) => {
            const p = point(e);
            (e.target as Element).setPointerCapture?.(e.pointerId);
            if (tool === 'circle') add({ kind: 'circle', x: p.x, y: p.y });
            else if (tool === 'num') add({ kind: 'num', x: p.x, y: p.y, n: nextN() });
            else setDrag({ x: p.x, y: p.y, x2: p.x, y2: p.y });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            const p = point(e);
            setDrag({ ...drag, x2: p.x, y2: p.y });
          }}
          onPointerUp={() => {
            if (!drag) return;
            if (Math.hypot((drag.x2 - drag.x) * W, (drag.y2 - drag.y) * h) > 30) add({ kind: 'arrow', ...drag });
            setDrag(null);
          }}
        >
          <Marks marks={drag ? [...image.marks, { kind: 'arrow', ...drag }] : image.marks} h={h} />
        </svg>
      </div>
    </div>
  );
}

// ---------- diagrama de flujo a nivel de tarea ----------

const NW = 190;
const NH = 70;
const GX = 40;
const GY = 34;
const PER_ROW = 4;

const wrap = (text: string, n: number): string[] => {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > n && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2).map((l, i, a) => (i === a.length - 1 && words.join(' ').length > n * 2 ? `${l.slice(0, n - 1)}…` : l));
};

/** Secuencia lineal de los pasos del procedimiento, con sus alertas y alternativas. */
export function TaskFlow({ steps }: { steps: ProcStep[] }) {
  if (!steps.length) return <p class="empty">Aún no hay pasos. Redáctalos en el paso 3.</p>;
  const rows = Math.ceil(steps.length / PER_ROW);
  const cols = Math.min(PER_ROW, steps.length);
  const width = 30 + cols * NW + (cols - 1) * GX + 30;
  const height = 24 + rows * NH + (rows - 1) * GY + 40;
  const pos = (i: number) => ({ x: 30 + (i % PER_ROW) * (NW + GX), y: 20 + Math.floor(i / PER_ROW) * (NH + GY) });
  return (
    <div class="flowwrap">
      <svg class="flow taskflow" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Diagrama de flujo del procedimiento">
        <defs>
          <marker id="tf-arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" class="arrow" />
          </marker>
        </defs>
        {steps.slice(0, -1).map((_, i) => {
          const a = pos(i);
          const b = pos(i + 1);
          const sameRow = Math.floor(i / PER_ROW) === Math.floor((i + 1) / PER_ROW);
          if (sameRow) return <line key={i} x1={a.x + NW} y1={a.y + NH / 2} x2={b.x} y2={b.y + NH / 2} class="edge" marker-end="url(#tf-arr)" />;
          // salto de fila: baja, vuelve al principio y entra por arriba
          return (
            <path
              key={i}
              d={`M${a.x + NW / 2},${a.y + NH} V${a.y + NH + GY / 2} H${b.x + NW / 2} V${b.y}`}
              class="edge"
              fill="none"
              marker-end="url(#tf-arr)"
            />
          );
        })}
        {steps.map((s, i) => {
          const p = pos(i);
          const lines = wrap(s.action || '(sin acción)', 27);
          return (
            <g key={s.id} class="fnode" transform={`translate(${p.x},${p.y})`}>
              <rect width={NW} height={NH} rx={10} style={s.warning ? { stroke: WARNING_COLOR[s.warning.kind], 'stroke-width': 2.5 } : undefined} />
              <circle cx={18} cy={18} r={11} class="stepnum" />
              <text x={18} y={22} text-anchor="middle" class="stepnum-t">
                {i + 1}
              </text>
              <text x={36} y={22} class="t2">
                {(s.actor || '—').slice(0, 24)}
              </text>
              {lines.map((l, k) => (
                <text key={k} x={12} y={42 + k * 14} class="t1 small">
                  {l}
                </text>
              ))}
              <text x={NW - 8} y={14} text-anchor="end" class="t3">
                {s.warning ? WARNING_ICON[s.warning.kind] : ''}
                {s.image ? ' 📷' : ''}
                {s.alternatives.length ? ` ↳${s.alternatives.length}` : ''}
              </text>
            </g>
          );
        })}
        <text x={30} y={height - 10} class="t3">
          ▶ Inicio · {steps.length} paso(s) · ■ Fin
        </text>
      </svg>
    </div>
  );
}

/** Caja de advertencia visual (alerta de seguridad, riesgo financiero, error común…). */
export function WarningBox({ warning }: { warning: NonNullable<ProcStep['warning']> }) {
  return (
    <div class="warnbox" style={{ borderColor: WARNING_COLOR[warning.kind], background: `${WARNING_COLOR[warning.kind]}18` }}>
      <b style={{ color: WARNING_COLOR[warning.kind] }}>
        {WARNING_ICON[warning.kind]} {WARNING_LABEL[warning.kind]}
      </b>
      <span>{warning.text}</span>
    </div>
  );
}
