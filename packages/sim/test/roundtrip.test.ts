import { describe, expect, it } from 'vitest';
import {
  companyToYaml,
  parseCompany,
  type Annex,
  type ArrivalsDef,
  type Baseline,
  type CalendarDef,
  type ChangeEntry,
  type CompanyDef,
  type CustomFacility,
  type DecorItem,
  type ExceptionDef,
  type FieldRecord,
  type GlossaryTerm,
  type ImageMark,
  type MeetingDef,
  type NextRule,
  type NoviceAttempt,
  type Optimization,
  type OrgProcessDef,
  type OrgStageDef,
  type PersonDef,
  type ProcException,
  type ProcFieldRecord,
  type ProcResponsibility,
  type ProcStep,
  type Procedure,
  type ProcessDependency,
  type ProcessDoc,
  type ReqReview,
  type ScheduleDef,
  type Signoff,
  type Stakeholder,
  type StepAlt,
  type StepImage,
  type UnitDef,
  type Validation,
} from '../src';

/**
 * «Todo lo que se ingresa se guarda»: una empresa con TODOS los campos del modelo rellenos debe volver idéntica
 * después de pasar por el YAML que se guarda en la base de datos. Cada objeto se declara con `Required<…>`, así
 * que si alguien añade un campo al modelo y no lo pone aquí, el compilador (npm run typecheck) lo avisa;
 * y si el YAML o la validación lo pierden, este test falla.
 */
const png = 'data:image/png;base64,iVBORw0KGgo=';

const decor: Required<DecorItem> = { id: 'd1', k: 'escritorio', x: 40, y: 30, rot: 90, flip: true };
const custom: Required<CustomFacility> = {
  id: 'taller',
  label: 'Taller',
  icon: '🔧',
  description: 'Reparaciones',
  look: 'mantenimiento',
  art: {
    items: [
      { t: 'rect', x: 0, y: 0, w: 40, h: 20, c: '#aabbcc', r: 3 },
      { t: 'ellipse', x: 10, y: 10, w: 20, h: 20, c: '#112233' },
      { t: 'tri', x: 50, y: 10, w: 20, h: 20, c: '#445566' },
      { t: 'line', x: 0, y: 0, x2: 100, y2: 50, c: '#778899', lw: 2 },
      { t: 'emoji', x: 120, y: 20, s: 30, ch: '🛠' },
    ],
    image: png,
  },
};
const calendar: Required<CalendarDef> = { workDays: [0, 1, 2, 3, 4], hours: { start: '08:00', end: '17:00' }, breaks: [{ start: '12:00', end: '13:00' }], absenteeism: 0.02 };
const schedule: Required<ScheduleDef> = { hours: { start: '06:00', end: '14:00' }, breaks: [{ start: '10:00', end: '10:20' }] };
const meeting: Required<MeetingDef> = { id: 'm1', unit: 'ops', start: '09:00', minutes: 30, days: [0, 2] };
const sub: Required<UnitDef> = { id: 'caja', name: 'Caja', facility: 'taller', decor: [decor], head: 'p2', children: [] };
const area: Required<UnitDef> = { id: 'ops', name: 'Operaciones', facility: 'bodega', decor: [decor], head: 'p1', children: [sub] };
const p1: Required<PersonDef> = { id: 'p1', name: 'Ana', unit: 'ops', kind: 'responsable', role: 'Jefa', skills: ['caja', 'kyc'], reportsTo: 'p2', speed: 1.2, errorRate: 0.05, absenteeism: 0.01, schedule: 'manana' };
const p2: Required<PersonDef> = { id: 'p2', name: 'Beto', unit: 'caja', kind: 'colaborador', role: 'Cajero', skills: ['caja'], reportsTo: 'p1', speed: 0.9, errorRate: 0.1, absenteeism: 0.03, schedule: 'manana' };

const exception: Required<ExceptionDef> = { id: 'rechazo', probability: 0.1, action: 'goto', target: 'a', penaltyMinutes: 15 };
const rule1: Required<NextRule> = { when: 'monto > 100', otherwise: false, to: 'b' };
const rule2: Required<NextRule> = { when: 'monto <= 100', otherwise: true, to: 'a' };
const stageA: Required<OrgStageDef> = {
  id: 'a',
  label: 'Recibir',
  unit: 'caja',
  role: 'Cajero',
  skill: 'caja',
  duration: { dist: 'lognormal', median: 8, sigma: 0.3 },
  sla: { maxMinutes: 60 },
  exceptions: [exception],
  next: [rule1, rule2],
  terminal: false,
  automated: false,
};
const stageB: Required<OrgStageDef> = { ...stageA, id: 'b', label: 'Validar', next: 'c', terminal: false, automated: true, exceptions: [] };
const stageC: Required<OrgStageDef> = { ...stageA, id: 'c', label: 'Archivar', next: 'd', terminal: false, exceptions: [] };
const stageD: OrgStageDef = { id: 'd', label: 'Cerrar', unit: 'caja', role: 'Cajero', duration: { dist: 'fixed', value: 2 }, terminal: true };
const arrivals: Required<Extract<ArrivalsDef, { type: 'poisson' }>> = { type: 'poisson', ratePerHour: 3, calendar: 'default' };

const stakeholder: Required<Stakeholder> = { id: 's1', name: 'Carla', role: 'Gerente', personId: 'p1' };
const field: Required<FieldRecord> = { id: 'f1', type: 'entrevista', date: '2026-10-01', source: 'Carla', notes: 'notas', findings: 'hallazgos' };
const validation: Required<Validation> = { stakeholderId: 's1', status: 'observado', comment: 'falta algo', date: '2026-10-05' };
const baseline: Required<Baseline> = { capturedAt: '2026-10-02T10:00:00Z', seeds: [1, 2, 3], days: 5, stages: 3, completed: 40, cycleAvg: 55.5, cycleP90: 90, slaBreaches: 2, waitPerCase: 12.5 };
const doc: Required<ProcessDoc> = {
  scope: {
    objective: 'Objetivo',
    inScope: 'Dentro',
    outOfScope: 'Fuera',
    owner: 'p1',
    successCriteria: 'Criterio',
    inputs: 'Entradas',
    outputs: 'Salidas',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    stakeholders: [stakeholder],
  },
  fieldwork: [field],
  baseline,
  validations: [validation],
  phases: { alcance: { completedAt: '2026-10-01' }, campo: { completedAt: '2026-10-02' }, asis: { completedAt: '2026-10-03' }, validacion: { completedAt: '2026-10-04' }, ficha: { completedAt: '2026-10-05' } },
  version: '1.2',
  approvedAt: '2026-10-06',
};

const review: Required<ReqReview> = { requestedBy: 'Carla', reason: 'Norma', needed: 'duda', simplified: 'Quitar el sello' };
const design: OrgProcessDef = { id: 'p-design', name: 'Rediseño', arrivals: { type: 'constant', everyMinutes: 30, calendar: 'default' }, stages: [{ id: 'a', label: 'Única', terminal: true }] };
const optimization: Required<Optimization> = {
  reqReview: { a: review },
  eliminated: ['b'],
  eliminationNotes: 'sobraba',
  design,
  designNotes: 'rediseño',
  speed: { a: 0.8 },
  speedNotes: 'más rápido',
  auto: { c: 0.5 },
  autoNotes: 'automatizado',
  steps: { '1': { completedAt: 'x1' }, '2': { completedAt: 'x2' }, '3': { completedAt: 'x3' }, '4': { completedAt: 'x4' }, '5': { completedAt: 'x5' } },
};

const exc: Required<ProcException> = { id: 'e1', text: 'El cliente no envía el dato' };
const record: Required<ProcFieldRecord> = { id: 'r1', operator: 'Beto', method: 'en_vivo', date: '2026-10-03', notes: 'observado', exceptions: [exc], tricks: ['atajo'] };
const resp: Required<ProcResponsibility> = { role: 'Cajero', description: 'Recibe' };
const term: Required<GlossaryTerm> = { term: 'KYC', definition: 'Conoce a tu cliente' };
const annex: Required<Annex> = { id: 'x1', title: 'Formato', kind: 'enlace', url: 'https://ejemplo.com/f' };
const alt: Required<StepAlt> = { id: 'alt1', condition: 'si falta el dato', action: 'pedirlo', exceptionId: 'e1' };
const marks: Array<Required<ImageMark>> = [
  { kind: 'circle', x: 0.1, y: 0.2, x2: 0.3, y2: 0.4, n: 1 },
  { kind: 'arrow', x: 0.5, y: 0.5, x2: 0.6, y2: 0.6, n: 2 },
  { kind: 'num', x: 0.7, y: 0.7, x2: 0.8, y2: 0.8, n: 3 },
];
const image: Required<StepImage> = { src: png, caption: 'Pantalla de caja', marks };
const step: Required<ProcStep> = {
  id: 'st1',
  actor: 'Cajero',
  action: 'Registrar el depósito',
  tool: 'Sistema central',
  result: 'Depósito registrado',
  warning: { kind: 'financiero', text: 'Verifica el monto' },
  alternatives: [alt],
  image,
};
const attempt: Required<NoviceAttempt> = { id: 'n1', tester: 'Dani', date: '2026-10-04', completed: true, questions: 2, notes: 'ok' };
const sign: Required<Signoff> = { id: 'sg1', name: 'Beto', role: 'Cajero', status: 'observado', date: '2026-10-05', comment: 'revisar' };
const change: Required<ChangeEntry> = { version: '1.1', date: '2026-10-06', description: 'Primera revisión' };
const procedure: Required<Procedure> = {
  id: 'pc1',
  code: 'PRO-001',
  title: 'Registrar depósito',
  stageId: 'a',
  prerequisites: ['pc0'],
  digital: true,
  fieldwork: [record],
  noTricks: true,
  objective: 'Objetivo',
  startsWhen: 'Llega el cliente',
  endsWhen: 'Se entrega el comprobante',
  includes: 'Depósitos',
  excludes: 'Retiros',
  responsibilities: [resp],
  glossary: [term],
  noGlossary: true,
  annexes: [annex],
  steps: [step],
  noWarnings: true,
  attempts: [attempt],
  signoffs: [sign],
  changes: [change],
  version: '2.0',
  approvedAt: '2026-10-07',
  done: { '1': { completedAt: 'd1' }, '2': { completedAt: 'd2' }, '3': { completedAt: 'd3' }, '4': { completedAt: 'd4' }, '5': { completedAt: 'd5' } },
};
const procedure0: Required<Procedure> = { ...procedure, id: 'pc0', code: 'PRO-000', title: 'Previo', prerequisites: [], stageId: 'a' };
const dep: Required<ProcessDependency> = { process: 'base', kind: 'dispara', atStage: 'a', probability: 0.5, toStage: 'b', inherit: true, note: 'nota' };

const base: OrgProcessDef = { id: 'base', name: 'Base', arrivals: { type: 'constant', everyMinutes: 60 }, stages: [{ id: 'a', terminal: true }] };
const proc: Required<OrgProcessDef> = {
  id: 'dep',
  name: 'Depósitos',
  arrivals,
  attributes: { monto: { dist: 'lognormal', median: 100, sigma: 0.5 }, canal: { dist: 'fixed', value: 1 } },
  stages: [stageA, stageB, stageC, stageD],
  dependsOn: [dep],
  doc,
  optimization,
  procedures: [procedure0, procedure],
};

export const FULL: Required<CompanyDef> = {
  company: 'Empresa Completa',
  calendar,
  travel: { sameTeam: 1, sameArea: 3, crossArea: 8 },
  schedules: { manana: schedule },
  meetings: [meeting],
  facilityTypes: [custom],
  units: [area],
  people: [p1, p2],
  processes: [base, proc],
  scenario: { absences: [{ person: 'p2', days: [1, 2] }] },
};

/** lo que se guarda: la empresa pasa a YAML y vuelve a leerse; `normalizeCompany` convierte `head` en `kind` */
const roundtrip = (def: CompanyDef) => parseCompany(companyToYaml(def));

describe('todo lo que se ingresa llega a la base de datos', () => {
  it('la empresa completa es válida y vuelve idéntica del YAML (salvo el formato antiguo `head`)', () => {
    const r = roundtrip(FULL);
    expect(r.errors).toEqual([]);
    const expected = structuredClone(FULL) as CompanyDef;
    const strip = (list: UnitDef[]) => list.forEach((u) => (delete u.head, u.children && strip(u.children)));
    strip(expected.units);
    // `head` (obsoleto) se convierte en kind: responsable de esa persona; aquí las personas ya lo declaran
    expect(r.def).toEqual(expected);
  });

  it('cada campo de cada objeto sobrevive: ninguno se pierde por el camino', () => {
    const r = roundtrip(FULL).def!;
    const paths = (v: unknown, at = ''): string[] =>
      v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => paths(x, `${at}.${Array.isArray(v) ? '[]' : k}`)) : [at];
    const want = new Set(paths(FULL).filter((p) => !p.includes('.head')));
    const got = new Set(paths(r));
    expect([...want].filter((p) => !got.has(p))).toEqual([]);
  });

  it('el YAML es estable: guardar, abrir y volver a guardar no cambia nada', () => {
    const once = companyToYaml(roundtrip(FULL).def!);
    const twice = companyToYaml(roundtrip(parseCompany(once).def!).def!);
    expect(twice).toBe(once);
  });

  it('un texto con tildes, ñ, comillas, dos puntos y saltos de línea se conserva tal cual', () => {
    const raro = 'Niño: "sí" — línea 1\nlínea 2 # no es comentario · ✓ 日本';
    const def = structuredClone(FULL) as CompanyDef;
    def.company = raro;
    def.processes[1].doc!.scope.objective = raro;
    def.processes[1].procedures![1].steps[0].action = raro;
    const r = roundtrip(def).def!;
    expect(r.company).toBe(raro);
    expect(r.processes[1].doc!.scope.objective).toBe(raro);
    expect(r.processes[1].procedures![1].steps[0].action).toBe(raro);
  });
});
