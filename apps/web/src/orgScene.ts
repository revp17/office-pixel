import Phaser from 'phaser';
import {
  AUTO_ACTOR,
  OrgReplayer,
  ART_H,
  ART_W,
  DAY,
  DECOR,
  type ArtItem,
  type CompanyDef,
  type OrgCaseView,
  type OrgCounters,
  type OrgSimResult,
  type PersonState,
} from '@office-pixel/sim';
import {
  INBOX_STEP,
  buildBuilding,
  commonDest,
  deskDest,
  inboxSlot,
  route,
  type BuildingL,
  type CommonL,
  type Dest,
  type DoorSide,
  type Orientation,
  type Pt,
  type RoomL,
} from './building';

export interface OrgHud {
  t: number;
  playing: boolean;
  counters: OrgCounters;
  present: number;
  total: number;
  queued: number;
  selected?: string;
  selectedState?: PersonState;
  selectedCase?: string;
}

const AREA_COLORS = [0x5aa9ff, 0xffb547, 0xc084e0, 0x5ed08a, 0xff8a65, 0x4fd1d1];
const PROC_COLORS = [0xe8a93f, 0xe5677f, 0x5fc0e8, 0x9ad65f];
const SKIN = [0xf5d0b0, 0xe0b088, 0xc38d63, 0x9a6a47, 0xf8dcc2];
const HAIR = [0x2a1d14, 0x4a3020, 0x16120f, 0x7a5233, 0xc7a15a];
const DOT: Record<PersonState, number> = {
  off: 0x000000,
  idle: 0x9aa6c2,
  working: 0x5aa9ff,
  break: 0xffb547,
  meeting: 0xc084e0,
  absent: 0xff6b5a,
};
const SEMANTIC_ZOOM = 0.28;
const HEADER_Y = 40; // desde la parte superior de una sala hasta donde empiezan los escritorios
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FONT = '"Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif';

export function fmtTime(t: number): string {
  const day = Math.floor(t / DAY);
  const m = Math.floor(t % DAY);
  return `Día ${day + 1} · ${WEEKDAYS[day % 7]} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const TXT = (size: number, color = '#e6ebf7', weight: '400' | '600' | '700' = '600') => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: weight,
  color,
  resolution: 3, // texto nítido incluso al acercar la cámara
});

/** Mezcla dos colores 0xRRGGBB (t=0 → a, t=1 → b). */
function mix(a: number, b: number, t: number): number {
  const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
  const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
  const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
  return (r << 16) | (g << 8) | bl;
}

/** Mueve un objeto a lo largo de una lista de puntos a velocidad constante. */
class Mover {
  x: number;
  y: number;
  path: Pt[] = [];
  key = '';
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  setDest(key: string, plan: () => Pt[]) {
    if (key === this.key) return;
    this.key = key;
    this.path = plan();
  }
  snap(dest: Pt) {
    this.x = dest.x;
    this.y = dest.y;
    this.path = [];
  }
  /** devuelve true si se movió */
  step(dt: number, speed: number): boolean {
    let budget = speed * dt;
    let moved = false;
    while (budget > 0 && this.path.length) {
      const p = this.path[0];
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d <= budget) {
        this.x = p.x;
        this.y = p.y;
        this.path.shift();
        budget -= d;
        moved = moved || d > 0;
      } else {
        this.x += (dx / d) * budget;
        this.y += (dy / d) * budget;
        budget = 0;
        moved = true;
      }
    }
    return moved;
  }
}

interface PersonView {
  id: string;
  mover: Mover;
  container: Phaser.GameObjects.Container;
  art: Phaser.GameObjects.Container;
  legL: Phaser.GameObjects.Rectangle;
  legR: Phaser.GameObjects.Rectangle;
  dot: Phaser.GameObjects.Arc;
  tag: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  visible: boolean;
  facing: number;
}

interface CrateView {
  mover: Mover;
  box: Phaser.GameObjects.Container;
  alert: Phaser.GameObjects.Arc;
  img: Phaser.GameObjects.Image;
}

interface RoomView {
  room: RoomL;
  stats: Phaser.GameObjects.Text;
  overflow: Phaser.GameObjects.Text;
  big: Phaser.GameObjects.Text;
  overlay: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Graphics;
  people: string[];
}

export class OrgScene extends Phaser.Scene {
  onHud?: (h: OrgHud) => void;
  onSelect?: (personId: string | undefined) => void;
  /** se llama cuando el edificio ya está construido (p. ej. para pintar los chips de planta) */
  onModel?: () => void;
  playing = false;
  speed = 30;
  simT = 0;
  selected?: string;

  private ready = false;
  private pending?: { def: CompanyDef; result: OrgSimResult };
  private def?: CompanyDef;
  private result?: OrgSimResult;
  private orientation: Orientation = 'vertical';
  private b?: BuildingL;
  private rp?: OrgReplayer;
  private horizon = 0;
  private stageUnit = new Map<string, string>();
  private procIndex = new Map<string, number>();
  /** unidades que tienen alguna etapa automatizada (se dibuja su «bay» de sistema) */
  private autoUnits = new Set<string>();
  private persons = new Map<string, PersonView>();
  private crates = new Map<string, CrateView>();
  private roomViews = new Map<string, RoomView>();
  private areaOf = new Map<string, number>();
  private daylight?: Phaser.GameObjects.Rectangle;
  private ring?: Phaser.GameObjects.Graphics;
  private lastT = 0;
  private forceSnap = true;

  constructor() {
    super('org');
  }

  create() {
    this.makeCrateTextures();
    const cam = this.cameras.main;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    // zoom hacia el cursor: el punto bajo el puntero se queda quieto
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const oldZ = cam.zoom;
      const newZ = Phaser.Math.Clamp(oldZ * (dy > 0 ? 0.9 : 1.1), 0.12, 3.2);
      const wx = cam.scrollX + cam.width / 2 + (p.x - cam.width / 2) / oldZ;
      const wy = cam.scrollY + cam.height / 2 + (p.y - cam.height / 2) / oldZ;
      cam.setZoom(newZ);
      cam.scrollX = wx - (p.x - cam.width / 2) / newZ - cam.width / 2;
      cam.scrollY = wy - (p.y - cam.height / 2) / newZ - cam.height / 2;
    });
    this.scale.on('resize', () => this.fit());
    this.ready = true;
    if (this.pending) this.setModel(this.pending.def, this.pending.result);
  }

  /** Cajas (casos) como texturas suaves: una por proceso. */
  private makeCrateTextures() {
    PROC_COLORS.forEach((c, i) => {
      const g = this.make.graphics({}, false);
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(12, 19, 20, 5);
      g.fillStyle(mix(c, 0x000000, 0.35), 1);
      g.fillRoundedRect(2, 4, 20, 14, 3);
      g.fillStyle(c, 1);
      g.fillRoundedRect(2, 2, 20, 14, 3);
      g.fillStyle(0xffffff, 0.28);
      g.fillRoundedRect(3, 3, 18, 4, { tl: 2, tr: 2, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 0.55); // cinta
      g.fillRect(10.5, 2, 3, 14);
      g.generateTexture(`crate${i}`, 24, 22);
      g.destroy();
    });
  }

  // ---------- construcción ----------

  setModel(def: CompanyDef, result: OrgSimResult) {
    if (!this.ready) {
      this.pending = { def, result };
      return;
    }
    this.pending = undefined;
    this.children.removeAll(true);
    this.persons.clear();
    this.crates.clear();
    this.roomViews.clear();
    this.areaOf.clear();
    this.stageUnit.clear();
    this.procIndex.clear();
    this.selected = undefined;

    this.def = def;
    this.result = result;
    this.b = buildBuilding(def, this.orientation);
    this.rp = new OrgReplayer(result.events, def.people.map((p) => p.id));
    this.horizon = result.options.horizonDays * DAY;
    this.simT = 0;
    this.lastT = 0;
    this.playing = true;
    this.forceSnap = true;
    this.autoUnits.clear();
    def.processes.forEach((p, i) => {
      this.procIndex.set(p.id, i);
      for (const s of p.stages) {
        if (s.unit) this.stageUnit.set(`${p.id}.${s.id}`, s.unit);
        if (s.unit && s.automated) this.autoUnits.add(s.unit);
      }
    });

    this.drawBuilding();
    this.buildPeople();
    this.ring = this.add.graphics().setDepth(60);
    this.daylight = this.add.rectangle(0, 0, this.b.width, this.b.height, 0x0a1030, 0).setOrigin(0).setDepth(900);
    this.fit();
    this.onModel?.();
  }

  get areaNames(): string[] {
    return this.b?.areas.map((a) => a.name) ?? [];
  }

  /** Cambia la disposición de las áreas en la planta (vertical u horizontal) sin perder el momento ni la selección. */
  setOrientation(o: Orientation) {
    if (o === this.orientation) return;
    this.orientation = o;
    if (!this.def || !this.result) return;
    const { simT, playing, selected } = this;
    this.setModel(this.def, this.result);
    this.simT = simT;
    this.lastT = simT;
    this.playing = playing;
    this.forceSnap = true;
    this.selected = selected;
  }

  fit() {
    if (!this.b) return;
    const cam = this.cameras.main;
    const z = Math.min(cam.width / this.b.width, cam.height / this.b.height, 1.3);
    cam.setZoom(z);
    cam.centerOn(this.b.width / 2, this.b.height / 2);
  }

  /** Acerca la cámara a un área (o a toda la planta si index < 0). */
  focusArea(index: number) {
    if (!this.b) return;
    if (index < 0) return this.fit();
    const f = this.b.areas[index];
    const cam = this.cameras.main;
    const horizontal = this.b.orientation === 'horizontal';
    const z = Math.min(cam.width / (f.w + (horizontal ? 130 : 190)), cam.height / (f.h + (horizontal ? 190 : 90)), 2.4);
    cam.pan(f.x + f.w / 2 - (horizontal ? 0 : 40), f.y + f.h / 2 - (horizontal ? 30 : 0), 500, 'Sine.easeInOut', true);
    cam.zoomTo(z, 500);
  }

  seek(t: number) {
    this.simT = Phaser.Math.Clamp(t, 0, this.horizon);
  }

  select(id: string | undefined, focus = false) {
    this.selected = id;
    this.onSelect?.(id);
    if (id && focus && this.b) {
      const d = this.b.personDesk.get(id)!.desk;
      this.cameras.main.pan(d.x, d.y, 450, 'Sine.easeInOut', true);
      this.cameras.main.zoomTo(1.6, 450);
    }
  }

  private drawBuilding() {
    const b = this.b!;
    const horizontal = b.orientation === 'horizontal';
    const g = this.add.graphics().setDepth(1);

    // la planta (empresa): el contorno que contiene todas las áreas
    const P = b.planta;
    g.fillStyle(0x07090d, 1);
    g.fillRoundedRect(P.x - 4, P.y - 4, P.w + 8, P.h + 8, 22);
    g.fillStyle(0x0f131b, 1);
    g.fillRoundedRect(P.x, P.y, P.w, P.h, 18);
    g.lineStyle(2, 0x2f3b57, 1);
    g.strokeRoundedRect(P.x, P.y, P.w, P.h, 18);
    const tx = horizontal ? P.x + 76 : P.x + 20;
    const ty = horizontal ? P.y + 8 : P.y + 14;
    const tag = this.add.text(tx, ty + 2, 'PLANTA', TXT(10, '#9ab4e8', '700')).setDepth(3);
    this.add.text(tx + tag.width + 10, ty - 2, P.name, TXT(17, '#f2f5fc', '700')).setDepth(3);

    // pasillo principal que une las áreas
    const L = b.link;
    g.fillStyle(0x07090d, 1);
    g.fillRoundedRect(L.x - 4, L.y - 4, L.w + 8, L.h + 8, 10);
    g.fillStyle(0x222a3b, 1);
    g.fillRoundedRect(L.x, L.y, L.w, L.h, 7);
    g.lineStyle(1, 0xffffff, 0.07);
    if (horizontal) for (let x = L.x; x < L.x + L.w; x += 9) g.lineBetween(x, L.y, x, L.y + L.h);
    else for (let y = L.y; y < L.y + L.h; y += 9) g.lineBetween(L.x, y, L.x + L.w, y);
    this.add.text(b.entrance.x, b.entrance.y + 24, 'ENTRADA', TXT(9, '#8f9bb8', '700')).setOrigin(0.5).setDepth(2);

    b.areas.forEach((f, fi) => {
      const color = AREA_COLORS[fi % AREA_COLORS.length];
      this.areaOf.set(f.id, color);

      // zona del área (con el color del área) + su pasillo
      g.fillStyle(0x07090d, 1);
      g.fillRoundedRect(f.x - 7, f.y - 7, f.w + 14, f.h + 14, 14);
      g.fillStyle(mix(0x151a25, color, 0.07), 1);
      g.fillRoundedRect(f.x - 2, f.y - 2, f.w + 4, f.h + 4, 11);
      g.lineStyle(2, color, 0.55);
      g.strokeRoundedRect(f.x - 5, f.y - 5, f.w + 10, f.h + 10, 13);
      g.fillStyle(0x1d2432, 1);
      g.fillRect(f.corridor.x, f.corridor.y, f.corridor.w, f.corridor.h);
      g.lineStyle(2, 0xffffff, 0.08);
      if (horizontal) for (let y = f.corridor.y; y < f.corridor.y + f.corridor.h; y += 22) g.lineBetween(f.corridorC, y, f.corridorC, y + 11);
      else for (let x = f.x; x < f.x + f.w; x += 22) g.lineBetween(x, f.corridorC, x + 11, f.corridorC);

      const lx = horizontal ? f.rooms[0].x : f.x + 2;
      const label = this.add
        .text(lx, f.y - 28, 'ÁREA', TXT(10, '#' + color.toString(16).padStart(6, '0'), '700'))
        .setDepth(3);
      this.add.text(lx + label.width + 8, f.y - 31, f.name, TXT(14, '#eef2fb', '700')).setDepth(3);

      for (const r of f.rooms) this.buildRoom(g, r, color);
      this.buildCommon(g, f.common, color);
    });
  }

  private door(g: Phaser.GameObjects.Graphics, p: Pt, side: DoorSide) {
    g.fillStyle(0xb98856, 1);
    if (side === 'bottom') g.fillRoundedRect(p.x - 16, p.y - 4, 32, 8, 3);
    else g.fillRoundedRect(p.x - 4, p.y - 16, 8, 32, 3);
  }

  private plant(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(x, y + 8, 16, 5);
    g.fillStyle(0x8a5a3a, 1);
    g.fillRoundedRect(x - 5, y, 10, 8, 2);
    g.fillStyle(0x3f9e5e, 1);
    g.fillCircle(x - 4, y - 3, 5);
    g.fillCircle(x + 4, y - 3, 5);
    g.fillStyle(0x56bd78, 1);
    g.fillCircle(x, y - 7, 5.5);
  }

  private desk(g: Phaser.GameObjects.Graphics, x: number, y: number, seat: Pt, color: number, responsable: boolean) {
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(x - 25, y - 12, 50, 32, 6);
    g.fillStyle(0x8a6238, 1);
    g.fillRoundedRect(x - 24, y - 15, 48, 31, 6);
    g.fillStyle(0xb98856, 1);
    g.fillRoundedRect(x - 24, y - 15, 48, 26, 6);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x - 22, y - 13, 44, 4, 3);
    // monitor
    g.fillStyle(0x131824, 1);
    g.fillRoundedRect(x - 10, y - 13, 20, 13, 2.5);
    g.fillStyle(0x7fe3b4, 0.95);
    g.fillRoundedRect(x - 8.5, y - 11.5, 17, 10, 1.5);
    g.fillStyle(0xffffff, 0.25);
    g.fillRect(x - 7, y - 10, 8, 2);
    g.fillStyle(0x131824, 1);
    g.fillRect(x - 2, y, 4, 2);
    // teclado
    g.fillStyle(0xe3e8f4, 0.7);
    g.fillRoundedRect(x - 9, y + 3, 18, 5, 1.5);
    if (responsable) {
      // el responsable tiene una placa dorada en su escritorio
      g.fillStyle(0xf5c451, 1);
      g.fillRoundedRect(x - 12, y + 10, 24, 4, 2);
      g.lineStyle(1, 0x8a6a1a, 0.9);
      g.strokeRoundedRect(x - 12, y + 10, 24, 4, 2);
    }
    // silla
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(seat.x, seat.y - 1, 18, 7);
    g.fillStyle(mix(0x2a3144, color, 0.3), 1);
    g.fillCircle(seat.x, seat.y - 6, 8);
    g.fillStyle(0xffffff, 0.12);
    g.fillCircle(seat.x - 2, seat.y - 8, 4);
  }

  private buildRoom(g: Phaser.GameObjects.Graphics, r: RoomL, color: number) {
    const carpet = mix(0x1f2635, color, 0.1);
    g.fillStyle(0x07090d, 1);
    g.fillRoundedRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6, 9);
    g.fillStyle(carpet, 1);
    g.fillRoundedRect(r.x, r.y, r.w, r.h, 7);
    g.lineStyle(1, 0xffffff, 0.035);
    for (let x = r.x + 32; x < r.x + r.w; x += 32) g.lineBetween(x, r.y + 24, x, r.y + r.h - 4);
    for (let y = r.y + 54; y < r.y + r.h; y += 32) g.lineBetween(r.x + 4, y, r.x + r.w - 4, y);
    // cabecera: el área con su color pleno; las subáreas, con el color más apagado
    const isArea = r.kind === 'area';
    g.fillStyle(isArea ? color : mix(color, 0x0c0f16, 0.38), 0.96);
    g.fillRoundedRect(r.x, r.y, r.w, 24, { tl: 7, tr: 7, bl: 0, br: 0 });
    if (!isArea) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(r.x, r.y, 5, 24, { tl: 7, tr: 0, bl: 0, br: 0 });
    }
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(r.x + 2, r.y + 2, r.w - 4, 5, { tl: 5, tr: 5, bl: 0, br: 0 });
    g.lineStyle(1.5, color, 0.3);
    g.strokeRoundedRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 7);
    // puerta
    g.fillStyle(0xb98856, 1);
    this.door(g, r.door, r.doorSide);

    // bandeja de entrada
    const tw = r.inbox.cols * INBOX_STEP + 6;
    const th = r.inbox.rows * INBOX_STEP + 6;
    g.fillStyle(0x0f131c, 0.9);
    g.fillRoundedRect(r.inbox.x - 4, r.inbox.y - 4, tw, th, 6);
    g.lineStyle(1, 0xffffff, 0.08);
    g.strokeRoundedRect(r.inbox.x - 4, r.inbox.y - 4, tw, th, 6);

    for (const d of r.desks) this.desk(g, d.x, d.y, d.seat, color, d.kind === 'responsable');
    if (r.desks.length === 0) {
      this.add
        .text(r.x + 12 + 4, r.y + HEADER_Y, 'Sin personas aún', TXT(10, '#6f7b97', '600'))
        .setDepth(3);
    }
    this.plant(g, r.x + 14, r.y + r.h - 16);
    if (r.art || r.look !== 'oficina') this.facilityProps(g, r);
    this.drawDecor(r);
    const autoRoom = [...this.autoUnits].some((u) => this.b!.unitRoom(u)?.id === r.id);
    if (autoRoom) {
      g.fillStyle(0x0f131c, 0.95);
      g.fillRoundedRect(r.x + 32, r.y + r.h - 28, 100, 22, 6);
      g.lineStyle(1, 0x5aa9ff, 0.5);
      g.strokeRoundedRect(r.x + 32, r.y + r.h - 28, 100, 22, 6);
      this.add.text(r.x + 36, r.y + r.h - 40, '⚙ Sistema', TXT(9, '#8cc4ff', '700')).setDepth(3);
    }

    const icon = r.art || r.look !== 'oficina' ? `${r.icon} ` : '';
    const full = icon + (r.kind === 'subarea' && r.path.length > 2 ? r.path.slice(-2).join(' › ') : r.name);
    const maxChars = Math.max(4, Math.floor((r.w - 62) / 6.6));
    const title = full.length > maxChars ? `${full.slice(0, maxChars - 1)}…` : full;
    this.add.text(r.x + (isArea ? 8 : 12), r.y + 5, title, TXT(11, isArea ? '#0c0f16' : '#f2f5fc', '700')).setDepth(3);
    const stats = this.add
      .text(r.x + r.w - 6, r.y + 7, '', TXT(9, isArea ? '#0c0f16' : '#dfe6f7', '700'))
      .setOrigin(1, 0)
      .setDepth(3);
    const overflow = this.add
      .text(r.inbox.x + r.inbox.cols * INBOX_STEP - 2, r.y + r.h - 6, '', TXT(10, '#ffd479', '700'))
      .setOrigin(1, 1)
      .setDepth(12);
    const big = this.add
      .text(r.x + r.w / 2, r.y + r.h / 2 + 10, '0', TXT(70, '#ffffff', '700'))
      .setOrigin(0.5)
      .setDepth(40)
      .setVisible(false);
    const overlay = this.add.rectangle(r.x, r.y, r.w, r.h, 0xff3030, 0).setOrigin(0).setDepth(4);
    const bar = this.add.graphics().setDepth(5);
    this.roomViews.set(r.id, { room: r, stats, overflow, big, overlay, bar, people: r.desks.map((d) => d.personId) });
  }

  /** Equipamiento de las instalaciones que no son oficina: ocupa la franja libre bajo los escritorios. */
  /** Pinta una forma (rectángulo, elipse, triángulo o línea) de una ilustración; `k` es la escala. */
  private paintShape(gg: Phaser.GameObjects.Graphics, it: ArtItem, ox: number, oy: number, k: number) {
    if (it.t === 'emoji') return;
    const h = it.c.slice(1);
    const c = parseInt(h.length <= 4 ? h.split('').slice(0, 3).map((d) => d + d).join('') : h.slice(0, 6), 16);
    gg.fillStyle(c, 1);
    if (it.t === 'rect') {
      if (it.r) gg.fillRoundedRect(ox + it.x * k, oy + it.y * k, it.w * k, it.h * k, Math.min(it.r * k, (it.w * k) / 2, (it.h * k) / 2));
      else gg.fillRect(ox + it.x * k, oy + it.y * k, it.w * k, it.h * k);
    } else if (it.t === 'ellipse') gg.fillEllipse(ox + (it.x + it.w / 2) * k, oy + (it.y + it.h / 2) * k, it.w * k, it.h * k);
    else if (it.t === 'tri') gg.fillTriangle(ox + (it.x + it.w / 2) * k, oy + it.y * k, ox + (it.x + it.w) * k, oy + (it.y + it.h) * k, ox + it.x * k, oy + (it.y + it.h) * k);
    else {
      gg.lineStyle(Math.max(1, it.lw * k), c, 1);
      gg.lineBetween(ox + it.x * k, oy + it.y * k, ox + it.x2 * k, oy + it.y2 * k);
    }
  }

  /** Objetos del catálogo (mesas, sillas, puertas, plantas…) que el usuario colocó en la sala. */
  private drawDecor(r: RoomL) {
    r.decor.forEach((it, i) => {
      const d = DECOR[it.k];
      if (!d || it.x < 0 || it.y < 0 || it.x > r.w || it.y > r.h) return;
      const gg = this.add.graphics().setDepth(2 + i * 0.001);
      for (const a of d.art) this.paintShape(gg, a, -d.w / 2, -d.h / 2, 1);
      gg.setPosition(r.x + it.x, r.y + it.y).setRotation((it.rot * Math.PI) / 180);
      if (it.flip) gg.setScale(-1, 1);
    });
  }

  /** Ilustración propia del tipo de instalación: elementos dibujados por el usuario o una imagen subida. */
  private drawArt(r: RoomL) {
    const art = r.art!;
    const x0 = r.x + 10;
    const pw = r.inbox.x - 10 - x0;
    const bandH = r.propsH - 10;
    const top = r.y + r.h - 30 - bandH;
    const k = Math.min(pw / ART_W, bandH / ART_H);
    const ox = x0 + (pw - ART_W * k) / 2;
    const oy = top + (bandH - ART_H * k) / 2;
    const col = (c: string) => {
      const h = c.slice(1);
      return parseInt(h.length <= 4 ? h.split('').slice(0, 3).map((d) => d + d).join('') : h.slice(0, 6), 16);
    };
    if (art.image) {
      const key = `art:${r.facility}:${art.image.length}`;
      const place = () => {
        const img = this.add.image(0, 0, key).setDepth(2.2).setOrigin(0.5);
        const s = Math.min(pw / img.width, bandH / img.height);
        img.setScale(s).setPosition(x0 + pw / 2, top + bandH / 2);
      };
      if (this.textures.exists(key)) place();
      else {
        this.textures.once(`addtexture-${key}`, place);
        this.textures.addBase64(key, art.image);
      }
      return;
    }
    (art.items ?? []).forEach((it, i) => {
      const depth = 2.2 + i * 0.001;
      if (it.t === 'emoji') {
        this.add.text(ox + it.x * k, oy + it.y * k, it.ch, { fontSize: `${Math.max(6, it.s * k)}px`, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif', resolution: 3 }).setDepth(depth);
        return;
      }
      const gg = this.add.graphics().setDepth(depth);
      gg.fillStyle(col(it.c), 1);
      if (it.t === 'rect') {
        if (it.r) gg.fillRoundedRect(ox + it.x * k, oy + it.y * k, it.w * k, it.h * k, Math.min(it.r * k, (it.w * k) / 2, (it.h * k) / 2));
        else gg.fillRect(ox + it.x * k, oy + it.y * k, it.w * k, it.h * k);
      } else if (it.t === 'ellipse') gg.fillEllipse(ox + (it.x + it.w / 2) * k, oy + (it.y + it.h / 2) * k, it.w * k, it.h * k);
      else if (it.t === 'tri') gg.fillTriangle(ox + (it.x + it.w / 2) * k, oy + it.y * k, ox + (it.x + it.w) * k, oy + (it.y + it.h) * k, ox + it.x * k, oy + (it.y + it.h) * k);
      else {
        gg.lineStyle(Math.max(1, it.lw * k), col(it.c), 1);
        gg.lineBetween(ox + it.x * k, oy + it.y * k, ox + it.x2 * k, oy + it.y2 * k);
      }
    });
  }

  private facilityProps(g: Phaser.GameObjects.Graphics, r: RoomL) {
    if (r.art) return this.drawArt(r);
    const x0 = r.x + 10;
    const x1 = r.inbox.x - 10;
    const top = r.y + r.h - 60;
    const hgt = 30;
    const pw = x1 - x0;
    const blink = (x: number, y: number, c: number, period = 900) => {
      const dot = this.add.circle(x, y, 2.2, c, 1).setDepth(3);
      this.tweens.add({ targets: dot, alpha: 0.15, duration: period, yoyo: true, repeat: -1 });
    };
    const crate = (x: number, y: number, w: number, h: number, c: number) => {
      g.fillStyle(0x000000, 0.25);
      g.fillRect(x + 1, y + h - 1, w, 2);
      g.fillStyle(c, 1);
      g.fillRect(x, y, w, h);
      g.lineStyle(1, 0x000000, 0.35);
      g.strokeRect(x, y, w, h);
      g.fillStyle(0xffffff, 0.22);
      g.fillRect(x + 1, y + 1, w - 2, 2);
    };
    const palette = [0xc98f4c, 0x9c7a4d, 0xd6a35f, 0x5d8fc9, 0x7aa86a];
    const pallet = (x: number, y: number, boxes: number) => {
      g.fillStyle(0x7a5a34, 1);
      g.fillRect(x, y + 24, 30, 5);
      for (let i = 0; i < boxes; i++) crate(x + 2 + (i % 2) * 13, y + 12 - Math.floor(i / 2) * 11, 12, 11, palette[(i + Math.floor(x)) % palette.length]);
    };
    const truck = (x: number, y: number, body = 0xe8edf7) => {
      g.fillStyle(0x000000, 0.28);
      g.fillEllipse(x + 30, y + 30, 66, 6);
      g.fillStyle(body, 1);
      g.fillRoundedRect(x, y + 2, 42, 24, 3);
      g.fillStyle(0xc9d2e6, 1);
      g.fillRect(x, y + 20, 42, 3);
      g.fillStyle(0xf5c451, 1);
      g.fillRoundedRect(x + 42, y + 10, 18, 16, { tl: 2, tr: 7, bl: 0, br: 0 });
      g.fillStyle(0x9ad1ff, 1);
      g.fillRect(x + 50, y + 13, 8, 7);
      g.fillStyle(0x131824, 1);
      g.fillCircle(x + 10, y + 27, 4.5);
      g.fillCircle(x + 50, y + 27, 4.5);
      g.fillStyle(0x9aa6c0, 1);
      g.fillCircle(x + 10, y + 27, 1.8);
      g.fillCircle(x + 50, y + 27, 1.8);
    };
    const hazard = (x: number, y: number, w: number) => {
      g.fillStyle(0x1b1f2a, 1);
      g.fillRect(x, y, w, 5);
      g.fillStyle(0xf5c451, 1);
      for (let i = 0; i < w; i += 12) g.fillTriangle(x + i, y + 5, x + i + 6, y, x + i + 12, y);
    };

    switch (r.look) {
      case 'bodega': {
        const rack = 36;
        const n = Math.max(1, Math.floor(pw / (rack + 4)));
        for (let i = 0; i < n; i++) {
          const x = x0 + i * (rack + 4);
          g.fillStyle(0x2d3d5e, 1);
          g.fillRect(x, top, 3, hgt + 2);
          g.fillRect(x + rack - 3, top, 3, hgt + 2);
          g.fillStyle(0xe0883a, 1);
          g.fillRect(x, top + 14, rack, 3);
          g.fillRect(x, top + hgt - 1, rack, 3);
          crate(x + 4, top + 3, 12, 11, palette[i % palette.length]);
          crate(x + 19, top + 4, 12, 10, palette[(i + 2) % palette.length]);
          crate(x + 5, top + 17, 14, 12, palette[(i + 1) % palette.length]);
          if (i % 2 === 0) crate(x + 22, top + 19, 10, 10, palette[(i + 3) % palette.length]);
        }
        break;
      }
      case 'ingreso': {
        hazard(x0, top + hgt - 2, pw);
        truck(x0, top - 2);
        if (pw > 110) pallet(x0 + 70, top, 3);
        if (pw > 150) pallet(x0 + 104, top, 2);
        blink(x0 + pw - 4, top + 4, 0x4cd98a, 1200);
        break;
      }
      case 'despacho': {
        g.fillStyle(0x3a4560, 1);
        g.fillRoundedRect(x0, top, 38, hgt, 3);
        g.fillStyle(0x8793b0, 1);
        for (let y = top + 3; y < top + hgt - 2; y += 4) g.fillRect(x0 + 3, y, 32, 2);
        pallet(x0 + 46, top, 4);
        if (pw > 120) pallet(x0 + 80, top, 3);
        hazard(x0, top + hgt - 2, pw);
        blink(x0 + 34, top + 4, 0xff8a3d, 700);
        break;
      }
      case 'seguridad': {
        g.fillStyle(0x0b0e16, 1);
        g.fillRoundedRect(x0, top, Math.min(pw, 78), 22, 3);
        for (let i = 0; i < 3; i++) {
          g.fillStyle(0x1b2c3d, 1);
          g.fillRect(x0 + 4 + i * 24, top + 3, 21, 16);
          g.fillStyle(0x4aa889, 0.65);
          g.fillRect(x0 + 6 + i * 24, top + 10 + (i % 2) * 2, 17, 2);
          g.fillStyle(0x7fe3b4, 0.4);
          g.fillRect(x0 + 6 + i * 24, top + 5, 6, 3);
        }
        blink(x0 + 5, top + 3, 0xff4d4d, 650);
        // torniquete y escudo
        const tx = x0 + Math.min(pw, 78) + 14;
        if (tx + 30 < x1) {
          g.fillStyle(0x9aa6c0, 1);
          g.fillRect(tx, top + 10, 4, 18);
          g.fillRect(tx + 24, top + 10, 4, 18);
          g.fillStyle(0xf5c451, 1);
          g.fillRect(tx + 4, top + 14, 20, 3);
        }
        break;
      }
      case 'mantenimiento': {
        g.fillStyle(0x6b4f30, 1);
        g.fillRoundedRect(x0, top + 10, Math.min(pw, 70), 8, 2);
        g.fillStyle(0x3a4560, 1);
        g.fillRect(x0 + 3, top + 18, 4, 12);
        g.fillRect(x0 + Math.min(pw, 70) - 7, top + 18, 4, 12);
        g.fillStyle(0xc0392b, 1); // caja de herramientas
        g.fillRoundedRect(x0 + 8, top + 3, 22, 8, 2);
        g.fillStyle(0xffffff, 0.3);
        g.fillRect(x0 + 10, top + 5, 18, 2);
        // tablero de herramientas
        const bx = x0 + Math.min(pw, 70) + 8;
        if (bx + 40 < x1) {
          g.fillStyle(0x2b3550, 1);
          g.fillRoundedRect(bx, top, 40, 26, 3);
          g.lineStyle(2.4, 0xc9d2e6, 1);
          g.lineBetween(bx + 7, top + 5, bx + 7, top + 21);
          g.lineBetween(bx + 16, top + 5, bx + 20, top + 21);
          g.lineStyle(2.4, 0xf5c451, 1);
          g.lineBetween(bx + 28, top + 6, bx + 34, top + 20);
        }
        blink(x0 + Math.min(pw, 70) - 6, top + 7, 0xffb347, 500);
        break;
      }
      case 'transporte': {
        truck(x0, top - 2, 0x8cc4ff);
        if (pw > 130) truck(x0 + 68, top - 2, 0xffd479);
        hazard(x0, top + hgt - 2, pw);
        break;
      }
      default:
    }
  }

  private buildCommon(g: Phaser.GameObjects.Graphics, c: CommonL, color: number) {
    g.fillStyle(0x07090d, 1);
    g.fillRoundedRect(c.x - 3, c.y - 3, c.w + 6, c.h + 6, 9);
    g.fillStyle(0x3b3125, 1);
    g.fillRoundedRect(c.x, c.y, c.w, c.h, 7);
    g.lineStyle(1, 0x000000, 0.2);
    for (let x = c.x + 22; x < c.x + c.w; x += 22) g.lineBetween(x, c.y + 24, x, c.y + c.h - 2);
    g.fillStyle(0x7a5f3a, 1);
    g.fillRoundedRect(c.x, c.y, c.w, 24, { tl: 7, tr: 7, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.14);
    g.fillRoundedRect(c.x + 2, c.y + 2, c.w - 4, 5, { tl: 5, tr: 5, bl: 0, br: 0 });
    g.fillStyle(0xb98856, 1);
    this.door(g, c.door, c.doorSide);
    // sofá y mesa
    g.fillStyle(mix(0x3a3550, color, 0.35), 1);
    g.fillRoundedRect(c.x + 10, c.y + c.h - 30, c.w - 20, 16, 7);
    g.fillStyle(0xffffff, 0.1);
    g.fillRoundedRect(c.x + 12, c.y + c.h - 28, c.w - 24, 4, 3);
    g.fillStyle(0x000000, 0.25);
    g.fillEllipse(c.x + c.w / 2, c.y + c.h - 56, 42, 14);
    g.fillStyle(0xcfa56a, 1);
    g.fillEllipse(c.x + c.w / 2, c.y + c.h - 59, 40, 14);
    this.plant(g, c.x + c.w - 14, c.y + 44);
    this.add.text(c.x + 8, c.y + 5, 'Sala común', TXT(11, '#f6ead2', '700')).setDepth(3);
  }

  private buildPeople() {
    const b = this.b!;
    const def = this.def!;
    def.people.forEach((p, i) => {
      const color = this.areaOf.get(b.areas[b.personArea.get(p.id)!].id) ?? 0x5aa9ff;
      const responsable = p.kind === 'responsable';
      const skin = SKIN[i % SKIN.length];
      const hair = HAIR[(i * 3) % HAIR.length];
      const dark = mix(color, 0x000000, 0.3);

      const shadow = this.add.ellipse(0, 1, 20, 7, 0x000000, 0.3);
      const legL = this.add.rectangle(-3.6, -7, 4.2, 8, 0x232a3b).setOrigin(0.5, 0);
      const legR = this.add.rectangle(3.6, -7, 4.2, 8, 0x232a3b).setOrigin(0.5, 0);
      const g = this.add.graphics();
      // brazos
      g.fillStyle(dark, 1);
      g.fillRoundedRect(-10, -22, 4, 11, 2);
      g.fillRoundedRect(6, -22, 4, 11, 2);
      g.fillStyle(skin, 1);
      g.fillCircle(-8, -10.5, 2.2);
      g.fillCircle(8, -10.5, 2.2);
      // torso
      g.fillStyle(color, 1);
      g.fillRoundedRect(-7.5, -24, 15, 17, 5);
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(-5.5, -23, 11, 4, 2);
      if (responsable) {
        // el responsable lleva un hombro dorado y una insignia en el pecho
        g.fillStyle(0xf5c451, 1);
        g.fillRoundedRect(-7.5, -24, 15, 3, 2);
        g.fillCircle(3.5, -15, 3);
        g.lineStyle(1, 0x8a6a1a, 1);
        g.strokeCircle(3.5, -15, 3);
      }
      // cabeza
      g.fillStyle(skin, 1);
      g.fillCircle(0, -30, 7);
      g.fillStyle(hair, 1);
      g.beginPath();
      g.slice(0, -30.5, 7.3, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
      g.fillPath();
      g.fillStyle(0x1a1410, 1);
      g.fillCircle(-2.4, -29.5, 1);
      g.fillCircle(2.4, -29.5, 1);
      const art = this.add.container(0, 0, [shadow, legL, legR, g]);

      const dot = this.add.circle(0, -43, 3.6, DOT.idle).setStrokeStyle(1.5, 0x0b0e14);
      const tag = this.add
        .text(0, -54, '', TXT(9, '#ffffff', '700'))
        .setOrigin(0.5)
        .setBackgroundColor('#0b0e14dd')
        .setPadding(4, 1, 4, 1);
      const first = (p.name ?? p.id).split(' ')[0];
      const name = this.add
        .text(0, 6, responsable ? `★ ${first}` : first, TXT(9, responsable ? '#ffd98a' : '#cdd6ee', '600'))
        .setOrigin(0.5, 0);
      const hit = this.add.rectangle(0, -18, 24, 44, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.select(p.id));
      const container = this.add
        .container(b.entrance.x, b.entrance.y, [art, dot, tag, name, hit])
        .setDepth(20)
        .setVisible(false);
      this.persons.set(p.id, {
        id: p.id,
        mover: new Mover(b.entrance.x, b.entrance.y),
        container,
        art,
        legL,
        legR,
        dot,
        tag,
        name,
        visible: false,
        facing: 1,
      });
    });
  }

  // ---------- bucle ----------

  update(time: number, delta: number) {
    const rp = this.rp;
    const b = this.b;
    if (!rp || !b) return;
    const dt = Math.min(delta, 100) / 1000;

    if (this.playing) {
      this.simT += dt * this.speed;
      if (this.simT >= this.horizon) {
        this.simT = this.horizon;
        this.playing = false;
      }
    }
    // saltos grandes (arrastrar la línea de tiempo, reiniciar): sin animar el camino
    const jumped = this.forceSnap || this.simT < this.lastT || this.simT - this.lastT > 90;
    this.forceSnap = false;
    this.lastT = this.simT;
    rp.advanceTo(this.simT);

    const walk = Math.min(1400, 100 + this.speed * 3);
    this.updatePersons(time, dt, walk, jumped);
    const queued = this.updateCases(time, dt, walk, jumped);
    this.updateRooms(time, queued);
    this.updateDaylight();
    this.drawRing(time);

    let present = 0;
    for (const v of rp.persons.values()) if (v.state !== 'off' && v.state !== 'absent') present++;
    const sel = this.selected ? rp.persons.get(this.selected) : undefined;
    this.onHud?.({
      t: this.simT,
      playing: this.playing,
      counters: rp.counters,
      present,
      total: rp.persons.size,
      queued: [...queued.values()].reduce((s, l) => s + l.length, 0),
      selected: this.selected,
      selectedState: sel?.state,
      selectedCase: sel?.caseId,
    });
  }

  /** Al alejar la cámara los iconos crecen para seguir siendo legibles. */
  private iconScale(max: number): number {
    return Phaser.Math.Clamp(0.78 / this.cameras.main.zoom, 1, max);
  }

  private updatePersons(time: number, dt: number, walk: number, jumped: boolean) {
    const rp = this.rp!;
    const b = this.b!;
    const zoom = this.cameras.main.zoom;
    const semantic = zoom < SEMANTIC_ZOOM;
    const scale = this.iconScale(2.3);
    for (const pv of this.persons.values()) {
      const state = rp.persons.get(pv.id)!.state;
      let dest: Dest;
      let key: string;
      switch (state) {
        case 'break':
        case 'meeting':
          dest = commonDest(b, pv.id);
          key = 'common';
          break;
        case 'off':
          dest = b.entrance;
          key = 'exit';
          break;
        default:
          dest = deskDest(b, pv.id);
          key = 'desk';
      }

      if (state === 'off') {
        if (!pv.visible) {
          pv.mover.snap(b.entrance);
          pv.mover.key = 'exit';
        } else if (jumped) {
          pv.visible = false;
          pv.mover.snap(b.entrance);
          pv.mover.key = 'exit';
        } else {
          pv.mover.setDest(key, () => route(b, pv.mover, dest));
          if (!pv.mover.path.length) pv.visible = false;
        }
      } else {
        if (!pv.visible) {
          pv.visible = true;
          if (jumped || state === 'absent') pv.mover.snap(dest);
          else pv.mover.snap(b.entrance);
          pv.mover.key = '';
        }
        if (jumped || state === 'absent') {
          pv.mover.snap(dest);
          pv.mover.key = key;
        } else pv.mover.setDest(key, () => route(b, pv.mover, dest));
      }

      const prevX = pv.mover.x;
      const moving = pv.mover.step(dt, walk);
      if (moving) pv.facing = pv.mover.x > prevX + 0.01 ? 1 : pv.mover.x < prevX - 0.01 ? -1 : pv.facing;
      pv.container.setPosition(pv.mover.x, pv.mover.y);
      pv.container.setDepth(20 + pv.mover.y / 1000);
      pv.container.setScale(scale);
      pv.container.setVisible(pv.visible && !semantic);
      pv.container.setAlpha(state === 'absent' ? 0.32 : 1);

      // animación: caminar (piernas + rebote), teclear (cabeceo leve)
      const swing = moving ? Math.sin(time / 75) : 0;
      pv.legL.y = -7 + swing * 2.2;
      pv.legR.y = -7 - swing * 2.2;
      pv.art.y = moving ? -Math.abs(swing) * 1.3 : state === 'working' ? Math.sin(time / 190 + pv.mover.x) * 0.5 : 0;
      pv.art.scaleX = pv.facing;
      pv.dot.setFillStyle(DOT[state] || DOT.idle);
      pv.dot.setVisible(!moving);
      const tagText = state === 'break' ? 'pausa' : state === 'meeting' ? 'reunión' : state === 'absent' ? 'ausente' : '';
      pv.tag.setText(tagText).setVisible(tagText !== '');
      pv.name.setVisible(zoom * scale > 0.8);
    }
  }

  /** Posiciona las cajas (casos) y devuelve la cola de cada sala. */
  private updateCases(time: number, dt: number, walk: number, jumped: boolean): Map<string, OrgCaseView[]> {
    const rp = this.rp!;
    const b = this.b!;
    const semantic = this.cameras.main.zoom < SEMANTIC_ZOOM;
    const blink = Math.floor(time / 280) % 2 === 0;
    const crateScale = 0.74 * this.iconScale(1.5);
    const queued = new Map<string, OrgCaseView[]>();
    const live = new Set<string>();
    const place = new Map<string, { key: string; dest: Dest } | null>();

    for (const c of rp.cases.values()) {
      if (c.status === 'done' || !c.stage) continue;
      const unit = this.stageUnit.get(`${c.process}.${c.stage}`);
      const room = unit ? b.unitRoom(unit) : undefined;
      if (c.status === 'queued') {
        if (!room) continue;
        const l = queued.get(room.id) ?? [];
        l.push(c);
        queued.set(room.id, l);
      } else if (c.status === 'working' && c.person === AUTO_ACTOR) {
        // etapa automatizada: la caja se queda en el «bay» del sistema de la sala
        if (!room) continue;
        let h = 0;
        for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        place.set(c.id, { key: `auto:${room.id}:${h % 6}`, dest: { x: room.x + 38 + (h % 6) * 15, y: room.y + room.h - 17, area: room.area, zone: room.id } });
      } else if ((c.status === 'working' || c.status === 'paused') && c.person) {
        const { room: pr, desk } = b.personDesk.get(c.person)!;
        place.set(c.id, { key: `desk:${c.person}`, dest: { x: desk.x + 15, y: desk.y - 3, area: pr.area, zone: pr.id } });
      } else if (c.status === 'transit' && c.toUnit) {
        const to = b.unitRoom(c.toUnit);
        if (to) {
          const s = inboxSlot(to, 0);
          place.set(c.id, { key: `transit:${to.id}`, dest: { x: s.x, y: s.y, area: to.area, zone: to.id } });
        } else place.set(c.id, null);
      } else place.set(c.id, null);
      live.add(c.id);
    }

    const overflow = new Set<string>();
    for (const [roomId, list] of queued) {
      const room = b.rooms.get(roomId)!;
      list.sort((x, y) => x.enteredAt - y.enteredAt || (x.id < y.id ? -1 : 1));
      const cap = room.inbox.cols * room.inbox.rows;
      list.forEach((c, i) => {
        const slot = Math.min(i, cap - 1);
        const s = inboxSlot(room, slot);
        place.set(c.id, { key: `inbox:${roomId}:${slot}`, dest: { x: s.x, y: s.y, area: room.area, zone: roomId } });
        if (i >= cap - 1) overflow.add(c.id);
        live.add(c.id);
      });
    }

    for (const id of live) {
      const c = rp.cases.get(id)!;
      const p = place.get(id);
      let cv = this.crates.get(id);
      if (!cv) {
        const start = p && jumped ? p.dest : b.entrance;
        const img = this.add.image(0, 0, `crate${(this.procIndex.get(c.process) ?? 0) % PROC_COLORS.length}`);
        const alert = this.add.circle(8, -6, 4, 0xff3b30).setStrokeStyle(1.5, 0xffffff).setVisible(false);
        const box = this.add.container(start.x, start.y, [img, alert]).setDepth(30);
        cv = { mover: new Mover(start.x, start.y), box, alert, img };
        this.crates.set(id, cv);
      }
      if (p) {
        if (jumped) {
          cv.mover.snap(p.dest);
          cv.mover.key = p.key;
        } else cv.mover.setDest(p.key, () => route(b, cv!.mover, p.dest));
      }
      cv.mover.step(dt, walk);
      cv.box.setPosition(cv.mover.x, cv.mover.y);
      cv.box.setScale(crateScale);
      cv.img.setAlpha(c.status === 'paused' ? 0.55 : 1);
      cv.alert.setVisible(c.breached && blink);
      cv.box.setVisible(!semantic && !overflow.has(id));
    }
    for (const [id, cv] of this.crates) {
      if (!live.has(id)) {
        cv.box.destroy();
        this.crates.delete(id);
      }
    }
    return queued;
  }

  private updateRooms(time: number, queued: Map<string, OrgCaseView[]>) {
    const rp = this.rp!;
    const semantic = this.cameras.main.zoom < SEMANTIC_ZOOM;
    for (const rv of this.roomViews.values()) {
      const r = rv.room;
      const q = queued.get(r.id)?.length ?? 0;
      const total = rv.people.length;
      const here = rv.people.filter((id) => {
        const s = rp.persons.get(id)!.state;
        return s === 'idle' || s === 'working';
      }).length;
      const cap = r.inbox.cols * r.inbox.rows;
      rv.stats.setText(`${here}/${total} · c${q}`);
      rv.overflow.setText(q >= cap ? `+${q - cap + 1}` : '');
      rv.big.setText(String(q)).setVisible(semantic);

      const load = q / Math.max(2, total * 1.5);
      const color = load < 0.7 ? 0x5ed08a : load <= 1 ? 0xffb547 : 0xff4d3d;
      rv.bar.clear();
      const filled = Math.min(10, Math.round(load * 10));
      const segW = (r.w - 14) / 10;
      for (let i = 0; i < 10; i++) {
        rv.bar.fillStyle(i < filled ? color : 0x2b3346, 1);
        rv.bar.fillRoundedRect(r.x + 7 + i * segW, r.y + 26, segW - 2.5, 4, 2);
      }
      let alpha = 0;
      let tint = 0xffb547;
      if (load > 1) {
        tint = 0xff3b30;
        alpha = 0.13 + 0.07 * Math.sin(time / 180);
      } else if (load >= 0.7) alpha = ((load - 0.7) / 0.3) * 0.11;
      rv.overlay.setFillStyle(tint, alpha);
    }
  }

  private updateDaylight() {
    if (!this.daylight) return;
    const h = (this.simT % DAY) / 60;
    let a = 0;
    if (h < 6 || h >= 21) a = 0.38;
    else if (h < 8) a = 0.38 * (1 - (h - 6) / 2);
    else if (h >= 18) a = 0.38 * ((h - 18) / 3);
    this.daylight.setFillStyle(0x0a1030, a);
  }

  private drawRing(time: number) {
    if (!this.ring) return;
    this.ring.clear();
    if (!this.selected) return;
    const pv = this.persons.get(this.selected);
    if (!pv || !pv.container.visible) return;
    const s = pv.container.scale;
    this.ring.lineStyle(2.5, 0xffd479, 0.65 + 0.35 * Math.sin(time / 200));
    this.ring.strokeEllipse(pv.mover.x, pv.mover.y + 1, 30 * s, 11 * s);
  }
}
