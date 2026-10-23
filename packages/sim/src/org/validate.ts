import { parse } from 'yaml';
import { checkDist } from '../dist';
import { compileExpr } from '../expr';
import { parseHM } from './time';
import { FACILITIES } from './types';
import { isBuiltinFacility } from './facilities';
import type { CompanyDef, UnitDef } from './types';

export interface CompanyParseResult {
  def?: CompanyDef;
  errors: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseCompany(yamlText: string): CompanyParseResult {
  let raw: unknown;
  try {
    raw = parse(yamlText);
  } catch (e) {
    return { errors: [`YAML inválido: ${(e as Error).message}`] };
  }
  const res = validateCompany(raw);
  if (res.def) normalizeCompany(res.def);
  return res;
}

/**
 * Formato antiguo: `head` en una unidad. Ahora cada persona es responsable o colaborador de su
 * unidad, así que se marca a esa persona como responsable y se elimina `head`.
 */
export function normalizeCompany(def: CompanyDef): CompanyDef {
  const walk = (list: UnitDef[]) => {
    for (const u of list) {
      if (u.head !== undefined) {
        const p = def.people.find((q) => q.id === u.head);
        if (p && p.unit === u.id && !p.kind) p.kind = 'responsable';
        delete u.head;
      }
      if (u.children) walk(u.children);
    }
  };
  walk(def.units);
  return def;
}

function checkHours(h: unknown, path: string, errors: string[]): void {
  if (!isObj(h)) return void errors.push(`${path}: faltan "start" y "end"`);
  const s = parseHM(h.start);
  const e = parseHM(h.end);
  if (s === null || e === null) errors.push(`${path}: usa el formato "HH:MM"`);
  else if (e <= s) errors.push(`${path}: "end" debe ser posterior a "start"`);
}

function checkBlocks(list: unknown, path: string, errors: string[]): void {
  if (list === undefined) return;
  if (!Array.isArray(list)) return void errors.push(`${path}: debe ser una lista`);
  list.forEach((b, i) => checkHours(b, `${path}[${i}]`, errors));
}

export function validateCompany(raw: unknown): CompanyParseResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { errors: ['La definición debe ser un objeto YAML/JSON'] };
  if (typeof raw.company !== 'string' || !raw.company) errors.push('company: falta el nombre de la empresa');

  // calendario
  const cal = raw.calendar;
  if (!isObj(cal)) errors.push('calendar: falta el calendario');
  else {
    if (!Array.isArray(cal.workDays) || cal.workDays.length === 0 || !cal.workDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))
      errors.push('calendar.workDays: lista de días 0 (lun) a 6 (dom)');
    checkHours(cal.hours, 'calendar.hours', errors);
    checkBlocks(cal.breaks, 'calendar.breaks', errors);
    if (cal.absenteeism !== undefined && !(typeof cal.absenteeism === 'number' && cal.absenteeism >= 0 && cal.absenteeism <= 1))
      errors.push('calendar.absenteeism: debe estar entre 0 y 1');
  }

  const scheduleIds = new Set<string>();
  if (raw.schedules !== undefined) {
    if (!isObj(raw.schedules)) errors.push('schedules: debe ser un mapa nombre → horario');
    else
      for (const [k, s] of Object.entries(raw.schedules)) {
        scheduleIds.add(k);
        if (!isObj(s)) errors.push(`schedules.${k}: inválido`);
        else {
          checkHours(s.hours, `schedules.${k}.hours`, errors);
          checkBlocks(s.breaks, `schedules.${k}.breaks`, errors);
        }
      }
  }

  // tipos de instalación propios
  const customFacilityIds = new Set<string>();
  if (raw.facilityTypes !== undefined) {
    if (!Array.isArray(raw.facilityTypes)) errors.push('facilityTypes: debe ser una lista');
    else
      raw.facilityTypes.forEach((c, i) => {
        const at = `facilityTypes[${i}]`;
        if (!isObj(c) || typeof c.id !== 'string' || !c.id) return void errors.push(`${at}: falta "id"`);
        if (isBuiltinFacility(c.id)) errors.push(`${at}: "${c.id}" ya es un tipo incluido`);
        else if (customFacilityIds.has(c.id)) errors.push(`${at}: tipo duplicado "${c.id}"`);
        customFacilityIds.add(c.id);
        if (typeof c.label !== 'string' || !c.label.trim()) errors.push(`${at}.label: falta el nombre`);
        if (typeof c.icon !== 'string' || !c.icon.trim()) errors.push(`${at}.icon: falta el icono`);
        if (typeof c.look !== 'string' || !isBuiltinFacility(c.look)) errors.push(`${at}.look: debe ser uno de ${Object.keys(FACILITIES).join(', ')}`);
      });
  }

  // unidades
  const unitIds = new Set<string>();
  const walk = (list: unknown, path: string) => {
    if (!Array.isArray(list)) return void errors.push(`${path}: debe ser una lista`);
    list.forEach((u, i) => {
      const at = `${path}[${i}]`;
      if (!isObj(u) || typeof u.id !== 'string') return void errors.push(`${at}: falta "id"`);
      if (unitIds.has(u.id)) errors.push(`${at}: unidad duplicada "${u.id}"`);
      unitIds.add(u.id);
      if (u.facility !== undefined && !(typeof u.facility === 'string' && (isBuiltinFacility(u.facility) || customFacilityIds.has(u.facility))))
        errors.push(`${at}.facility: debe ser uno de ${[...Object.keys(FACILITIES), ...customFacilityIds].join(', ')}`);
      if (u.children !== undefined) walk(u.children, `${at}.children`);
    });
  };
  if (!Array.isArray(raw.units) || raw.units.length === 0) errors.push('units: debe haber al menos un área');
  else walk(raw.units, 'units');

  // personas
  const personIds = new Set<string>();
  const people = Array.isArray(raw.people) ? raw.people : null;
  if (!people || people.length === 0) errors.push('people: debe haber al menos una persona');
  else {
    people.forEach((p) => isObj(p) && typeof p.id === 'string' && personIds.add(p.id));
    const seen = new Set<string>();
    people.forEach((p, i) => {
      const at = `people[${i}]`;
      if (!isObj(p) || typeof p.id !== 'string') return void errors.push(`${at}: falta "id"`);
      const id = `persona "${p.id}"`;
      if (seen.has(p.id)) errors.push(`${at}: persona duplicada "${p.id}"`);
      seen.add(p.id);
      if (typeof p.unit !== 'string' || !unitIds.has(p.unit)) errors.push(`${id}: la unidad "${String(p.unit)}" no existe`);
      if (typeof p.role !== 'string' || !p.role) errors.push(`${id}: falta "role"`);
      if (p.kind !== undefined && p.kind !== 'responsable' && p.kind !== 'colaborador')
        errors.push(`${id}.kind: debe ser "responsable" o "colaborador"`);
      if (p.reportsTo !== undefined && !personIds.has(String(p.reportsTo))) errors.push(`${id}: reportsTo "${String(p.reportsTo)}" no existe`);
      if (p.schedule !== undefined && !scheduleIds.has(String(p.schedule))) errors.push(`${id}: el horario "${String(p.schedule)}" no existe`);
      if (p.speed !== undefined && !(typeof p.speed === 'number' && p.speed > 0)) errors.push(`${id}.speed: debe ser > 0`);
      if (p.errorRate !== undefined && !(typeof p.errorRate === 'number' && p.errorRate >= 0 && p.errorRate < 1))
        errors.push(`${id}.errorRate: debe estar entre 0 y 1`);
      if (p.absenteeism !== undefined && !(typeof p.absenteeism === 'number' && p.absenteeism >= 0 && p.absenteeism <= 1))
        errors.push(`${id}.absenteeism: debe estar entre 0 y 1`);
    });
  }

  // jefes de unidad
  const checkHeads = (list: UnitDef[]) =>
    list.forEach((u) => {
      if (u.head !== undefined && !personIds.has(u.head)) errors.push(`unidad "${u.id}": head "${u.head}" no existe`);
      if (u.children) checkHeads(u.children);
    });
  if (Array.isArray(raw.units) && errors.every((e) => !e.startsWith('units'))) checkHeads(raw.units as UnitDef[]);

  // reuniones
  if (raw.meetings !== undefined) {
    if (!Array.isArray(raw.meetings)) errors.push('meetings: debe ser una lista');
    else
      raw.meetings.forEach((m, i) => {
        const at = `meetings[${i}]`;
        if (!isObj(m) || typeof m.id !== 'string') return void errors.push(`${at}: falta "id"`);
        if (typeof m.unit !== 'string' || !unitIds.has(m.unit)) errors.push(`${at}.unit: "${String(m.unit)}" no existe`);
        if (parseHM(m.start) === null) errors.push(`${at}.start: usa "HH:MM"`);
        if (!(typeof m.minutes === 'number' && m.minutes > 0)) errors.push(`${at}.minutes: debe ser > 0`);
      });
  }

  // ascendencia de cada unidad, para comprobar elegibilidad
  const ancestors = new Map<string, string[]>();
  const index = (list: unknown, trail: string[]) => {
    if (!Array.isArray(list)) return;
    for (const u of list as UnitDef[]) {
      if (!u || typeof u.id !== 'string') continue;
      const t = [u.id, ...trail];
      ancestors.set(u.id, t);
      index(u.children, t);
    }
  };
  index(raw.units, []);

  // procesos
  const procs = Array.isArray(raw.processes) ? raw.processes : null;
  if (!procs || procs.length === 0) errors.push('processes: debe haber al menos un proceso');
  else {
    const procIds = new Set<string>();
    procs.forEach((pr, pi) => {
      const pat = `processes[${pi}]`;
      if (!isObj(pr) || typeof pr.id !== 'string') return void errors.push(`${pat}: falta "id"`);
      if (procIds.has(pr.id)) errors.push(`${pat}: proceso duplicado "${pr.id}"`);
      procIds.add(pr.id);
      const P = `proceso "${pr.id}"`;

      const arr = pr.arrivals;
      if (!isObj(arr)) errors.push(`${P}.arrivals: faltan las llegadas`);
      else if (arr.type === 'poisson') {
        if (!(typeof arr.ratePerHour === 'number' && arr.ratePerHour > 0)) errors.push(`${P}.arrivals.ratePerHour: debe ser > 0`);
      } else if (arr.type === 'constant') {
        if (!(typeof arr.everyMinutes === 'number' && arr.everyMinutes > 0)) errors.push(`${P}.arrivals.everyMinutes: debe ser > 0`);
      } else errors.push(`${P}.arrivals.type: "poisson" o "constant"`);

      // ficha y optimización: solo se comprueba la forma básica (el simulador no las usa)
      if (pr.doc !== undefined) {
        const doc = pr.doc;
        if (!isObj(doc)) errors.push(`${P}.doc: debe ser un objeto`);
        else {
          if (!isObj(doc.scope) || !Array.isArray(doc.scope.stakeholders)) errors.push(`${P}.doc.scope.stakeholders: debe ser una lista`);
          if (!Array.isArray(doc.fieldwork)) errors.push(`${P}.doc.fieldwork: debe ser una lista`);
          if (!Array.isArray(doc.validations)) errors.push(`${P}.doc.validations: debe ser una lista`);
          if (!isObj(doc.phases)) errors.push(`${P}.doc.phases: debe ser un objeto`);
        }
      }
      if (pr.procedures !== undefined) {
        if (!Array.isArray(pr.procedures)) errors.push(`${P}.procedures: debe ser una lista`);
        else {
          const codes = new Set<string>();
          const stageIdsHere = new Set(Array.isArray(pr.stages) ? pr.stages.map((s) => (isObj(s) ? String(s.id) : '')) : []);
          pr.procedures.forEach((pc, i) => {
            const at = `${P}.procedures[${i}]`;
            if (!isObj(pc) || typeof pc.id !== 'string' || typeof pc.code !== 'string' || typeof pc.title !== 'string') return void errors.push(`${at}: faltan id, code y title`);
            if (codes.has(pc.code)) errors.push(`${at}: el código "${pc.code}" está repetido`);
            codes.add(pc.code);
            if (pc.stageId !== undefined && !stageIdsHere.has(String(pc.stageId))) errors.push(`${at}.stageId: la etapa "${String(pc.stageId)}" no existe`);
            for (const k of ['fieldwork', 'responsibilities', 'glossary', 'annexes', 'steps', 'attempts', 'signoffs', 'changes'])
              if (!Array.isArray(pc[k])) errors.push(`${at}.${k}: debe ser una lista`);
            if (!isObj(pc.done)) errors.push(`${at}.done: debe ser un objeto`);
          });
        }
      }
      if (pr.optimization !== undefined) {
        const o = pr.optimization;
        if (!isObj(o) || !isObj(o.reqReview) || !Array.isArray(o.eliminated) || !isObj(o.speed) || !isObj(o.auto) || !isObj(o.steps))
          errors.push(`${P}.optimization: forma inválida (reqReview, eliminated, speed, auto y steps)`);
      }

      if (pr.attributes !== undefined) {
        if (!isObj(pr.attributes)) errors.push(`${P}.attributes: debe ser un mapa`);
        else for (const [k, d] of Object.entries(pr.attributes)) checkDist(d, `${P}.attributes.${k}`, errors);
      }

      const stages = Array.isArray(pr.stages) ? pr.stages : null;
      if (!stages || stages.length === 0) return void errors.push(`${P}.stages: debe haber al menos una etapa`);
      const ids = new Set<string>();
      stages.forEach((s) => isObj(s) && typeof s.id === 'string' && ids.add(s.id));
      let terminal = false;
      stages.forEach((s, si) => {
        if (!isObj(s) || typeof s.id !== 'string') return void errors.push(`${P}.stages[${si}]: falta "id"`);
        const S = `${P}, etapa "${s.id}"`;
        if (s.duration !== undefined) checkDist(s.duration, `${S}.duration`, errors);
        if (s.duration !== undefined || s.unit !== undefined) {
          if (typeof s.unit !== 'string' || !unitIds.has(s.unit)) errors.push(`${S}: la unidad "${String(s.unit)}" no existe`);
          else if (people && s.automated !== true) {
            const ok = people.some(
              (p) =>
                isObj(p) &&
                ancestors.get(String(p.unit))?.includes(s.unit as string) &&
                (s.role === undefined || p.role === s.role) &&
                (s.skill === undefined || (Array.isArray(p.skills) && p.skills.includes(s.skill))),
            );
            if (!ok) errors.push(`${S}: nadie en "${s.unit}" cumple role/skill (${String(s.role ?? '—')}/${String(s.skill ?? '—')})`);
          }
        }
        if (s.duration === undefined && s.unit === undefined && s.terminal !== true)
          errors.push(`${S}: una etapa no terminal necesita "unit" y "duration"`);
        if (s.automated !== undefined && typeof s.automated !== 'boolean') errors.push(`${S}.automated: debe ser true o false`);
        if (s.automated === true && (s.duration === undefined || s.unit === undefined))
          errors.push(`${S}: una etapa automatizada necesita "unit" (dónde se muestra) y "duration"`);
        if (s.sla !== undefined && !(isObj(s.sla) && typeof s.sla.maxMinutes === 'number' && s.sla.maxMinutes > 0))
          errors.push(`${S}.sla.maxMinutes: debe ser > 0`);
        if (Array.isArray(s.exceptions))
          s.exceptions.forEach((e, j) => {
            const ea = `${S}.exceptions[${j}]`;
            if (!isObj(e)) return void errors.push(`${ea}: inválida`);
            if (!(typeof e.probability === 'number' && e.probability >= 0 && e.probability <= 1)) errors.push(`${ea}.probability: entre 0 y 1`);
            if (e.action !== 'goto') errors.push(`${ea}.action: solo "goto"`);
            else if (!ids.has(String(e.target))) errors.push(`${ea}.target: la etapa "${String(e.target)}" no existe`);
          });
        if (s.terminal === true) {
          terminal = true;
          if (s.next !== undefined) errors.push(`${S}: una etapa terminal no puede tener "next"`);
        } else if (s.next === undefined) errors.push(`${S}: falta "next" (o terminal: true)`);
        else if (typeof s.next === 'string') {
          if (!ids.has(s.next)) errors.push(`${S}.next: la etapa "${s.next}" no existe`);
        } else if (Array.isArray(s.next)) {
          let otherwise = false;
          s.next.forEach((r, j) => {
            const ra = `${S}.next[${j}]`;
            if (!isObj(r) || typeof r.to !== 'string') return void errors.push(`${ra}: falta "to"`);
            if (!ids.has(r.to)) errors.push(`${ra}.to: la etapa "${r.to}" no existe`);
            if (r.otherwise === true) otherwise = true;
            else if (typeof r.when !== 'string') errors.push(`${ra}: necesita "when" u "otherwise: true"`);
            else
              try {
                compileExpr(r.when);
              } catch (err) {
                errors.push(`${ra}.when: ${(err as Error).message}`);
              }
          });
          if (!otherwise) errors.push(`${S}.next: falta una regla final con "otherwise: true"`);
        } else errors.push(`${S}.next: texto o lista de reglas`);
      });
      if (!terminal) errors.push(`${P}: debe haber una etapa con terminal: true`);
    });

    // dependencias entre procesos y requisitos entre procedimientos
    const stagesOf = new Map<string, Set<string>>();
    const procById = new Map<string, Record<string, unknown>>();
    for (const pr of procs) {
      if (!isObj(pr) || typeof pr.id !== 'string') continue;
      procById.set(pr.id, pr);
      stagesOf.set(pr.id, new Set(Array.isArray(pr.stages) ? pr.stages.map((s) => (isObj(s) ? String(s.id) : '')) : []));
    }
    const triggerEdges = new Map<string, string[]>(); // origen → procesos que dispara
    for (const pr of procs) {
      if (!isObj(pr) || typeof pr.id !== 'string' || pr.dependsOn === undefined) continue;
      const P = `proceso "${pr.id}"`;
      if (!Array.isArray(pr.dependsOn)) {
        errors.push(`${P}.dependsOn: debe ser una lista`);
        continue;
      }
      pr.dependsOn.forEach((d, i) => {
        const at = `${P}.dependsOn[${i}]`;
        if (!isObj(d) || typeof d.process !== 'string') return void errors.push(`${at}: falta "process"`);
        if (d.process === pr.id) return void errors.push(`${at}: un proceso no puede depender de sí mismo`);
        if (!procById.has(d.process)) return void errors.push(`${at}: el proceso "${d.process}" no existe`);
        if (d.kind !== 'dispara' && d.kind !== 'requiere') errors.push(`${at}.kind: "dispara" o "requiere"`);
        if (d.atStage !== undefined && !stagesOf.get(d.process)!.has(String(d.atStage)))
          errors.push(`${at}.atStage: la etapa "${String(d.atStage)}" no existe en "${d.process}"`);
        if (d.probability !== undefined && !(typeof d.probability === 'number' && d.probability > 0 && d.probability <= 1))
          errors.push(`${at}.probability: debe estar entre 0 (sin incluir) y 1`);
        if (d.kind === 'dispara') triggerEdges.set(d.process, [...(triggerEdges.get(d.process) ?? []), String(pr.id)]);
      });
    }
    // un ciclo de disparos crearía casos sin fin
    const visiting = new Set<string>();
    const done = new Set<string>();
    const hasCycle = (id: string): boolean => {
      if (visiting.has(id)) return true;
      if (done.has(id)) return false;
      visiting.add(id);
      const bad = (triggerEdges.get(id) ?? []).some(hasCycle);
      visiting.delete(id);
      done.add(id);
      return bad;
    };
    if ([...triggerEdges.keys()].some(hasCycle)) errors.push('dependencias: los procesos que se disparan unos a otros forman un ciclo');

    const pcIds = new Set<string>();
    for (const pr of procs)
      if (isObj(pr) && Array.isArray(pr.procedures)) for (const pc of pr.procedures) if (isObj(pc) && typeof pc.id === 'string') pcIds.add(pc.id);
    const reqEdges = new Map<string, string[]>();
    for (const pr of procs)
      if (isObj(pr) && Array.isArray(pr.procedures))
        for (const pc of pr.procedures) {
          if (!isObj(pc) || typeof pc.id !== 'string' || pc.prerequisites === undefined) continue;
          const at = `procedimiento "${String(pc.code ?? pc.id)}".prerequisites`;
          if (!Array.isArray(pc.prerequisites)) {
            errors.push(`${at}: debe ser una lista`);
            continue;
          }
          for (const r of pc.prerequisites) {
            if (r === pc.id) errors.push(`${at}: un procedimiento no puede ser requisito de sí mismo`);
            else if (!pcIds.has(String(r))) errors.push(`${at}: el procedimiento "${String(r)}" no existe`);
          }
          reqEdges.set(pc.id, pc.prerequisites.map(String));
        }
    const vis2 = new Set<string>();
    const done2 = new Set<string>();
    const cyc2 = (id: string): boolean => {
      if (vis2.has(id)) return true;
      if (done2.has(id)) return false;
      vis2.add(id);
      const bad = (reqEdges.get(id) ?? []).some(cyc2);
      vis2.delete(id);
      done2.add(id);
      return bad;
    };
    if ([...reqEdges.keys()].some(cyc2)) errors.push('procedimientos: los requisitos entre procedimientos forman un ciclo');
  }

  // escenario
  const abs = isObj(raw.scenario) ? raw.scenario.absences : undefined;
  if (Array.isArray(abs))
    abs.forEach((a, i) => {
      if (!isObj(a) || !personIds.has(String(a.person))) errors.push(`scenario.absences[${i}]: la persona "${isObj(a) ? String(a.person) : '?'}" no existe`);
      else if (!Array.isArray(a.days) || !a.days.every((d) => Number.isInteger(d) && d >= 0))
        errors.push(`scenario.absences[${i}].days: lista de días (0 = primer lunes)`);
    });

  return errors.length ? { errors } : { def: raw as unknown as CompanyDef, errors };
}
