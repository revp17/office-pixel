import type { CompanyDef, DistSpec, NextRule, OrgProcessDef, OrgStageDef, PersonDef, PersonKind, UnitDef } from '@office-pixel/sim';

/** Texto → identificador interno estable (sin tildes ni espacios). */
export function slug(s: string): string {
  const base = s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'item';
}

export function uniqueId(name: string, taken: Set<string>): string {
  const base = slug(name);
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}_${i}`;
  return id;
}

export const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
export const DAY_TITLES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function emptyCompany(): CompanyDef {
  return {
    company: 'Mi empresa',
    calendar: {
      workDays: [0, 1, 2, 3, 4],
      hours: { start: '09:00', end: '18:00' },
      breaks: [{ start: '13:00', end: '14:00' }],
      absenteeism: 0.03,
    },
    travel: { sameTeam: 0, sameArea: 2, crossArea: 5 },
    units: [{ id: 'operaciones', name: 'Operaciones', children: [{ id: 'subarea_1', name: 'Subárea 1' }] }],
    people: [
      { id: 'ana', name: 'Ana', unit: 'subarea_1', kind: 'responsable', role: 'analista' },
      { id: 'luis', name: 'Luis', unit: 'subarea_1', kind: 'colaborador', role: 'analista' },
    ],
    processes: [
      {
        id: 'mi_proceso',
        name: 'Mi proceso',
        arrivals: { type: 'poisson', ratePerHour: 4 },
        stages: [
          {
            id: 'atencion',
            label: 'Atención',
            unit: 'subarea_1',
            role: 'analista',
            duration: { dist: 'normal', meanMinutes: 20, sdMinutes: 5 },
            next: 'cierre',
          },
          { id: 'cierre', label: 'Cierre', terminal: true },
        ],
      },
    ],
  };
}

// ---------- unidades ----------

export interface FlatUnit {
  unit: UnitDef;
  depth: number;
  parent?: UnitDef;
}

export function flatUnits(units: UnitDef[], depth = 0, parent?: UnitDef): FlatUnit[] {
  return units.flatMap((u) => [{ unit: u, depth, parent }, ...flatUnits(u.children ?? [], depth + 1, u)]);
}

export function allUnitIds(def: CompanyDef): Set<string> {
  return new Set(flatUnits(def.units).map((f) => f.unit.id));
}

export function findUnit(units: UnitDef[], id: string): UnitDef | undefined {
  return flatUnits(units).find((f) => f.unit.id === id)?.unit;
}

/** La lista de hermanos (áreas, o subáreas de una misma área) donde está la unidad, y su posición. */
export function siblingsOf(def: CompanyDef, id: string): { list: UnitDef[]; index: number } | undefined {
  const search = (list: UnitDef[]): { list: UnitDef[]; index: number } | undefined => {
    const index = list.findIndex((u) => u.id === id);
    if (index >= 0) return { list, index };
    for (const u of list) {
      const r = u.children && search(u.children);
      if (r) return r;
    }
  };
  return search(def.units);
}

/** Mueve un área (o subárea) entre sus hermanas: el orden de la lista es el orden en el plano. */
export function moveUnit(def: CompanyDef, id: string, to: 'up' | 'down' | 'first' | 'last'): boolean {
  const s = siblingsOf(def, id);
  if (!s) return false;
  const { list, index } = s;
  const target = to === 'up' ? index - 1 : to === 'down' ? index + 1 : to === 'first' ? 0 : list.length - 1;
  if (target < 0 || target >= list.length || target === index) return false;
  const [u] = list.splice(index, 1);
  list.splice(target, 0, u);
  return true;
}

export function subtreeIds(u: UnitDef): string[] {
  return flatUnits([u]).map((f) => f.unit.id);
}

export function unitName(def: CompanyDef, id: string | undefined): string {
  return (id && findUnit(def.units, id)?.name) || id || '—';
}

export function usage(def: CompanyDef, unitId: string) {
  const u = findUnit(def.units, unitId);
  const ids = new Set(u ? subtreeIds(u) : [unitId]);
  return {
    people: def.people.filter((p) => ids.has(p.unit)).length,
    stages: def.processes.reduce((n, p) => n + p.stages.filter((s) => s.unit && ids.has(s.unit)).length, 0),
    meetings: (def.meetings ?? []).filter((m) => ids.has(m.unit)).length,
  };
}

export function addUnit(def: CompanyDef, parentId: string | null, name: string): string {
  const id = uniqueId(name, allUnitIds(def));
  const unit: UnitDef = { id, name };
  if (parentId === null) def.units.push(unit);
  else {
    const parent = findUnit(def.units, parentId)!;
    (parent.children ??= []).push(unit);
  }
  return id;
}

/** Borra una unidad solo si nadie la usa; devuelve el motivo si no se puede. */
export function removeUnit(def: CompanyDef, id: string): { ok: true } | { ok: false; reason: string } {
  const use = usage(def, id);
  const bits: string[] = [];
  if (use.people) bits.push(`${use.people} persona(s)`);
  if (use.stages) bits.push(`${use.stages} etapa(s)`);
  if (use.meetings) bits.push(`${use.meetings} reunión(es)`);
  if (bits.length) return { ok: false, reason: `Aún tiene ${bits.join(', ')}. Muévelas o bórralas primero.` };
  const strip = (list: UnitDef[]): UnitDef[] =>
    list
      .filter((u) => u.id !== id)
      .map((u) => (u.children ? { ...u, children: strip(u.children) } : u));
  def.units = strip(def.units);
  return { ok: true };
}

export function rolesIn(def: CompanyDef, unitId: string | undefined): string[] {
  const u = unitId ? findUnit(def.units, unitId) : undefined;
  const ids = new Set(u ? subtreeIds(u) : []);
  return [...new Set(def.people.filter((p) => ids.has(p.unit)).map((p) => p.role))].sort();
}

export function allRoles(def: CompanyDef): string[] {
  return [...new Set(def.people.map((p) => p.role).filter(Boolean))].sort();
}

// ---------- personas ----------

export const KIND_LABEL: Record<PersonKind, string> = { responsable: 'Responsable', colaborador: 'Colaborador' };

export function kindOf(p: PersonDef): PersonKind {
  return p.kind === 'responsable' ? 'responsable' : 'colaborador';
}

/** Personas de una unidad (directas, sin contar subunidades) de un tipo. */
export function peopleOf(def: CompanyDef, unitId: string, kind: PersonKind): PersonDef[] {
  return def.people.filter((p) => p.unit === unitId && kindOf(p) === kind);
}

export function addPerson(def: CompanyDef, unit: string, name?: string, kind: PersonKind = 'colaborador'): PersonDef {
  const label = name ?? (kind === 'responsable' ? 'Nuevo responsable' : 'Nuevo colaborador');
  const taken = new Set(def.people.map((p) => p.id));
  const sample = def.people.find((p) => p.unit === unit && kindOf(p) === kind) ?? def.people.find((p) => p.unit === unit);
  const p: PersonDef = { id: uniqueId(label, taken), name: label, unit, kind, role: sample?.role ?? 'empleado' };
  def.people.push(p);
  return p;
}

export function removePerson(def: CompanyDef, id: string) {
  def.people = def.people.filter((p) => p.id !== id);
  for (const p of def.people) if (p.reportsTo === id) delete p.reportsTo;
  if (def.scenario?.absences) def.scenario.absences = def.scenario.absences.filter((a) => a.person !== id);
}

// ---------- procesos ----------

/** Mueve un proceso en la lista: el orden de la lista es el orden en que se muestran (pantallas, mapa y ficha). */
export function moveProcess(def: CompanyDef, id: string, to: 'up' | 'down' | 'first' | 'last'): boolean {
  const list = def.processes;
  const index = list.findIndex((p) => p.id === id);
  if (index < 0) return false;
  const target = to === 'up' ? index - 1 : to === 'down' ? index + 1 : to === 'first' ? 0 : list.length - 1;
  if (target < 0 || target >= list.length || target === index) return false;
  const [p] = list.splice(index, 1);
  list.splice(target, 0, p);
  return true;
}

export function addProcess(def: CompanyDef, name = 'Nuevo proceso'): OrgProcessDef {
  const unit = def.people[0]?.unit ?? flatUnits(def.units)[0]?.unit.id;
  const role = def.people[0]?.role;
  const p: OrgProcessDef = {
    id: uniqueId(name, new Set(def.processes.map((x) => x.id))),
    name,
    arrivals: { type: 'poisson', ratePerHour: 4 },
    stages: [
      {
        id: 'etapa_1',
        label: 'Etapa 1',
        unit,
        role,
        duration: { dist: 'normal', meanMinutes: 20, sdMinutes: 5 },
        next: 'cierre',
      },
      { id: 'cierre', label: 'Cierre', terminal: true },
    ],
  };
  def.processes.push(p);
  return p;
}

export function addStage(proc: OrgProcessDef, def: CompanyDef, label = 'Nueva etapa'): OrgStageDef {
  const taken = new Set(proc.stages.map((s) => s.id));
  const prev = proc.stages.filter((s) => !s.terminal).pop();
  const st: OrgStageDef = {
    id: uniqueId(label, taken),
    label,
    unit: prev?.unit ?? flatUnits(def.units)[0]?.unit.id,
    role: prev?.role,
    duration: { dist: 'normal', meanMinutes: 20, sdMinutes: 5 },
  };
  // se inserta antes de la primera etapa final y la anterior apunta a la nueva
  const at = proc.stages.findIndex((s) => s.terminal);
  const idx = at < 0 ? proc.stages.length : at;
  if (prev && typeof prev.next === 'string') {
    st.next = prev.next;
    prev.next = st.id;
  } else st.next = proc.stages.find((s) => s.terminal)?.id;
  proc.stages.splice(idx, 0, st);
  return st;
}

export function removeStage(proc: OrgProcessDef, id: string) {
  proc.stages = proc.stages.filter((s) => s.id !== id);
  for (const s of proc.stages) {
    if (s.next === id) delete s.next;
    if (Array.isArray(s.next)) for (const r of s.next) if (r.to === id) r.to = '';
    if (s.exceptions) s.exceptions = s.exceptions.filter((e) => e.target !== id);
  }
}

export function renameAttribute(proc: OrgProcessDef, from: string, to: string) {
  if (!proc.attributes || from === to) return;
  const entries = Object.entries(proc.attributes).map(([k, v]) => [k === from ? to : k, v] as const);
  proc.attributes = Object.fromEntries(entries);
  const re = new RegExp(`case\\.${from}\\b`, 'g');
  for (const s of proc.stages)
    if (Array.isArray(s.next)) for (const r of s.next) if (r.when) r.when = r.when.replace(re, `case.${to}`);
}

// ---------- condiciones ----------

export type Op = '>' | '>=' | '<' | '<=' | '==' | '!=';
export const OPS: Array<{ op: Op; label: string }> = [
  { op: '>', label: 'es mayor que' },
  { op: '>=', label: 'es mayor o igual a' },
  { op: '<', label: 'es menor que' },
  { op: '<=', label: 'es menor o igual a' },
  { op: '==', label: 'es igual a' },
  { op: '!=', label: 'es distinto de' },
];

const SIMPLE = /^\s*case\.(\w+)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/;

export interface SimpleCond {
  attr: string;
  op: Op;
  value: number;
}

export function parseCondition(when: string | undefined): SimpleCond | null {
  const m = when ? SIMPLE.exec(when) : null;
  return m ? { attr: m[1], op: m[2] as Op, value: Number(m[3]) } : null;
}

export function formatCondition(c: SimpleCond): string {
  return `case.${c.attr} ${c.op} ${c.value}`;
}

/** Asegura que next sea una lista con "en otro caso" al final. */
export function toRules(next: OrgStageDef['next'], fallback: string): NextRule[] {
  if (Array.isArray(next)) return next;
  return [{ otherwise: true, to: typeof next === 'string' ? next : fallback }];
}

// ---------- distribuciones ----------

export function getParam(spec: DistSpec, ...names: string[]): number {
  for (const n of names) {
    const v = spec[n];
    if (typeof v === 'number') return v;
  }
  return 0;
}

/** Parámetros por tipo; `minutes` usa los nombres con sufijo "Minutes" que usa el motor para etapas. */
export function distFields(dist: DistSpec['dist'], minutes: boolean): Array<{ key: string; alt: string; label: string }> {
  const k = (a: string, b: string) => (minutes ? b : a);
  switch (dist) {
    case 'fixed':
      return [{ key: k('value', 'minutes'), alt: k('minutes', 'value'), label: 'valor' }];
    case 'normal':
      return [
        { key: k('mean', 'meanMinutes'), alt: k('meanMinutes', 'mean'), label: 'media' },
        { key: k('sd', 'sdMinutes'), alt: k('sdMinutes', 'sd'), label: 'desviación' },
      ];
    case 'lognormal':
      return [
        { key: k('median', 'medianMinutes'), alt: k('medianMinutes', 'median'), label: 'mediana' },
        { key: 'sigma', alt: 'sigma', label: 'dispersión' },
      ];
    case 'exponential':
      return [{ key: k('mean', 'meanMinutes'), alt: k('meanMinutes', 'mean'), label: 'media' }];
  }
}

export const DIST_LABELS: Record<DistSpec['dist'], string> = {
  fixed: 'fija',
  normal: 'normal (campana)',
  lognormal: 'con cola larga',
  exponential: 'exponencial',
};

export function defaultDist(dist: DistSpec['dist'], minutes: boolean): DistSpec {
  const f = distFields(dist, minutes);
  const defaults: Record<string, number> = { value: 10, minutes: 10, mean: 20, meanMinutes: 20, sd: 5, sdMinutes: 5, median: 20, medianMinutes: 20, sigma: 0.4 };
  const spec: DistSpec = { dist };
  for (const x of f) spec[x.key] = defaults[x.key] ?? 10;
  return spec;
}

// ---------- escribir números y nombres con fluidez ----------

/** ¿Es un texto numérico a medio escribir? Acepta «», «-», «0.», «0,5» y «12». */
export const isNumText = (s: string) => /^-?\d*[.,]?\d*$/.test(s);

/** Texto → número (admite coma decimal). undefined si está vacío o aún no es un número («-», «.»). */
export function parseNumText(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (t === '' || t === '-' || t === '.' || t === '-.') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Nombre de un dato: letras, números y guion bajo (lo demás se vuelve «_»). */
export const normalizeAttrName = (s: string) => s.trim().replace(/[^A-Za-z0-9_]/g, '_');
