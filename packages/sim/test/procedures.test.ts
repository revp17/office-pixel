import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  approveProcedure,
  companyToYaml,
  completeProcStep,
  distinctOperators,
  fichaMarkdown,
  isPersonName,
  lintStep,
  looksMultiAction,
  newProcedure,
  parseCompany,
  procChecklist,
  procStepUnlocked,
  procedureCoverage,
  procedureMarkdown,
  procedureStatus,
  reopenProcStep,
  simulateCompany,
  startsWithVerb,
  stepSentence,
  uncoveredExceptions,
  validateCompany,
  type CompanyDef,
  type OrgProcessDef,
  type Procedure,
} from '../src';

const text = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');
const credito = (d: CompanyDef) => d.processes.find((p) => p.id === 'solicitud_credito')!;
/** La empresa de ejemplo sin su procedimiento, para construir los procedimientos desde cero. */
const fresh = (): CompanyDef => {
  const d = parseCompany(text).def!;
  delete credito(d).procedures;
  return d;
};
const TODAY = '2026-10-24';

/** Un procedimiento completo y válido para la etapa KYC. */
function fill(d: CompanyDef, proc: OrgProcessDef): Procedure {
  const pc = newProcedure(d, proc, 'kyc');
  pc.fieldwork.push({
    id: 'f1',
    operator: 'Pablo Reyes',
    method: 'en_vivo',
    date: '2026-10-20',
    notes: 'Abre el visor de documentos y compara con el padrón.',
    exceptions: [
      { id: 'e1', text: 'El cliente no envía el documento' },
      { id: 'e2', text: 'El sistema de padrón no responde' },
    ],
    tricks: ['Si el nombre tiene tilde, buscar también sin tilde'],
  });
  Object.assign(pc, {
    objective: 'Validar la identidad del solicitante antes de evaluar el riesgo.',
    startsWhen: 'Llega la solicitud capturada',
    endsWhen: 'La identidad queda validada o rechazada',
  });
  pc.responsibilities.push({ role: 'Operador KYC', description: 'Ejecuta la validación' }); // ya viene el rol de la etapa
  pc.responsibilities = [{ role: 'operador_kyc', description: 'Ejecuta la validación' }];
  pc.glossary.push({ term: 'KYC', definition: 'Conoce a tu cliente' });
  pc.steps.push(
    { id: 's1', actor: 'operador_kyc', action: 'Abrir la solicitud en el visor de documentos', tool: 'Visor de documentos', result: 'Solicitud visible con sus anexos', alternatives: [{ id: 'a1', condition: 'el cliente no envía el documento', action: 'Solicitarlo por correo y pausar el caso', exceptionId: 'e1' }] },
    { id: 's2', actor: 'operador_kyc', action: 'Comparar el documento con el padrón', tool: 'Sistema de padrón', result: 'Coincidencia confirmada', warning: { kind: 'critico', text: 'No continuar sin coincidencia exacta' }, alternatives: [{ id: 'a2', condition: 'el padrón no responde', action: 'Reintentar en 5 minutos y avisar al supervisor', exceptionId: 'e2' }], image: { src: 'data:image/jpeg;base64,AAAA', caption: 'Pantalla del padrón', marks: [{ kind: 'circle', x: 0.4, y: 0.5 }] } },
  );
  pc.attempts.push({ id: 't1', tester: 'Elena Ríos', date: '2026-10-22', completed: true, questions: 0 });
  pc.signoffs.push({ id: 'g1', name: 'Pablo Reyes', status: 'conforme', date: '2026-10-23' });
  return pc;
}

describe('redacción acción-resultado', () => {
  it('reconoce verbos de acción (infinitivo o imperativo) y rechaza actores o artículos', () => {
    for (const ok of ['Ingresar al sistema', 'verificar el monto', 'Descargar el formato', 'Aprobar la solicitud', 'Registra la factura', 'Haz clic en Guardar']) expect(startsWithVerb(ok)).toBe(true);
    for (const bad of ['El analista registra la factura', 'La factura', '', 'Factura registrada']) expect(startsWithVerb(bad)).toBe(false);
  });
  it('detecta pasos que mezclan varias acciones', () => {
    expect(looksMultiAction('Registrar la factura y generar el código')).toBe(true);
    expect(looksMultiAction('Registrar la factura; generar el código')).toBe(true);
    expect(looksMultiAction('Registrar la factura en el módulo SAP')).toBe(false);
    expect(looksMultiAction('Revisar pan y mantequilla')).toBe(false);
  });
  it('un actor con nombre propio es un error: se usa el puesto', () => {
    const d = fresh();
    expect(isPersonName(d, 'Pablo Reyes')).toBe(true);
    expect(isPersonName(d, 'Pablo')).toBe(true);
    expect(isPersonName(d, 'operador_kyc')).toBe(false);
    const issues = lintStep(d, { id: 's', actor: 'Pablo Reyes', action: 'Revisar', result: 'ok', alternatives: [] });
    expect(issues.some((i) => i.level === 'error' && i.msg.includes('nombre propio'))).toBe(true);
  });
  it('señala acción sin verbo, sin resultado y frases largas', () => {
    const d = fresh();
    const lint = (s: Partial<Procedure['steps'][number]>) => lintStep(d, { id: 's', actor: 'Analista', action: 'Revisar el documento', result: 'ok', alternatives: [], ...s });
    expect(lint({}).filter((i) => i.level === 'error')).toEqual([]);
    expect(lint({ action: 'El analista revisa' }).some((i) => i.msg.includes('verbo'))).toBe(true);
    expect(lint({ result: '' }).some((i) => i.msg.includes('resultado'))).toBe(true);
    expect(lint({ action: 'Revisar ' + 'x'.repeat(150) }).some((i) => i.level === 'warn' && i.msg.includes('larga'))).toBe(true);
    expect(lint({ tool: '' }).some((i) => i.level === 'info')).toBe(true);
  });
  it('compone la frase del paso', () => {
    expect(stepSentence({ id: 's', actor: 'Analista de Cuentas', action: 'Registrar la factura', tool: 'SAP ERP', result: 'Código generado', alternatives: [] })).toBe(
      'Analista de Cuentas — Registrar la factura · Herramienta: SAP ERP · Resultado: Código generado',
    );
  });
});

describe('los 5 pasos de levantamiento, en orden', () => {
  it('un procedimiento nuevo está asociado a una etapa, con código y su rol como responsabilidad', () => {
    const d = fresh();
    const pc = newProcedure(d, credito(d), 'kyc');
    expect(pc.code).toBe('PRO-SC-001');
    expect(pc.stageId).toBe('kyc');
    expect(pc.responsibilities[0].role).toBe('operador_kyc');
    expect(pc.title).toContain('Validación KYC');
    credito(d).procedures = [pc];
    expect(newProcedure(d, credito(d), 'captura').code).toBe('PRO-SC-002');
  });

  it('no se puede saltar un paso ni completarlo con la lista incompleta', () => {
    const d = fresh();
    const pc = newProcedure(d, credito(d), 'kyc');
    expect(procStepUnlocked(pc, 2)).toBe(false);
    expect(completeProcStep(d, pc, 3, TODAY).reason).toContain('paso 2');
    expect(completeProcStep(d, pc, 1, TODAY).ok).toBe(false);
  });

  it('flujo completo y publicación con versión y control de cambios', () => {
    const d = fresh();
    const proc = credito(d);
    const pc = fill(d, proc);
    proc.procedures = [pc];
    for (const n of [1, 2, 3, 4, 5]) {
      const open = procChecklist(d, pc, n).filter((c) => !c.done);
      expect(open).toEqual([]);
      expect(completeProcStep(d, pc, n, TODAY).ok).toBe(true);
    }
    expect(procedureStatus(pc)).toBe('borrador');
    expect(approveProcedure(pc, TODAY).ok).toBe(true);
    expect(procedureStatus(pc)).toBe('publicado');
    expect(pc.version).toBe('1.0');
    expect(pc.changes).toEqual([{ version: '1.0', date: TODAY, description: 'Versión inicial.' }]);
    // una nueva versión exige describir el cambio
    expect(approveProcedure(pc, TODAY).ok).toBe(false);
    expect(approveProcedure(pc, '2026-11-01', 'Se añade el caso del padrón caído').ok).toBe(true);
    expect(pc.version).toBe('1.1');
    expect(pc.changes).toHaveLength(2);
  });

  it('el paso 1 exige observación en vivo, excepciones y trucos (o confirmar que no hay)', () => {
    const d = fresh();
    const pc = newProcedure(d, credito(d), 'kyc');
    pc.fieldwork.push({ id: 'f', operator: 'Irene Vidal', method: 'entrevista', exceptions: [], tricks: [] });
    const done = () => procChecklist(d, pc, 1).map((c) => c.done);
    expect(done()).toEqual([true, false, false, false]);
    pc.fieldwork[0].method = 'en_vivo';
    pc.fieldwork[0].exceptions.push({ id: 'x', text: 'Falla el sistema' });
    pc.noTricks = true;
    expect(done()).toEqual([true, true, true, true]);
  });

  it('el paso 2 rechaza puestos que son nombres propios', () => {
    const d = fresh();
    const pc = fill(d, credito(d));
    pc.responsibilities = [{ role: 'Pablo Reyes' }];
    expect(procChecklist(d, pc, 2).find((c) => c.label.includes('no nombres'))!.done).toBe(false);
  });

  it('el paso 3 exige cubrir cada excepción del levantamiento con un camino alternativo', () => {
    const d = fresh();
    const pc = fill(d, credito(d));
    expect(uncoveredExceptions(pc)).toEqual([]);
    pc.steps[1].alternatives = [];
    expect(uncoveredExceptions(pc).map((e) => e.id)).toEqual(['e2']);
    expect(procChecklist(d, pc, 3).find((c) => c.label.includes('Faltan caminos'))!.done).toBe(false);
  });

  it('el paso 3 exige que cada actor esté en las responsabilidades', () => {
    const d = fresh();
    const pc = fill(d, credito(d));
    pc.steps[0].actor = 'supervisor';
    expect(procChecklist(d, pc, 3).find((c) => c.label.includes('lista de responsabilidades'))!.done).toBe(false);
  });

  it('el paso 4 exige captura con marcas si es digital y advertencias (o confirmar que no hay)', () => {
    const d = fresh();
    const pc = fill(d, credito(d));
    expect(procChecklist(d, pc, 4).every((c) => c.done)).toBe(true);
    pc.steps[1].image!.marks = [];
    expect(procChecklist(d, pc, 4).some((c) => !c.done)).toBe(true);
    pc.digital = false;
    expect(procChecklist(d, pc, 4).every((c) => c.done)).toBe(true);
    delete pc.steps[1].warning;
    expect(procChecklist(d, pc, 4).some((c) => !c.done)).toBe(true);
    pc.noWarnings = true;
    expect(procChecklist(d, pc, 4).every((c) => c.done)).toBe(true);
  });

  it('el paso 5: la prueba del novato debe terminar sin preguntas y firman todos los operadores', () => {
    const d = fresh();
    const pc = fill(d, credito(d));
    expect(procChecklist(d, pc, 5).every((c) => c.done)).toBe(true);
    pc.attempts.push({ id: 't2', tester: 'Tomás Ortega', completed: true, questions: 3 });
    expect(procChecklist(d, pc, 5)[0].done).toBe(false); // cuenta la última prueba
    pc.attempts.push({ id: 't3', tester: 'Tomás Ortega', completed: true, questions: 0 });
    expect(procChecklist(d, pc, 5)[0].done).toBe(true);
    pc.fieldwork.push({ id: 'f2', operator: 'Irene Vidal', method: 'entrevista', exceptions: [], tricks: [] });
    expect(distinctOperators(pc)).toEqual(['Pablo Reyes', 'Irene Vidal']);
    expect(procChecklist(d, pc, 5)[1].done).toBe(false);
    pc.signoffs.push({ id: 'g2', name: 'irene vidal', status: 'observado' });
    expect(procChecklist(d, pc, 5)[1].done).toBe(false);
    pc.signoffs[1].status = 'conforme';
    expect(procChecklist(d, pc, 5)[1].done).toBe(true);
  });

  it('reabrir un paso reabre los posteriores y el procedimiento vuelve a borrador', () => {
    const d = fresh();
    const pc = fill(d, credito(d));
    for (const n of [1, 2, 3, 4, 5]) completeProcStep(d, pc, n, TODAY);
    approveProcedure(pc, TODAY);
    reopenProcStep(pc, 3);
    expect(Object.keys(pc.done)).toEqual(['1', '2']);
    expect(procedureStatus(pc)).toBe('borrador');
  });
});

describe('integración con el proceso', () => {
  it('un procedimiento válido no rompe la empresa y no altera la simulación', () => {
    const d = fresh();
    const proc = credito(d);
    proc.procedures = [fill(d, proc)];
    expect(validateCompany(d).errors).toEqual([]);
    const clean = fresh();
    expect(simulateCompany(d, { seed: 6, horizonDays: 3 }).events).toEqual(simulateCompany(clean, { seed: 6, horizonDays: 3 }).events);
  });
  it('sobrevive al YAML', () => {
    const d = fresh();
    credito(d).procedures = [fill(d, credito(d))];
    expect(parseCompany(companyToYaml(d)).def).toEqual(d);
  });
  it('la validación señala etapas inexistentes y códigos repetidos', () => {
    const d = fresh();
    const proc = credito(d);
    const a = fill(d, proc);
    const b = { ...structuredClone(a), id: 'otro' };
    b.stageId = 'no_existe';
    proc.procedures = [a, b];
    const errs = validateCompany(d).errors.join('|');
    expect(errs).toContain('no_existe');
    expect(errs).toContain('repetido');
  });
  it('la cobertura cuenta procedimientos por etapa', () => {
    const d = fresh();
    const proc = credito(d);
    const pc = fill(d, proc);
    proc.procedures = [pc];
    for (const n of [1, 2, 3, 4, 5]) completeProcStep(d, pc, n, TODAY);
    approveProcedure(pc, TODAY);
    const cov = procedureCoverage(proc);
    expect(cov.find((c) => c.stageId === 'kyc')).toMatchObject({ procedures: 1, published: 1 });
    expect(cov.find((c) => c.stageId === 'captura')).toMatchObject({ procedures: 0, published: 0 });
  });
  it('la ficha del proceso lista sus procedimientos', () => {
    const d = fresh();
    const proc = credito(d);
    const pc = fill(d, proc);
    proc.procedures = [pc];
    const md = fichaMarkdown(d, proc);
    expect(md).toMatch(/## \d\. Procedimientos asociados/);
    expect(md).toContain('PRO-SC-001');
    expect(md).toContain('Validación KYC');
  });
});

describe('documento del procedimiento', () => {
  it('incluye los 5 bloques, los pasos con advertencias y alternativas, y la validación', () => {
    const d = fresh();
    const proc = credito(d);
    const pc = fill(d, proc);
    proc.procedures = [pc];
    for (const n of [1, 2, 3, 4, 5]) completeProcStep(d, pc, n, TODAY);
    approveProcedure(pc, TODAY);
    const md = procedureMarkdown(d, proc, pc);
    for (const h of ['# Procedimiento PRO-SC-001', '## 1. Objetivo y alcance', '## 2. Responsabilidades', '## 3. Definiciones y glosario', '## 4. Desarrollo paso a paso', '## 5. Anexos y control de cambios', '## 6. Validación']) {
      expect(md).toContain(h);
    }
    expect(md).toContain('1. **operador_kyc** — Abrir la solicitud en el visor de documentos');
    expect(md).toContain('🛑 **Alerta crítica:** No continuar sin coincidencia exacta');
    expect(md).toContain('- Si el padrón no responde: Reintentar en 5 minutos');
    expect(md).toContain('Si el nombre tiene tilde');
    expect(md).toContain('| 1.0 | 2026-10-24 | Versión inicial. |');
    expect(md).toContain('| Elena Ríos | 2026-10-22 | Sí | 0 |');
    expect(md).toContain('Versión 1.0 · publicado el 2026-10-24');
  });
});

describe('ejemplo Banco Pixel', () => {
  it('trae un procedimiento publicado cuyos 5 pasos cumplen todas las listas de comprobación', () => {
    const d = parseCompany(text).def!;
    expect(validateCompany(d).errors).toEqual([]);
    const pc = credito(d).procedures![0];
    expect(pc.code).toBe('PRO-SC-001');
    expect(pc.stageId).toBe('kyc');
    expect(procedureStatus(pc)).toBe('publicado');
    for (const n of [1, 2, 3, 4, 5]) expect(procChecklist(d, pc, n).filter((c) => !c.done)).toEqual([]);
    for (const s of pc.steps) expect(lintStep(d, s).filter((i) => i.level === 'error')).toEqual([]);
    expect(uncoveredExceptions(pc)).toEqual([]);
  });
});
