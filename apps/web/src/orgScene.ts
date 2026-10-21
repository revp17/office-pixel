import Phaser from 'phaser';
import {
  OrgReplayer,
  DAY,
  type CompanyDef,
  type OrgCaseView,
  type OrgCounters,
  type OrgSimResult,
  type PersonState,
} from '@office-pixel/sim';
import {
  buildBuilding,
  commonDest,
  deskDest,
  inboxSlot,
  route,
  type BuildingL,
  type Dest,
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

const AREA_COLORS = [0x4aa3ff, 0xffb020, 0xb06ab3, 0x5bc16a, 0xff7a59, 0x3ec6c6];
const PROC_COLORS = [0xe0a43a, 0xe0627a, 0x6ac1e0, 0x9bd65b];
const SKIN = [0xf2c9a0, 0xd9a273, 0xb57a4e, 0x8a5a3a, 0xf6d7b8];
const DOT: Record<PersonState, number> = {
  off: 0x000000,
  idle: 0x8591ad,
  working: 0x4aa3ff,
  break: 0xffb020,
  meeting: 0xb06ab3,
  absent: 0xff5a4a,
};
const SEMANTIC_ZOOM = 0.38;
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function fmtTime(t: number): string {
  const day = Math.floor(t / DAY);
  const m = Math.floor(t % DAY);
  return `Día ${day + 1} · ${WEEKDAYS[day % 7]} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

const TXT = (size: number, color = '#dfe5f3') => ({
  fontFamily: '"Courier New", monospace',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
});

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
  body: Phaser.GameObjects.Graphics;
  dot: Phaser.GameObjects.Rectangle;
  tag: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  visible: boolean;
  facing: number;
}

interface CrateView {
  mover: Mover;
  rect: Phaser.GameObjects.Rectangle;
}

interface RoomView {
  room: RoomL;
  header: Phaser.GameObjects.Text;
  overflow: Phaser.GameObjects.Text;
  big: Phaser.GameObjects.Text;
  overlay: Phaser.GameObjects.Rectangle;
  bar: Phaser.GameObjects.Graphics;
  people: string[];
}

export class OrgScene extends Phaser.Scene {
  onHud?: (h: OrgHud) => void;
  onSelect?: (personId: string | undefined) => void;
  playing = false;
  speed = 30;
  simT = 0;

  private ready = false;
  private pending?: { def: CompanyDef; result: OrgSimResult };
  private def?: CompanyDef;
  private b?: BuildingL;
  private rp?: OrgReplayer;
  private horizon = 0;
  private stageUnit = new Map<string, string>();
  private procIndex = new Map<string, number>();
  private persons = new Map<string, PersonView>();
  private crates = new Map<string, CrateView>();
  private roomViews = new Map<string, RoomView>();
  private areaOf = new Map<string, number>();
  private daylight?: Phaser.GameObjects.Rectangle;
  private ring?: Phaser.GameObjects.Graphics;
  private lastT = 0;
  private forceSnap = true;
  selected?: string;

  constructor() {
    super('org');
  }

  create() {
    const cam = this.cameras.main;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
      cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.12, 3));
    });
    this.scale.on('resize', () => this.fit());
    this.ready = true;
    if (this.pending) this.setModel(this.pending.def, this.pending.result);
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
    this.b = buildBuilding(def);
    this.rp = new OrgReplayer(result.events, def.people.map((p) => p.id));
    this.horizon = result.options.horizonDays * DAY;
    this.simT = 0;
    this.lastT = 0;
    this.playing = true;
    this.forceSnap = true;
    def.processes.forEach((p, i) => {
      this.procIndex.set(p.id, i);
      for (const s of p.stages) if (s.unit) this.stageUnit.set(`${p.id}.${s.id}`, s.unit);
    });

    this.drawBuilding();
    this.buildPeople();
    this.ring = this.add.graphics().setDepth(60);
    this.daylight = this.add
      .rectangle(0, 0, this.b.width, this.b.height, 0x0a1030, 0)
      .setOrigin(0)
      .setDepth(900);
    this.fit();
  }

  fit() {
    if (!this.b) return;
    const cam = this.cameras.main;
    const z = Math.min(cam.width / this.b.width, cam.height / this.b.height, 1.3);
    cam.setZoom(z);
    cam.centerOn(this.b.width / 2, this.b.height / 2);
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
      this.cameras.main.zoomTo(1.4, 450);
    }
  }

  private drawBuilding() {
    const b = this.b!;
    const g = this.add.graphics().setDepth(1);

    // escalera
    const top = b.floors[0].y;
    const bottom = b.floors[b.floors.length - 1].y + b.floors[b.floors.length - 1].h;
    g.fillStyle(0x07080c, 1);
    g.fillRect(b.stairsX - 21, top - 4, 42, bottom - top + 50);
    for (let y = top; y < bottom + 40; y += 8) {
      g.fillStyle(((y - top) / 8) % 2 ? 0x3a4259 : 0x2e3548, 1);
      g.fillRect(b.stairsX - 17, y, 34, 7);
    }
    this.add.text(b.stairsX, bottom + 28, 'ENTRADA', TXT(9, '#8591ad')).setOrigin(0.5).setDepth(2);

    b.floors.forEach((f, fi) => {
      const color = AREA_COLORS[fi % AREA_COLORS.length];
      this.areaOf.set(f.areaId, color);
      // losa y pasillo
      g.fillStyle(0x07080c, 1);
      g.fillRect(f.x - 4, f.y - 4, f.w + 8, f.h + 8);
      g.fillStyle(0x1a1f2b, 1);
      g.fillRect(f.x, f.y, f.w, f.h);
      for (let x = f.x; x < f.x + f.w; x += 20) {
        g.fillStyle(((x - f.x) / 20) % 2 ? 0x2a3144 : 0x252c3e, 1);
        g.fillRect(x, f.y + f.roomsH, 20, f.h - f.roomsH);
      }
      g.fillRect(b.stairsX + 17, f.corridorY - 10, f.x - b.stairsX - 17, 20);
      this.add.text(f.x, f.y - 20, `PLANTA ${fi + 1} · ${f.name.toUpperCase()}`, TXT(12, '#' + color.toString(16).padStart(6, '0'))).setDepth(3);

      for (const r of f.rooms) this.buildRoom(g, r, color);
      this.buildCommon(g, f.common, f.index, color);
    });
  }

  private buildRoom(g: Phaser.GameObjects.Graphics, r: RoomL, color: number) {
    const c1 = 0x232a3a;
    const c2 = 0x1f2534;
    for (let ty = 0; ty * 20 < r.h; ty++)
      for (let tx = 0; tx * 20 < r.w; tx++) {
        g.fillStyle((tx + ty) % 2 ? c1 : c2, 1);
        g.fillRect(r.x + tx * 20, r.y + ty * 20, Math.min(20, r.w - tx * 20), Math.min(20, r.h - ty * 20));
      }
    g.lineStyle(3, 0x07080c, 1);
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.fillStyle(color, 0.9);
    g.fillRect(r.x, r.y, r.w, 22);
    g.fillStyle(0x8a6a3a, 1); // puerta
    g.fillRect(r.door.x - 14, r.y + r.h - 3, 28, 6);
    // bandeja de entrada
    g.fillStyle(0x161a24, 1);
    g.fillRect(r.inbox.x - 4, r.inbox.y - 4, r.inbox.cols * 17 + 6, r.inbox.rows * 17 + 6);
    g.lineStyle(1, 0x3a4259, 1);
    g.strokeRect(r.inbox.x - 4, r.inbox.y - 4, r.inbox.cols * 17 + 6, r.inbox.rows * 17 + 6);
    // escritorios
    for (const d of r.desks) {
      g.fillStyle(0x07080c, 1);
      g.fillRect(d.x - 21, d.y - 13, 42, 28);
      g.fillStyle(0x8a643a, 1);
      g.fillRect(d.x - 20, d.y - 12, 40, 26);
      g.fillStyle(0x2b3346, 1);
      g.fillRect(d.x - 7, d.y - 10, 14, 9);
      g.fillStyle(0x5bc16a, 0.8);
      g.fillRect(d.x - 5, d.y - 9, 10, 6);
      g.fillStyle(0x3a4259, 1);
      g.fillCircle(d.seat.x, d.seat.y + 1, 6);
    }
    const maxChars = Math.max(4, Math.floor((r.w - 56) / 6.4));
    const title = r.name.length > maxChars ? `${r.name.slice(0, maxChars - 1)}…` : r.name;
    this.add.text(r.x + 6, r.y + 5, title, TXT(10, '#0b0d13')).setDepth(3);
    const header = this.add.text(r.x + r.w - 5, r.y + 6, '', TXT(9, '#0b0d13')).setOrigin(1, 0).setDepth(3);
    const overflow = this.add
      .text(r.inbox.x + r.inbox.cols * 17, r.y + r.h - 4, '', TXT(10, '#ffd479'))
      .setOrigin(1, 1)
      .setDepth(12);
    const big = this.add
      .text(r.x + r.w / 2, r.y + r.h / 2 + 8, '0', TXT(64, '#ffffff'))
      .setOrigin(0.5)
      .setDepth(40)
      .setVisible(false);
    const overlay = this.add.rectangle(r.x, r.y, r.w, r.h, 0xff3030, 0).setOrigin(0).setDepth(4);
    const bar = this.add.graphics().setDepth(5);
    this.roomViews.set(r.id, { room: r, header, overflow, big, overlay, bar, people: r.desks.map((d) => d.personId) });
  }

  private buildCommon(g: Phaser.GameObjects.Graphics, c: { x: number; y: number; w: number; h: number; door: Pt }, fi: number, color: number) {
    for (let ty = 0; ty * 20 < c.h; ty++)
      for (let tx = 0; tx * 20 < c.w; tx++) {
        g.fillStyle((tx + ty) % 2 ? 0x2c2a22 : 0x28261f, 1);
        g.fillRect(c.x + tx * 20, c.y + ty * 20, Math.min(20, c.w - tx * 20), Math.min(20, c.h - ty * 20));
      }
    g.lineStyle(3, 0x07080c, 1);
    g.strokeRect(c.x, c.y, c.w, c.h);
    g.fillStyle(0x6b5a3a, 1);
    g.fillRect(c.x, c.y, c.w, 22);
    g.fillStyle(0x8a6a3a, 1);
    g.fillRect(c.door.x - 14, c.y + c.h - 3, 28, 6);
    g.fillStyle(color, 0.35); // mesa
    g.fillRect(c.x + 12, c.y + c.h - 34, c.w - 24, 18);
    this.add.text(c.x + 6, c.y + 4, 'Sala común', TXT(11, '#f4e8c8')).setDepth(3);
    void fi;
  }

  private buildPeople() {
    const b = this.b!;
    const def = this.def!;
    def.people.forEach((p, i) => {
      const color = this.areaOf.get(b.floors[b.personFloor.get(p.id)!].areaId) ?? 0x4aa3ff;
      const body = this.add.graphics();
      const skin = SKIN[i % SKIN.length];
      body.fillStyle(0x000000, 0.25);
      body.fillEllipse(0, 1, 14, 5);
      body.fillStyle(0x2b3346, 1);
      body.fillRect(-4, -5, 3, 5);
      body.fillRect(1, -5, 3, 5);
      body.fillStyle(color, 1);
      body.fillRect(-5, -14, 10, 10);
      body.fillStyle(skin, 1);
      body.fillRect(-4, -22, 8, 8);
      body.fillStyle(0x2a1d14, 1);
      body.fillRect(-4, -23, 8, 3);
      const dot = this.add.rectangle(0, -29, 5, 5, DOT.idle).setStrokeStyle(1, 0x07080c);
      const tag = this.add.text(0, -38, '', TXT(8, '#ffffff')).setOrigin(0.5).setBackgroundColor('#000000aa');
      const first = (p.name ?? p.id).split(' ')[0];
      const name = this.add.text(0, 6, first, TXT(8, '#c9d2ea')).setOrigin(0.5, 0);
      const hit = this.add.rectangle(0, -12, 18, 30, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.select(p.id));
      const container = this.add.container(b.entrance.x, b.entrance.y, [body, dot, tag, name, hit]).setDepth(20).setVisible(false);
      this.persons.set(p.id, {
        id: p.id,
        mover: new Mover(b.entrance.x, b.entrance.y),
        container,
        body,
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

    const walk = Math.min(1400, 90 + this.speed * 3);
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

  private updatePersons(time: number, dt: number, walk: number, jumped: boolean) {
    const rp = this.rp!;
    const b = this.b!;
    const semantic = this.cameras.main.zoom < SEMANTIC_ZOOM;
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
      if (moving) pv.facing = pv.mover.x >= prevX ? 1 : -1;
      pv.container.setPosition(pv.mover.x, pv.mover.y);
      pv.container.setDepth(20 + pv.mover.y / 1000);
      pv.container.setVisible(pv.visible && !semantic);
      pv.container.setAlpha(state === 'absent' ? 0.3 : 1);
      pv.body.y = moving ? Math.sin(time / 55) * 1.6 : 0;
      pv.body.scaleX = pv.facing;
      pv.dot.setFillStyle(DOT[state] || DOT.idle);
      pv.dot.setVisible(!moving);
      pv.tag.setText(state === 'break' ? 'pausa' : state === 'meeting' ? 'reunión' : state === 'absent' ? 'ausente' : '');
      pv.name.setVisible(this.cameras.main.zoom > 0.7);
    }
  }

  /** Posiciona las cajas (casos) y devuelve la cola de cada sala. */
  private updateCases(time: number, dt: number, walk: number, jumped: boolean): Map<string, OrgCaseView[]> {
    const rp = this.rp!;
    const b = this.b!;
    const semantic = this.cameras.main.zoom < SEMANTIC_ZOOM;
    const blink = Math.floor(time / 250) % 2 === 0;
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
      } else if ((c.status === 'working' || c.status === 'paused') && c.person) {
        const { room: pr, desk } = b.personDesk.get(c.person)!;
        place.set(c.id, { key: `desk:${c.person}`, dest: { x: desk.x + 11, y: desk.y - 2, floor: pr.floor, zone: pr.id } });
      } else if (c.status === 'transit' && c.toUnit) {
        const to = b.unitRoom(c.toUnit);
        if (to) {
          const s = inboxSlot(to, 0);
          place.set(c.id, { key: `transit:${to.id}`, dest: { x: s.x, y: s.y, floor: to.floor, zone: to.id } });
        } else place.set(c.id, null);
      } else place.set(c.id, null);
      live.add(c.id);
    }

    for (const [roomId, list] of queued) {
      const room = b.rooms.get(roomId)!;
      list.sort((x, y) => x.enteredAt - y.enteredAt || (x.id < y.id ? -1 : 1));
      const cap = room.inbox.cols * room.inbox.rows;
      list.forEach((c, i) => {
        const s = inboxSlot(room, Math.min(i, cap - 1));
        place.set(c.id, { key: `inbox:${roomId}:${Math.min(i, cap - 1)}`, dest: { x: s.x, y: s.y, floor: room.floor, zone: roomId } });
        live.add(c.id);
      });
    }

    for (const id of live) {
      const c = rp.cases.get(id)!;
      const p = place.get(id);
      let cv = this.crates.get(id);
      if (!cv) {
        const start = p && jumped ? p.dest : b.entrance;
        const rect = this.add
          .rectangle(start.x, start.y, 12, 12, PROC_COLORS[(this.procIndex.get(c.process) ?? 0) % PROC_COLORS.length])
          .setStrokeStyle(2, 0x3a2a10)
          .setDepth(30);
        cv = { mover: new Mover(start.x, start.y), rect };
        this.crates.set(id, cv);
      }
      if (p) {
        if (jumped) {
          cv.mover.snap(p.dest);
          cv.mover.key = p.key;
        } else cv.mover.setDest(p.key, () => route(b, cv!.mover, p.dest));
      }
      cv.mover.step(dt, walk);
      const overflowed = c.status === 'queued' && p && /:\d+$/.test(p.key) && this.slotIndexIsOverflow(c, queued);
      cv.rect.setPosition(cv.mover.x, cv.mover.y);
      cv.rect.setFillStyle(PROC_COLORS[(this.procIndex.get(c.process) ?? 0) % PROC_COLORS.length], c.status === 'paused' ? 0.55 : 1);
      cv.rect.setStrokeStyle(2, c.breached && blink ? 0xff2020 : 0x3a2a10);
      cv.rect.setVisible(!semantic && !overflowed);
    }
    for (const [id, cv] of this.crates) {
      if (!live.has(id)) {
        cv.rect.destroy();
        this.crates.delete(id);
      }
    }
    return queued;
  }

  private slotIndexIsOverflow(c: OrgCaseView, queued: Map<string, OrgCaseView[]>): boolean {
    const unit = this.stageUnit.get(`${c.process}.${c.stage}`);
    const room = unit ? this.b!.unitRoom(unit) : undefined;
    if (!room) return false;
    const list = queued.get(room.id)!;
    return list.indexOf(c) >= room.inbox.cols * room.inbox.rows - 1;
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
      rv.header.setText(`${here}/${total} · c${q}`);
      rv.overflow.setText(q >= cap ? `+${q - cap + 1}` : '');
      rv.big.setText(String(q)).setVisible(semantic);

      const load = q / Math.max(2, total * 1.5);
      const color = load < 0.7 ? 0x5bc16a : load <= 1 ? 0xffb020 : 0xff3030;
      rv.bar.clear();
      const filled = Math.min(10, Math.round(load * 10));
      const segW = (r.w - 8) / 10;
      for (let i = 0; i < 10; i++) {
        rv.bar.fillStyle(i < filled ? color : 0x2b3346, 1);
        rv.bar.fillRect(r.x + 4 + i * segW, r.y + 24, segW - 2, 4);
      }
      let alpha = 0;
      let tint = 0xffb020;
      if (load > 1) {
        tint = 0xff3030;
        alpha = 0.14 + 0.07 * Math.sin(time / 180);
      } else if (load >= 0.7) alpha = ((load - 0.7) / 0.3) * 0.12;
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
    this.ring.lineStyle(2, 0xffd479, 0.6 + 0.4 * Math.sin(time / 200));
    this.ring.strokeCircle(pv.mover.x, pv.mover.y - 10, 17);
  }
}
