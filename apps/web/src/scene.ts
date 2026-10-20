import Phaser from 'phaser';
import { Replayer, type CaseView, type ProcessDef, type SimResult, type StageDef } from '@office-pixel/sim';
import { computeLayout, type MapLayout, type RoomLayout } from './layout';

export interface HudState {
  t: number;
  created: number;
  completed: number;
  breaches: number;
  exceptions: number;
  playing: boolean;
}

const CRATE = 14;
const STEP = 18;
const OUTLINE = 0x3a2a10;
const STATUS_COLOR = { waiting: 0xc8913a, working: 0x4aa3ff, delayed: 0xb06ab3, done: 0x5bc16a } as const;
const DEFAULT_WIP = 10;
const SEMANTIC_ZOOM = 0.4;

interface RoomView {
  layout: RoomLayout;
  stage: StageDef;
  wip: number | null;
  overlay: Phaser.GameObjects.Rectangle;
  count: Phaser.GameObjects.Text;
  big: Phaser.GameObjects.Text;
  overflow: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  cols: number;
  maxSlots: number;
  flash: number;
}

interface Crate {
  rect: Phaser.GameObjects.Rectangle;
  tx: number;
  ty: number;
}

const TEXT = (size: number, color = '#dfe5f3') => ({
  fontFamily: '"Courier New", monospace',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
});

export class ProcessScene extends Phaser.Scene {
  onHud?: (h: HudState) => void;
  playing = false;
  speed = 20;
  simT = 0;

  private ready = false;
  private pending?: { def: ProcessDef; result: SimResult };
  private layout?: MapLayout;
  private replayer?: Replayer;
  private horizon = 0;
  private entry = '';
  private rooms = new Map<string, RoomView>();
  private crates = new Map<string, Crate>();

  constructor() {
    super('process');
  }

  create() {
    const cam = this.cameras.main;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.15, 3));
    });
    this.scale.on('resize', () => this.fit());
    this.ready = true;
    if (this.pending) this.setModel(this.pending.def, this.pending.result);
  }

  setModel(def: ProcessDef, result: SimResult) {
    if (!this.ready) {
      this.pending = { def, result };
      return;
    }
    this.pending = undefined;
    this.children.removeAll(true);
    this.rooms.clear();
    this.crates.clear();

    this.layout = computeLayout(def);
    this.replayer = new Replayer(result.events);
    this.horizon = result.options.horizonMinutes;
    this.entry = def.stages[0].id;
    this.simT = 0;
    this.playing = true;

    const g = this.add.graphics().setDepth(1);
    this.drawEdges(g, this.layout);
    for (const stage of def.stages) this.buildRoom(stage, this.layout.rooms.get(stage.id)!, def);
    this.fit();
  }

  fit() {
    if (!this.layout) return;
    const cam = this.cameras.main;
    const z = Math.min(cam.width / this.layout.width, cam.height / this.layout.height, 1.4);
    cam.setZoom(z);
    cam.centerOn(this.layout.width / 2, this.layout.height / 2);
  }

  seek(t: number) {
    this.simT = Phaser.Math.Clamp(t, 0, this.horizon);
  }

  // ---------- construcción ----------

  private drawEdges(g: Phaser.GameObjects.Graphics, layout: MapLayout) {
    for (const e of layout.edges) {
      const a = layout.rooms.get(e.from)!;
      const b = layout.rooms.get(e.to)!;
      const exc = e.kind === 'exception';
      const color = exc ? 0xff5a4a : 0x6f7b99;
      g.lineStyle(exc ? 2 : 4, color, exc ? 0.7 : 1);
      const pts: Array<[number, number]> = [];
      if (b.depth > a.depth) {
        const off = exc ? 10 : 0;
        const y1 = a.y + a.h / 2 + off;
        const y2 = b.y + b.h / 2 + off;
        const mx = (a.x + a.w + b.x) / 2 + (exc ? 8 : 0);
        pts.push([a.x + a.w, y1], [mx, y1], [mx, y2], [b.x, y2]);
      } else {
        // retrabajo hacia atrás: sube por encima de las salas
        const top = Math.min(a.y, b.y) - 28 - (a.depth - b.depth) * 4;
        pts.push([a.x + a.w / 2, a.y], [a.x + a.w / 2, top], [b.x + b.w / 2, top], [b.x + b.w / 2, b.y]);
      }
      for (let i = 0; i < pts.length - 1; i++) {
        if (exc) this.dashed(g, pts[i], pts[i + 1]);
        else g.lineBetween(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
      }
      const [lx, ly] = pts[pts.length - 1];
      const [px, py] = pts[pts.length - 2];
      const ang = Math.atan2(ly - py, lx - px);
      g.fillStyle(color, 1);
      g.fillTriangle(
        lx, ly,
        lx - 10 * Math.cos(ang - 0.45), ly - 10 * Math.sin(ang - 0.45),
        lx - 10 * Math.cos(ang + 0.45), ly - 10 * Math.sin(ang + 0.45),
      );
    }
  }

  private dashed(g: Phaser.GameObjects.Graphics, a: [number, number], b: [number, number]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / len;
    const dy = (b[1] - a[1]) / len;
    for (let d = 0; d < len; d += 14) {
      const e = Math.min(d + 8, len);
      g.lineBetween(a[0] + dx * d, a[1] + dy * d, a[0] + dx * e, a[1] + dy * e);
    }
  }

  private buildRoom(stage: StageDef, l: RoomLayout, def: ProcessDef) {
    const terminal = stage.terminal === true;
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0x07080c, 1);
    g.fillRect(l.x - 5, l.y - 5, l.w + 10, l.h + 10);
    const c1 = terminal ? 0x1f3a2c : 0x232a3a;
    const c2 = terminal ? 0x1b3326 : 0x1f2534;
    for (let ty = 0; ty * 20 < l.h; ty++)
      for (let tx = 0; tx * 20 < l.w; tx++) {
        g.fillStyle((tx + ty) % 2 ? c1 : c2, 1);
        g.fillRect(l.x + tx * 20, l.y + ty * 20, 20, 20);
      }
    g.fillStyle(terminal ? 0x2f6a4a : 0x2b3346, 1);
    g.fillRect(l.x, l.y, l.w, 28);
    g.fillStyle(0x8a6a3a, 1); // puertas
    g.fillRect(l.x - 6, l.y + l.h / 2 - 14, 8, 28);
    g.fillRect(l.x + l.w - 2, l.y + l.h / 2 - 14, 8, 28);

    this.add.text(l.x + 8, l.y + 7, stage.label ?? stage.id, TEXT(12)).setDepth(5);
    const res = def.resources?.find((r) => r.id === stage.resource);
    const sub = res ? `${res.id} ×${res.count}` : terminal ? 'salida' : 'sin recurso';
    this.add.text(l.x + 8, l.y + 32, sub, TEXT(10, '#8591ad')).setDepth(5);

    const count = this.add.text(l.x + l.w - 8, l.y + 7, '0', TEXT(12, '#ffd479')).setOrigin(1, 0).setDepth(5);
    const big = this.add
      .text(l.x + l.w / 2, l.y + l.h / 2 + 10, '0', TEXT(72, '#ffffff'))
      .setOrigin(0.5)
      .setDepth(20)
      .setVisible(false);
    const overflow = this.add.text(l.x + l.w - 8, l.y + l.h - 6, '', TEXT(11, '#ffd479')).setOrigin(1, 1).setDepth(12);
    const overlay = this.add.rectangle(l.x, l.y, l.w, l.h, 0xff3030, 0).setOrigin(0).setDepth(3);
    const bar = this.add.graphics().setDepth(5);

    const cols = Math.floor((l.w - 24) / STEP);
    const rows = Math.floor((l.h - 64) / STEP);
    this.rooms.set(stage.id, {
      layout: l,
      stage,
      wip: terminal ? null : (stage.wip?.limit ?? DEFAULT_WIP),
      overlay,
      count,
      big,
      overflow,
      bar,
      cols,
      maxSlots: cols * rows,
      flash: 0,
    });
  }

  // ---------- bucle ----------

  update(time: number, delta: number) {
    const rp = this.replayer;
    if (!rp) return;
    if (this.playing) {
      this.simT += (delta / 1000) * this.speed;
      if (this.simT >= this.horizon) {
        this.simT = this.horizon;
        this.playing = false;
      }
    }
    for (const ev of rp.advanceTo(this.simT)) {
      if (ev.type === 'exception') {
        const room = this.rooms.get(ev.stage);
        if (room) room.flash = 1;
      }
    }

    const byStage = new Map<string, CaseView[]>();
    for (const c of rp.cases.values()) {
      if (!c.stage) continue;
      let list = byStage.get(c.stage);
      if (!list) byStage.set(c.stage, (list = []));
      list.push(c);
    }
    const seen = new Set<string>();
    const zoom = this.cameras.main.zoom;
    const semantic = zoom < SEMANTIC_ZOOM;
    const blink = Math.floor(time / 250) % 2 === 0;

    for (const [id, room] of this.rooms) {
      const list = byStage.get(id) ?? [];
      list.sort((a, b) => a.enteredAt - b.enteredAt || (a.id < b.id ? -1 : 1));
      const active = list.filter((c) => c.status !== 'done').length;
      const l = room.layout;

      room.count.setText(room.wip ? `${active}/${room.wip}` : `${list.length}`);
      room.big.setText(`${room.wip ? active : list.length}`).setVisible(semantic);
      this.drawLoad(room, active, time, delta);

      const shown = list.length > room.maxSlots ? room.maxSlots - 1 : list.length;
      room.overflow.setText(list.length > shown ? `+${list.length - shown}` : '');
      list.forEach((c, i) => {
        if (i >= shown) return;
        seen.add(c.id);
        const col = i % room.cols;
        const row = Math.floor(i / room.cols);
        const tx = l.x + 12 + col * STEP + CRATE / 2;
        const ty = l.y + 56 + row * STEP + CRATE / 2;
        let crate = this.crates.get(c.id);
        if (!crate) {
          const first = this.rooms.get(this.entry)!.layout;
          const rect = this.add
            .rectangle(first.x - 30, first.y + first.h / 2, CRATE, CRATE, STATUS_COLOR.waiting)
            .setDepth(10);
          crate = { rect, tx, ty };
          this.crates.set(c.id, crate);
        }
        crate.tx = tx;
        crate.ty = ty;
        crate.rect.setFillStyle(STATUS_COLOR[c.status]);
        crate.rect.setStrokeStyle(2, c.breached && blink ? 0xff2020 : OUTLINE);
        crate.rect.setVisible(!semantic);
      });
    }

    for (const [id, crate] of this.crates) {
      if (!seen.has(id)) {
        crate.rect.setVisible(false);
        continue;
      }
      const k = Math.min(1, delta / 90);
      crate.rect.x += (crate.tx - crate.rect.x) * k;
      crate.rect.y += (crate.ty - crate.rect.y) * k;
    }

    this.onHud?.({ t: this.simT, playing: this.playing, ...rp.counters, created: rp.counters.created });
  }

  /** Cuello de botella: barra de carga segmentada + tinte ámbar/rojo de la sala. */
  private drawLoad(room: RoomView, active: number, time: number, delta: number) {
    const { x, y } = room.layout;
    room.bar.clear();
    if (room.wip === null) {
      room.overlay.setFillStyle(0x000000, 0);
      return;
    }
    const load = active / room.wip;
    const color = load < 0.7 ? 0x5bc16a : load <= 1 ? 0xffb020 : 0xff3030;
    const filled = Math.min(10, Math.round(load * 10));
    for (let i = 0; i < 10; i++) {
      room.bar.fillStyle(i < filled ? color : 0x2b3346, 1);
      room.bar.fillRect(x + i * 24, y - 16, 21, 8);
    }
    let alpha = 0;
    let tint = 0xffb020;
    if (load > 1) {
      tint = 0xff3030;
      alpha = 0.16 + 0.08 * Math.sin(time / 180);
    } else if (load >= 0.7) alpha = ((load - 0.7) / 0.3) * 0.14;
    if (room.flash > 0) {
      tint = 0xff3030;
      alpha = Math.max(alpha, room.flash * 0.45);
      room.flash = Math.max(0, room.flash - delta / 450);
    }
    room.overlay.setFillStyle(tint, alpha);
  }
}
