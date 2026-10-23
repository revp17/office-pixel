import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  dependencyEdges,
  dependencyLevels,
  dependencyText,
  dropDanglingDependencies,
  ensureOptimization,
  fichaMarkdown,
  newProcedure,
  parseCompany,
  prerequisitesOf,
  procedureMarkdown,
  simulateCompany,
  unpublishedPrerequisites,
  validateCompany,
  variantCompany,
  type CompanyDef,
} from '../src';

const text = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');
const base = (): CompanyDef => parseCompany(text).def!;

/** solicitud_credito dispara un reclamo al desembolsar (con la probabilidad dada) */
const linked = (probability?: number, atStage: string | null = 'desembolso'): CompanyDef => {
  const d = base();
  const rec = d.processes.find((p) => p.id === 'reclamo_cliente')!;
  rec.dependsOn = [{ process: 'solicitud_credito', kind: 'dispara', ...(atStage ? { atStage } : {}), ...(probability !== undefined ? { probability } : {}) }];
  return d;
};
/** casos de `proc` creados por un disparo (cause) o, con cause = undefined, todos */
const created = (d: CompanyDef, proc: string, cause?: boolean) =>
  simulateCompany(d, { seed: 3, horizonDays: 8 }).events.filter(
    (e) => e.type === 'case.created' && e.process === proc && (cause === undefined || !!e.cause === cause),
  ).length;

describe('dependencias entre procesos: simulación', () => {
  it('el ejemplo sin dependencias se comporta como antes', () => {
    expect(dependencyEdges(base())).toEqual([]);
    const r = simulateCompany(base(), { seed: 3, horizonDays: 8 });
    expect(r.events.some((e) => e.type === 'case.created' && e.cause)).toBe(false);
  });

  it('"dispara" crea un caso del proceso dependiente por cada caso que termina la etapa', () => {
    const d = linked();
    const r = simulateCompany(d, { seed: 3, horizonDays: 8 });
    const origin = r.events.filter((e) => e.type === 'case.completed' && e.caseId.startsWith('solicitud_credito#') && e.stage === 'desembolso').length;
    const spawned = r.events.filter((e) => e.type === 'case.created' && e.cause);
    expect(origin).toBeGreaterThan(0);
    expect(spawned.length).toBe(origin);
    for (const e of spawned) if (e.type === 'case.created') expect(e.cause).toMatch(/^solicitud_credito#/);
    expect(created(d, 'reclamo_cliente')).toBeGreaterThan(created(base(), 'reclamo_cliente'));
  });

  it('con probabilidad baja nacen menos casos, y sin etapa se dispara al completarse cualquier caso', () => {
    const all = created(linked(1), 'reclamo_cliente', true);
    const some = created(linked(0.3), 'reclamo_cliente', true);
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(all);
    // también cuentan los casos rechazados, así que son más
    expect(created(linked(1, null), 'reclamo_cliente', true)).toBeGreaterThan(all);
  });

  it('"requiere" no crea casos', () => {
    const d = linked();
    d.processes.find((p) => p.id === 'reclamo_cliente')!.dependsOn![0].kind = 'requiere';
    expect(created(d, 'reclamo_cliente', true)).toBe(0);
  });

  it('es determinista con la misma semilla', () => {
    const a = simulateCompany(linked(0.5), { seed: 9, horizonDays: 5 });
    const b = simulateCompany(linked(0.5), { seed: 9, horizonDays: 5 });
    expect(a.events).toEqual(b.events);
  });
});

describe('dependencias entre procesos: validación y consulta', () => {
  it('rechaza procesos, etapas, probabilidades y tipos inválidos', () => {
    const d = linked();
    const dep = d.processes[1].dependsOn![0];
    dep.process = 'nadie';
    expect(validateCompany(d).errors.join('\n')).toMatch(/"nadie" no existe/);
    dep.process = 'solicitud_credito';
    dep.atStage = 'inexistente';
    expect(validateCompany(d).errors.join('\n')).toMatch(/atStage/);
    dep.atStage = 'kyc';
    dep.probability = 0;
    expect(validateCompany(d).errors.join('\n')).toMatch(/probability/);
    dep.probability = 1;
    (dep as { kind: string }).kind = 'otro';
    expect(validateCompany(d).errors.join('\n')).toMatch(/kind/);
    dep.kind = 'dispara';
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('rechaza depender de sí mismo y los ciclos de disparos (pero no de "requiere")', () => {
    const d = linked();
    d.processes[0].dependsOn = [{ process: 'reclamo_cliente', kind: 'dispara' }];
    expect(validateCompany(d).errors.join('\n')).toMatch(/ciclo/);
    d.processes[0].dependsOn[0].kind = 'requiere';
    expect(validateCompany(d).errors).toEqual([]);
    d.processes[0].dependsOn = [{ process: 'solicitud_credito', kind: 'requiere' }];
    expect(validateCompany(d).errors.join('\n')).toMatch(/sí mismo/);
  });

  it('calcula columnas y describe la dependencia', () => {
    const d = linked(0.4);
    const lv = dependencyLevels(d);
    expect(lv.get('solicitud_credito')).toBe(0);
    expect(lv.get('reclamo_cliente')).toBe(1);
    const e = dependencyEdges(d)[0];
    expect(dependencyText(d, e, 'to')).toMatch(/Nace de «Solicitud de crédito» al terminar «Desembolso» \(en el 40 %/);
    expect(dependencyText(d, e, 'from')).toMatch(/Dispara «Reclamo de cliente»/);
  });

  it('al borrar un proceso o una etapa se limpian las referencias colgantes', () => {
    const d = linked();
    const origin = d.processes.find((p) => p.id === 'solicitud_credito')!;
    origin.stages = origin.stages.filter((s) => s.id !== 'desembolso');
    dropDanglingDependencies(d);
    expect(d.processes.find((p) => p.id === 'reclamo_cliente')!.dependsOn![0].atStage).toBeUndefined();
    d.processes = d.processes.filter((p) => p.id !== 'solicitud_credito');
    dropDanglingDependencies(d);
    expect(d.processes[0].dependsOn).toBeUndefined();
  });

  it('una variante que elimina la etapa disparadora sigue siendo válida (dispara al completarse)', () => {
    const d = linked(1, 'kyc');
    ensureOptimization(d.processes.find((p) => p.id === 'solicitud_credito')!).eliminated = ['kyc'];
    const v = variantCompany(d, 'solicitud_credito', 'step2');
    expect(v.processes.find((p) => p.id === 'solicitud_credito')!.stages.some((s) => s.id === 'kyc')).toBe(false);
    expect(validateCompany(v).errors).toEqual([]);
  });

  it('la ficha lista las dependencias del proceso en ambos sentidos', () => {
    const d = linked(0.5);
    expect(fichaMarkdown(d, d.processes.find((p) => p.id === 'reclamo_cliente')!)).toMatch(/Nace de «Solicitud de crédito»/);
    expect(fichaMarkdown(d, d.processes.find((p) => p.id === 'solicitud_credito')!)).toMatch(/Dispara «Reclamo de cliente»/);
  });
});

describe('requisitos entre procedimientos', () => {
  const two = () => {
    const d = base();
    const a = d.processes[0].procedures![0]; // PRO-SC-001, publicado
    const b = newProcedure(d, d.processes[1], d.processes[1].stages[0].id, 'Atender el reclamo');
    d.processes[1].procedures = [b];
    return { d, a, b };
  };

  it('resuelve requisitos y dependientes, y avisa de los no publicados', () => {
    const { d, a, b } = two();
    a.prerequisites = [b.id];
    expect(prerequisitesOf(d, a).map((r) => r.pc.id)).toEqual([b.id]);
    expect(unpublishedPrerequisites(d, a).map((r) => r.pc.id)).toEqual([b.id]);
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('rechaza requisitos inexistentes, propios y en ciclo', () => {
    const { d, a, b } = two();
    a.prerequisites = ['fantasma'];
    expect(validateCompany(d).errors.join('\n')).toMatch(/"fantasma" no existe/);
    a.prerequisites = [a.id];
    expect(validateCompany(d).errors.join('\n')).toMatch(/de sí mismo/);
    a.prerequisites = [b.id];
    b.prerequisites = [a.id];
    expect(validateCompany(d).errors.join('\n')).toMatch(/ciclo/);
  });

  it('el documento Markdown muestra los requisitos y a quién alimenta', () => {
    const { d, a, b } = two();
    b.prerequisites = [a.id];
    expect(procedureMarkdown(d, d.processes[1], b)).toMatch(/Requisitos previos[\s\S]*PRO-SC-001/);
    expect(procedureMarkdown(d, d.processes[0], a)).toMatch(/Lo necesitan después[\s\S]*Atender el reclamo/);
  });

  it('al borrar un procedimiento desaparecen los requisitos que lo apuntaban', () => {
    const { d, a, b } = two();
    a.prerequisites = [b.id];
    d.processes[1].procedures = [];
    dropDanglingDependencies(d);
    expect(a.prerequisites).toBeUndefined();
  });
});
