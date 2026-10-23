import { parse } from 'yaml';
import { checkDist } from '../kernel/dist';
import { compileExpr } from '../kernel/expr';
import type { ProcessDef } from './types';

export interface ParseResult {
  def?: ProcessDef;
  errors: string[];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseProcess(yamlText: string): ParseResult {
  let raw: unknown;
  try {
    raw = parse(yamlText);
  } catch (e) {
    return { errors: [`YAML inválido: ${(e as Error).message}`] };
  }
  return validateProcess(raw);
}

export function validateProcess(raw: unknown): ParseResult {
  const errors: string[] = [];
  if (!isObj(raw)) return { errors: ['La definición debe ser un objeto YAML/JSON'] };

  if (typeof raw.process !== 'string' || !raw.process) errors.push('process: falta el nombre del proceso');

  const arr = raw.arrivals;
  if (!isObj(arr)) errors.push('arrivals: falta la definición de llegadas');
  else if (arr.type === 'poisson') {
    if (typeof arr.ratePerHour !== 'number' || arr.ratePerHour <= 0) errors.push('arrivals.ratePerHour: debe ser un número > 0');
  } else if (arr.type === 'constant') {
    if (typeof arr.everyMinutes !== 'number' || arr.everyMinutes <= 0) errors.push('arrivals.everyMinutes: debe ser un número > 0');
  } else errors.push('arrivals.type: debe ser "poisson" o "constant"');

  if (raw.attributes !== undefined) {
    if (!isObj(raw.attributes)) errors.push('attributes: debe ser un mapa nombre → distribución');
    else for (const [k, d] of Object.entries(raw.attributes)) checkDist(d, `attributes.${k}`, errors);
  }

  const resourceIds = new Set<string>();
  if (raw.resources !== undefined) {
    if (!Array.isArray(raw.resources)) errors.push('resources: debe ser una lista');
    else
      raw.resources.forEach((r, i) => {
        const at = `resources[${i}]`;
        if (!isObj(r) || typeof r.id !== 'string') return void errors.push(`${at}: falta "id"`);
        if (resourceIds.has(r.id)) errors.push(`${at}: id duplicado "${r.id}"`);
        resourceIds.add(r.id);
        if (!Number.isInteger(r.count) || (r.count as number) < 1) errors.push(`${at}.count: debe ser un entero ≥ 1`);
      });
  }

  const stageIds = new Set<string>();
  const stages = Array.isArray(raw.stages) ? raw.stages : null;
  if (!stages || stages.length === 0) errors.push('stages: debe haber al menos una etapa');
  else {
    stages.forEach((s) => {
      if (isObj(s) && typeof s.id === 'string') {
        if (stageIds.has(s.id)) errors.push(`stages: id duplicado "${s.id}"`);
        stageIds.add(s.id);
      }
    });
    let hasTerminal = false;
    stages.forEach((s, i) => {
      const at = `stages[${i}]`;
      if (!isObj(s) || typeof s.id !== 'string') return void errors.push(`${at}: falta "id"`);
      const id = `stage "${s.id}"`;
      if (s.resource !== undefined && !resourceIds.has(String(s.resource)))
        errors.push(`${id}: el recurso "${String(s.resource)}" no existe`);
      if (s.duration !== undefined) checkDist(s.duration, `${id}.duration`, errors);
      if (s.wip !== undefined && !(isObj(s.wip) && typeof s.wip.limit === 'number' && s.wip.limit > 0))
        errors.push(`${id}.wip.limit: debe ser un número > 0`);
      if (s.sla !== undefined && !(isObj(s.sla) && typeof s.sla.maxMinutes === 'number' && s.sla.maxMinutes > 0))
        errors.push(`${id}.sla.maxMinutes: debe ser un número > 0`);

      if (Array.isArray(s.exceptions))
        s.exceptions.forEach((e, j) => {
          const ea = `${id}.exceptions[${j}]`;
          if (!isObj(e)) return void errors.push(`${ea}: inválida`);
          if (typeof e.probability !== 'number' || e.probability < 0 || e.probability > 1)
            errors.push(`${ea}.probability: debe estar entre 0 y 1`);
          if (e.action !== 'goto') errors.push(`${ea}.action: solo se admite "goto"`);
          else if (!stageIds.has(String(e.target))) errors.push(`${ea}.target: la etapa "${String(e.target)}" no existe`);
        });

      if (s.terminal === true) {
        hasTerminal = true;
        if (s.next !== undefined) errors.push(`${id}: una etapa terminal no puede tener "next"`);
      } else if (s.next === undefined) errors.push(`${id}: falta "next" (o márcala con terminal: true)`);
      else if (typeof s.next === 'string') {
        if (!stageIds.has(s.next)) errors.push(`${id}.next: la etapa "${s.next}" no existe`);
      } else if (Array.isArray(s.next)) {
        let hasOtherwise = false;
        s.next.forEach((r, j) => {
          const ra = `${id}.next[${j}]`;
          if (!isObj(r) || typeof r.to !== 'string') return void errors.push(`${ra}: falta "to"`);
          if (!stageIds.has(r.to)) errors.push(`${ra}.to: la etapa "${r.to}" no existe`);
          if (r.otherwise === true) hasOtherwise = true;
          else if (typeof r.when !== 'string') errors.push(`${ra}: necesita "when" u "otherwise: true"`);
          else {
            try {
              compileExpr(r.when);
            } catch (err) {
              errors.push(`${ra}.when: ${(err as Error).message}`);
            }
          }
        });
        if (!hasOtherwise) errors.push(`${id}.next: falta una regla final con "otherwise: true"`);
      } else errors.push(`${id}.next: debe ser un texto o una lista de reglas`);
    });
    if (!hasTerminal) errors.push('stages: debe haber al menos una etapa con terminal: true');
  }

  return errors.length ? { errors } : { def: raw as unknown as ProcessDef, errors };
}
