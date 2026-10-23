import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCompany, simulateCompany, validateCompany, type CompanyDef } from '@office-pixel/sim';
import { applyRetire, moveTargets, retirePlan } from '../src/config/retirar';
import { findUnit } from '../src/config/model';

const load = (name: string): CompanyDef => parseCompany(readFileSync(new URL(`../../../examples/${name}.yaml`, import.meta.url), 'utf8')).def!;
const banco = () => load('banco_pixel');
const proc = (d: CompanyDef, id: string) => d.processes.find((p) => p.id === id)!;

describe('quitar un área de una empresa ya configurada', () => {
  it('el plan lista personas, etapas y procedimientos que dependen del área', () => {
    const plan = retirePlan(banco(), 'operaciones'); // KYC + Formalización
    expect(plan.people.length).toBe(8);
    expect(plan.stages.map((s) => s.stage).sort()).toEqual(['desembolso', 'formalizacion', 'investigacion', 'kyc']);
    expect(plan.stages.find((s) => s.stage === 'desembolso')!.effect).toBe('cierre');
    expect(plan.procedures).toBe(1);
    expect(plan.removedProcesses).toEqual([]);
  });

  it('mover: las personas y etapas pasan a otra área y la empresa sigue siendo válida y simulable', () => {
    const d = banco();
    applyRetire(d, 'operaciones', { mode: 'move', to: 'atencion' });
    expect(findUnit(d.units, 'operaciones')).toBeUndefined();
    expect(findUnit(d.units, 'kyc')).toBeUndefined(); // sus subáreas también se van
    expect(d.people.length).toBe(32);
    expect(d.people.every((p) => findUnit(d.units, p.unit))).toBe(true);
    expect(proc(d, 'solicitud_credito').stages.find((s) => s.id === 'kyc')!.unit).toBe('atencion');
    expect(validateCompany(d).errors).toEqual([]);
    expect(simulateCompany(d, { seed: 1, horizonDays: 3 }).events.length).toBeGreaterThan(0);
  });

  it('eliminar: borra personas, reconecta el flujo y deja cierres sin área', () => {
    const d = banco();
    applyRetire(d, 'operaciones', { mode: 'delete' });
    expect(d.people.length).toBe(24);
    const p = proc(d, 'solicitud_credito');
    expect(p.stages.some((s) => s.id === 'kyc' || s.id === 'formalizacion')).toBe(false);
    expect(p.stages.find((s) => s.id === 'captura')!.next).toBeDefined();
    const fin = p.stages.find((s) => s.id === 'desembolso')!;
    expect(fin.terminal).toBe(true);
    expect(fin.unit).toBeUndefined();
    // el procedimiento del KYC queda sin etapa, pero sigue existiendo
    expect(p.procedures![0].stageId).toBeUndefined();
    expect(d.meetings!.some((m) => m.unit === 'operaciones')).toBe(false);
    expect(validateCompany(d).errors).toEqual([]);
    expect(simulateCompany(d, { seed: 1, horizonDays: 5 }).metrics.completed).toBeGreaterThan(0);
  });

  it('eliminar el área de la primera etapa: la siguiente pasa a ser la entrada', () => {
    const d = banco();
    applyRetire(d, 'comercial', { mode: 'delete' }); // Ventas hace «captura»
    const p = proc(d, 'solicitud_credito');
    expect(p.stages[0].id).toBe('kyc');
    expect(p.stages.some((s) => s.id === 'captura')).toBe(false);
    // la excepción «documento ilegible» apuntaba a captura: ya no hay a dónde volver
    expect(p.stages.find((s) => s.id === 'kyc')!.exceptions).toBeUndefined();
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('un proceso que se queda sin etapas de trabajo se borra, y las dependencias que lo apuntaban se limpian', () => {
    const d = load('plantilla_pequena_ferreteria');
    expect(proc(d, 'mantenimiento_local').dependsOn).toBeDefined(); // depende de control_acceso
    const plan = retirePlan(d, 'seguridad');
    expect(plan.removedProcesses).toEqual(['control_acceso']);
    applyRetire(d, 'seguridad', { mode: 'delete' });
    expect(d.processes.some((p) => p.id === 'control_acceso')).toBe(false);
    expect(proc(d, 'mantenimiento_local').dependsOn).toBeUndefined();
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('quitar una subárea no toca a las demás de su área', () => {
    const d = banco();
    applyRetire(d, 'senior', { mode: 'delete' });
    expect(findUnit(d.units, 'senior')).toBeUndefined();
    expect(findUnit(d.units, 'analisis')).toBeDefined();
    expect(proc(d, 'solicitud_credito').stages.some((s) => s.id === 'evaluacion_senior')).toBe(false);
    expect(validateCompany(d).errors).toEqual([]);
  });

  it('las plantillas operativas también se pueden recortar (quitar mantenimiento)', () => {
    const d = load('plantilla_mediana_distribuidora');
    applyRetire(d, 'mantenimiento', { mode: 'delete' });
    // solo queda su primera etapa (la solicitud, de Logística), que cierra sin pasar por el taller
    expect(proc(d, 'orden_mantenimiento').stages.filter((s) => !s.terminal).map((s) => s.id)).toEqual(['solicitud']);
    expect(validateCompany(d).errors).toEqual([]);
    expect(simulateCompany(d, { seed: 2, horizonDays: 5 }).metrics.completed).toBeGreaterThan(0);
  });

  it('los destinos posibles excluyen al área y a sus subáreas', () => {
    const ids = moveTargets(banco(), 'operaciones').map((t) => t.unit.id);
    expect(ids).not.toContain('operaciones');
    expect(ids).not.toContain('kyc');
    expect(ids).toContain('atencion');
  });
});
