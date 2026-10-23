import { useEffect, useRef, useState } from 'preact/hooks';
import { DECOR, DECOR_GROUPS, decorBounds, type CompanyDef, type DecorGroup, type DecorItem } from '@office-pixel/sim';
import { buildBuilding } from '../../scene/building';
import { ArtItems } from './arte';
import { findUnit } from '../../application/editing/model';
import type { Up } from './ui';

const SNAP = 2;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;
const newId = () => `d_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

/** Dibuja un objeto del catálogo centrado en (0, 0), con su giro y espejo. */
function DecorShape({ k, rot, flip }: { k: string; rot: number; flip?: boolean }) {
  const d = DECOR[k];
  if (!d) return null;
  return (
    <g transform={`rotate(${rot}) scale(${flip ? -1 : 1},1) translate(${-d.w / 2},${-d.h / 2})`}>
      <ArtItems items={d.art} />
    </g>
  );
}

function Swatch({ k }: { k: string }) {
  const d = DECOR[k];
  const s = Math.max(d.w, d.h);
  return (
    <svg viewBox={`${-(s - d.w) / 2 - 2} ${-(s - d.h) / 2 - 2} ${s + 4} ${s + 4}`} width={38} height={38} aria-hidden="true">
      <ArtItems items={d.art} />
    </svg>
  );
}

/**
 * Editor de la sala de un área o subárea: se eligen objetos del catálogo (mesas, sillas, puertas, plantas…)
 * y se acomodan arrastrándolos. Solo es decoración: los escritorios de las personas se generan solos.
 */
export function DecorEditor({ d, unitId, up, note, onClose }: { d: CompanyDef; unitId: string; up: Up; note: (m: string) => void; onClose: () => void }) {
  const unit = findUnit(d.units, unitId)!;
  const room = buildBuilding(d, 'vertical').rooms.get(unitId);
  const [items, setItems] = useState<DecorItem[]>(() => structuredClone(unit.decor ?? []));
  const [sel, setSel] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [group, setGroup] = useState<DecorGroup>('Muebles');
  const [dirty, setDirty] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  if (!room) return null;
  const W = room.w;
  const H = room.h;
  const change = (next: DecorItem[]) => {
    setItems(next);
    setDirty(true);
  };
  const patch = (id: string, p: Partial<DecorItem>) => change(items.map((it) => (it.id === id ? { ...it, ...p } : it)));
  const current = items.find((it) => it.id === sel);

  const pt = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const clamp = (x: number, y: number) => ({ x: Math.min(W, Math.max(0, snap(x))), y: Math.min(H, Math.max(0, snap(y))) });

  const place = (k: string, x: number, y: number) => {
    if (items.length >= 300) return note('Máximo 300 objetos por sala.');
    const it: DecorItem = { id: newId(), k, ...clamp(x, y), rot: 0 };
    change([...items, it]);
    setSel(it.id);
  };

  const canvasDown = (e: PointerEvent) => {
    if (armed) {
      const p = pt(e);
      place(armed, p.x, p.y);
    } else setSel(null);
  };
  const itemDown = (e: PointerEvent, it: DecorItem) => {
    if (armed) return; // con un objeto en mano, el clic coloca uno nuevo
    e.stopPropagation();
    const p = pt(e);
    setSel(it.id);
    drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y };
    svg.current!.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const p = pt(e);
    const c = clamp(p.x - g.dx, p.y - g.dy);
    setItems((prev) => prev.map((it) => (it.id === g.id ? { ...it, ...c } : it)));
    setDirty(true);
  };
  const release = () => {
    drag.current = null;
  };

  const rotate = () => current && patch(current.id, { rot: ((current.rot + 90) % 360) as DecorItem['rot'] });
  const flip = () => current && patch(current.id, { flip: !current.flip });
  const remove = () => {
    if (!current) return;
    change(items.filter((it) => it.id !== current.id));
    setSel(null);
  };
  const duplicate = () => {
    if (!current) return;
    const c = clamp(current.x + 10, current.y + 10);
    const copy = { ...current, id: newId(), ...c };
    change([...items, copy]);
    setSel(copy.id);
  };
  const order = (front: boolean) => {
    if (!current) return;
    const rest = items.filter((it) => it.id !== current.id);
    change(front ? [...rest, current] : [current, ...rest]);
  };
  const nudge = (dx: number, dy: number) => current && patch(current.id, clamp(current.x + dx, current.y + dy));

  // atajos: R gira, Supr borra, flechas mueven, Esc suelta el objeto en mano
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        // Esc solo suelta el objeto o la selección; cerrar siempre pide un botón, para no perder el trabajo
        if (armed) setArmed(null);
        else if (sel) setSel(null);
      } else if (!current) return;
      else if (e.key === 'r' || e.key === 'R') rotate();
      else if (e.key === 'Delete' || e.key === 'Backspace') remove();
      else if (e.key === 'ArrowLeft') nudge(-SNAP, 0);
      else if (e.key === 'ArrowRight') nudge(SNAP, 0);
      else if (e.key === 'ArrowUp') nudge(0, -SNAP);
      else if (e.key === 'ArrowDown') nudge(0, SNAP);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const save = () => {
    up((x) => {
      const u = findUnit(x.units, unitId)!;
      if (items.length) u.decor = items;
      else delete u.decor;
    });
    note(`Sala «${unit.name ?? unit.id}»: ${items.length} objeto(s) guardados en el formulario.`);
    onClose();
  };
  const close = () => {
    if (dirty && !confirm('Hay cambios sin guardar en esta sala. ¿Cerrar y descartarlos?')) return;
    onClose();
  };

  const groupKeys = Object.keys(DECOR).filter((k) => DECOR[k].group === group);
  const b = current ? decorBounds(current) : null;

  return (
    <div class="modal-back" onClick={close}>
      <div class="modal wide decor-editor" role="dialog" aria-label={`Decorar ${unit.name ?? unit.id}`} onClick={(e) => e.stopPropagation()}>
        <div class="decor-head">
          <h3>🪑 Decorar «{unit.name ?? unit.id}»</h3>
          <span class="muted">
            {items.length} objeto(s) · sala de {Math.round(W)}×{Math.round(H)}
          </span>
        </div>

        <div class="decor-body">
          <aside class="decor-palette">
            <div class="decor-groups">
              {DECOR_GROUPS.map((g) => (
                <button type="button" key={g} class={g === group ? 'on' : ''} onClick={() => setGroup(g)}>
                  {g}
                </button>
              ))}
            </div>
            <div class="decor-items">
              {groupKeys.map((k) => (
                <button type="button" key={k} class={armed === k ? 'on' : ''} title={`${DECOR[k].label}: clic para tomarlo y clic en la sala para colocarlo`} onClick={() => setArmed(armed === k ? null : k)}>
                  <Swatch k={k} />
                  <span>{DECOR[k].label}</span>
                </button>
              ))}
            </div>
          </aside>

          <section class="decor-stage">
            <svg
              ref={svg}
              class="decor-canvas"
              viewBox={`0 0 ${W} ${H}`}
              onPointerDown={canvasDown as never}
              onPointerMove={move as never}
              onPointerUp={release}
              onPointerCancel={release}
              style={{ cursor: armed ? 'copy' : 'default', touchAction: 'none' }}
            >
              <defs>
                <pattern id="decor-grid" width={16} height={16} patternUnits="userSpaceOnUse">
                  <path d="M16 0H0V16" fill="none" stroke="#ffffff" stroke-opacity={0.05} />
                </pattern>
              </defs>
              <rect width={W} height={H} rx={7} fill="#1f2635" />
              <rect width={W} height={H} rx={7} fill="url(#decor-grid)" />
              <rect width={W} height={24} rx={7} fill="#5aa9ff" opacity={0.85} />
              <text x={8} y={16} font-size={11} font-weight={700} fill="#0c0f16">
                {unit.name ?? unit.id}
              </text>
              {/* lo que ya genera la app: escritorios de las personas y bandeja de entrada */}
              {room.desks.map((dk) => (
                <g key={dk.personId} opacity={0.55} class="decor-ghost">
                  <rect x={dk.x - room.x - 24} y={dk.y - room.y - 15} width={48} height={31} rx={5} fill="#b98856" />
                  <circle cx={dk.seat.x - room.x} cy={dk.seat.y - room.y - 6} r={8} fill="#34405c" />
                </g>
              ))}
              <rect x={room.inbox.x - room.x - 4} y={room.inbox.y - room.y - 4} width={3 * 18 + 6} height={room.inbox.rows * 18 + 6} rx={6} fill="#0f131c" opacity={0.7} />
              <rect x={W / 2 - 17} y={H - 5} width={34} height={5} fill="#b98856" opacity={0.8} />
              {items.map((it) => (
                <g
                  key={it.id}
                  class={sel === it.id ? 'decor-item sel' : 'decor-item'}
                  transform={`translate(${it.x},${it.y})`}
                  onPointerDown={(e) => itemDown(e as unknown as PointerEvent, it)}
                  style={{ cursor: armed ? 'copy' : 'move' }}
                >
                  <DecorShape k={it.k} rot={it.rot} flip={it.flip} />
                </g>
              ))}
              {b && current && <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" class="art-box" />}
            </svg>
            <p class="muted art-hint">
              {armed
                ? `Tienes «${DECOR[armed].label}» en la mano: haz clic en la sala para colocarlo (varias veces si quieres). Esc o el botón «Soltar» para dejar de colocar.`
                : 'Elige un objeto de la izquierda y haz clic en la sala para colocarlo. Arrástralo para moverlo. Los escritorios con sombra son los de las personas: se generan solos.'}
            </p>

            <div class="art-props">
              {armed && (
                <button type="button" class="btn" onClick={() => setArmed(null)}>
                  ✋ Soltar
                </button>
              )}
              {current ? (
                <>
                  <b>{DECOR[current.k]?.label ?? current.k}</b>
                  <button type="button" class="btn" onClick={rotate} title="Girar 90° (R)">
                    ↻ Girar
                  </button>
                  <button type="button" class="btn" onClick={flip} title="Espejo horizontal">
                    ⇋ Espejo
                  </button>
                  <button type="button" class="btn" onClick={duplicate}>
                    ⧉ Duplicar
                  </button>
                  <button type="button" class="btn" onClick={() => order(true)} title="Poner delante de todo">
                    ⤒ Al frente
                  </button>
                  <button type="button" class="btn" onClick={() => order(false)} title="Poner detrás de todo">
                    ⤓ Al fondo
                  </button>
                  <button type="button" class="btn danger" onClick={remove} title="Borrar (Supr)">
                    🗑 Borrar
                  </button>
                </>
              ) : (
                <span class="muted">Haz clic en un objeto para girarlo, duplicarlo o borrarlo (R gira, Supr borra, las flechas lo mueven).</span>
              )}
            </div>
          </section>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn" disabled={!items.length} onClick={() => confirm('¿Quitar todos los objetos de esta sala?') && (change([]), setSel(null))}>
            Vaciar sala
          </button>
          <span style={{ flex: 1 }} />
          <button type="button" class="btn" onClick={close}>
            Cancelar
          </button>
          <button type="button" class="btn primary" onClick={save}>
            Guardar sala
          </button>
        </div>
      </div>
    </div>
  );
}
