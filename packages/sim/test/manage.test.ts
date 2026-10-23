import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AUTO_ACTOR,
  PHASES,
  STEPS,
  applyAuto,
  applySpeed,
  buildVariants,
  captureBaseline,
  companyToYaml,
  compareVariants,
  completeStep,
  currentStep,
  docChecklist,
  eliminateStages,
  ensureDoc,
  ensureOptimization,
  fichaMarkdown,
  measureVariant,
  meanOfDist,
  parseCompany,
  reopenStep,
  scaleDist,
  simulateCompany,
  stepChecklist,
  stepUnlocked,
  validateCompany,
  type CompanyDef,
  type OrgProcessDef,
} from '../src';

const text = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');
const fresh = (): CompanyDef => parseCompany(text).def!;
const credito = (d: CompanyDef) => d.processes.find((p) => p.id === 'solicitud_credito')!;
const O = { seeds: [1, 2, 3], days: 5 };

describe('metadatos', () => {
  it('hay 5 fases y 5 pasos, en el orden de la metodología', () => {
    expect(PHASES.map((p) => p.key)).toEqual(['alcance', 'campo', 'asis', 'validacion', 'ficha']);
    expect(STEPS.map((s) => s.title)).toEqual([
      'Hacer el requerimiento menos tonto',
      'Eliminar cualquier parte o proceso innecesario',
      'Simplificar u optimizar el diseño',
      'Acelerar el tiempo de ciclo',
      'Automatizar',
    ]);
  });
});

describe('etapa automatizada en el motor', () => {
  it('funciona sin personas, en paralelo y sin cola', () => {
    const d = fresh();
    const p = credito(d);
    const kyc = p.stages.find((s) => s.id === 'kyc')!;
    kyc.automated = true;
    kyc.duration = { dist: 'fixed', minutes: 1 };
    expect(validateCompany(d).errors).toEqual([]);
    const r = simulateCompany(d, { seed: 4, horizonDays: 3 });
    const ev = r.events.filter((e) => e.type === 'work.started' && e.stage === 'kyc' && e.caseId.startsWith('solicitud_credito'));
    expect(ev.length).toBeGreaterThan(5);
    expect(ev.every((e) => e.type === 'work.started' && e.person === AUTO_ACTOR)).toBe(true);
    // nadie de «kyc» trabajó en esa etapa de crédito (sí en la investigación de reclamos)
    const credit = new Set(r.events.filter((e) => e.type === 'case.created' && e.process === 'solicitud_credito').map((e) => (e.type === 'case.created' ? e.caseId : '')));
    expect(r.events.some((e) => e.type === 'work.started' && e.stage === 'kyc' && credit.has(e.caseId) && e.person !== AUTO_ACTOR)).toBe(false);
    expect(r.metrics.byStage['solicitud_credito.kyc'].waitAvg).toBe(0);
  });
  it('una etapa automatizada necesita unit y duration', () => {
    const d = fresh();
    const kyc = credito(d).stages.find((s) => s.id === 'kyc')!;
    kyc.automated = true;
    delete kyc.duration;
    expect(validateCompany(d).errors.some((e) => e.includes('automatizada'))).toBe(true);
  });
});

describe('distribuciones', () => {
  it('scaleDist escala los tiempos pero no la dispersión', () => {
    expect(scaleDist({ dist: 'lognormal', medianMinutes: 10, sigma: 0.5 }, 0.5)).toEqual({ dist: 'lognormal', medianMinutes: 5, sigma: 0.5 });
    expect(scaleDist({ dist: 'normal', meanMinutes: 40, sdMinutes: 10 }, 0.25)).toEqual({ dist: 'normal', meanMinutes: 10, sdMinutes: 2.5 });
    expect(meanOfDist({ dist: 'fixed', minutes: 8 })).toBe(8);
    expect(meanOfDist({ dist: 'lognormal', medianMinutes: 10, sigma: 0 })).toBe(10);
  });
});

describe('paso 2: eliminar', () => {
  it('reconecta el flujo y deja un proceso válido', () => {
    const d = fresh();
    const p = credito(d);
    const out = eliminateStages(p, ['cumplimiento']);
    expect(out.stages.some((s) => s.id === 'cumplimiento')).toBe(false);
    expect(out.stages.find((s) => s.id === 'evaluacion_senior')!.next).toBe('revision_legal');
    expect(validateCompany({ ...d, processes: d.processes.map((x) => (x.id === p.id ? out : x)) }).errors).toEqual([]);
  });
  it('no elimina la primera etapa ni las de cierre', () => {
    const p = credito(fresh());
    const out = eliminateStages(p, ['captura', 'desembolso', 'cerrado_rechazado']);
    expect(out.stages.map((s) => s.id)).toEqual(p.stages.map((s) => s.id));
  });
  it('redirige reglas y excepciones que apuntaban a lo eliminado', () => {
    const p = credito(fresh());
    const out = eliminateStages(p, ['revision_legal']);
    // las dos ramas de la evaluación ya van a formalización → la regla se simplifica a «siempre»
    expect(out.stages.find((s) => s.id === 'evaluacion_analista')!.next).toBe('formalizacion');
    // quien apuntaba a la revisión legal (el control AML) ahora apunta a lo que venía después
    expect(out.stages.find((s) => s.id === 'cumplimiento')!.next).toBe('formalizacion');
  });
  it('eliminar etapas reduce el tiempo de ciclo medido', () => {
    const d = fresh();
    const p = credito(d);
    const base = measureVariant(d, p.id, buildVariants(p).asis, O);
    const less = measureVariant(d, p.id, eliminateStages(p, ['cumplimiento', 'revision_legal']), O);
    expect(less.stages).toBe(base.stages - 2);
    expect(less.cycleAvg).toBeLessThan(base.cycleAvg);
  });
});

describe('pasos 4 y 5', () => {
  it('acelerar reduce la duración y automatizar marca la etapa', () => {
    const p = credito(fresh());
    const fast = applySpeed(p, { evaluacion_analista: 0.5 });
    expect(fast.stages.find((s) => s.id === 'evaluacion_analista')!.duration).toEqual({ dist: 'normal', meanMinutes: 17.5, sdMinutes: 5 });
    const auto = applyAuto(p, { kyc: 0.1, captura: 0.2, desembolso: 0.1 });
    expect(auto.stages.find((s) => s.id === 'kyc')!.automated).toBe(true);
    expect(auto.stages.find((s) => s.id === 'captura')!.automated).toBe(true);
    // las etapas de cierre no se automatizan
    expect(auto.stages.find((s) => s.id === 'desembolso')!.automated).toBeUndefined();
  });
  it('no modifica el proceso original', () => {
    const p = credito(fresh());
    const before = JSON.stringify(p);
    applySpeed(p, { kyc: 0.1 });
    applyAuto(p, { kyc: 0.1 });
    eliminateStages(p, ['cumplimiento']);
    expect(JSON.stringify(p)).toBe(before);
  });
});

describe('orden estricto de los 5 pasos', () => {
  const answerAll = (p: OrgProcessDef) => {
    const opt = ensureOptimization(p);
    for (const s of p.stages.filter((x) => x.unit || x.duration)) opt.reqReview[s.id] = { requestedBy: 'Marcos Rivera', reason: 'Lo pide compliance', needed: s.id === 'cumplimiento' ? 'no' : 'si' };
  };

  it('no se puede saltar un paso ni completarlo sin cumplir su lista', () => {
    const p = credito(fresh());
    expect(stepUnlocked(p, 1)).toBe(true);
    expect(stepUnlocked(p, 2)).toBe(false);
    expect(completeStep(p, 3, '2026-10-23').ok).toBe(false);
    expect(completeStep(p, 2, '2026-10-23').reason).toContain('paso 1');
    expect(completeStep(p, 1, '2026-10-23').ok).toBe(false); // faltan respuestas
    expect(currentStep(p)).toBe(1);
  });

  it('flujo completo: cada paso desbloquea el siguiente', () => {
    const p = credito(fresh());
    answerAll(p);
    expect(completeStep(p, 1, '2026-10-23').ok).toBe(true);
    // paso 2: lo marcado «no necesario» obliga a eliminarlo o justificar
    expect(stepChecklist(p, 2).every((c) => c.done)).toBe(false);
    expect(completeStep(p, 2, '2026-10-23').ok).toBe(false);
    p.optimization!.eliminated = ['cumplimiento'];
    expect(completeStep(p, 2, '2026-10-23').ok).toBe(true);
    expect(p.optimization!.design!.stages.some((s) => s.id === 'cumplimiento')).toBe(false);
    // paso 3
    expect(completeStep(p, 3, '2026-10-23').ok).toBe(false);
    p.optimization!.designNotes = 'Se fusiona la revisión legal con la formalización.';
    expect(completeStep(p, 3, '2026-10-23').ok).toBe(true);
    // paso 4 y 5
    expect(completeStep(p, 5, '2026-10-23').reason).toContain('paso 4');
    p.optimization!.speed = { evaluacion_analista: 0.8 };
    expect(completeStep(p, 4, '2026-10-23').ok).toBe(true);
    p.optimization!.auto = { kyc: 0.2 };
    expect(completeStep(p, 5, '2026-10-23').ok).toBe(true);
    expect(currentStep(p)).toBeNull();
  });

  it('reabrir un paso reabre también los posteriores', () => {
    const p = credito(fresh());
    answerAll(p);
    p.optimization!.eliminated = ['cumplimiento'];
    p.optimization!.designNotes = 'Diseño mínimo confirmado por el equipo.';
    p.optimization!.speedNotes = 'Todavía no hay datos para acelerar nada.';
    for (const n of [1, 2, 3, 4]) expect(completeStep(p, n, '2026-10-23').ok).toBe(true);
    reopenStep(p, 2);
    expect(Object.keys(p.optimization!.steps)).toEqual(['1']);
    expect(p.optimization!.design).toBeUndefined();
    expect(currentStep(p)).toBe(2);
  });

  it('las variantes parten del As-Is y se acumulan paso a paso', () => {
    const d = fresh();
    const p = credito(d);
    answerAll(p);
    const o = p.optimization!;
    o.eliminated = ['cumplimiento'];
    o.speed = { evaluacion_analista: 0.5 };
    o.auto = { kyc: 0.1 };
    o.design = eliminateStages(p, o.eliminated);
    const v = buildVariants(p);
    expect(v.asis.stages.length).toBe(p.stages.length);
    expect(v.step2.stages.length).toBe(p.stages.length - 1);
    expect(v.step4.stages.find((s) => s.id === 'evaluacion_analista')!.duration).not.toEqual(v.step3.stages.find((s) => s.id === 'evaluacion_analista')!.duration);
    expect(v.step5.stages.find((s) => s.id === 'kyc')!.automated).toBe(true);
    expect(v.step4.stages.find((s) => s.id === 'kyc')!.automated).toBeUndefined();
  });
});

describe('impacto medido con el simulador', () => {
  it('cada paso mejora (o no empeora) el ciclo y es reproducible', () => {
    const d = fresh();
    const p = credito(d);
    const o = ensureOptimization(p);
    for (const s of p.stages.filter((x) => x.unit || x.duration)) o.reqReview[s.id] = { requestedBy: 'Laura Núñez', reason: 'Histórico', needed: s.id === 'cumplimiento' ? 'no' : 'si' };
    o.eliminated = ['cumplimiento'];
    o.designNotes = 'El diseño ya es mínimo tras eliminar.';
    o.speed = { evaluacion_analista: 0.7, revision_legal: 0.7 };
    o.auto = { kyc: 0.2, formalizacion: 0.5 };
    for (const n of [1, 2, 3, 4, 5]) {
      if (n === 4) o.speedNotes = 'ok';
      expect(completeStep(p, n, '2026-10-23').ok).toBe(true);
    }
    const rows = compareVariants(d, p.id, O);
    expect(rows.map((r) => r.key)).toEqual(['asis', 'step2', 'step3', 'step4', 'step5']);
    expect(rows.every((r) => !r.error)).toBe(true);
    expect(rows[1].stages).toBe(rows[0].stages - 1);
    for (let i = 1; i < rows.length; i++) expect(rows[i].cycleAvg).toBeLessThanOrEqual(rows[i - 1].cycleAvg + 1e-9);
    expect(rows[4].cycleAvg).toBeLessThan(rows[0].cycleAvg);
    expect(compareVariants(d, p.id, O)).toEqual(rows);
  });

  it('solo compara hasta el paso en curso', () => {
    const d = fresh();
    expect(compareVariants(d, 'solicitud_credito', O).map((r) => r.key)).toEqual(['asis']);
  });

  it('una variante inválida se informa en vez de romper', () => {
    const d = fresh();
    const p = credito(d);
    const bad = structuredClone(p);
    bad.stages[0].next = 'no_existe';
    expect(measureVariant(d, p.id, bad, O).error).toContain('no_existe');
  });

  it('la línea base queda guardada con sus semillas', () => {
    const d = fresh();
    const b = captureBaseline(d, 'solicitud_credito', O, '2026-10-23T10:00:00Z');
    expect(b.seeds).toEqual([1, 2, 3]);
    expect(b.cycleAvg).toBeGreaterThan(0);
    expect(b.completed).toBeGreaterThan(0);
  });
});

describe('ciclo de documentación', () => {
  it('las listas de comprobación reflejan lo que se va llenando', () => {
    const d = fresh();
    const p = credito(d);
    expect(docChecklist(d, p, 'alcance').every((c) => !c.done)).toBe(true);
    const doc = ensureDoc(p);
    Object.assign(doc.scope, { objective: 'Aprobar créditos con calidad', inputs: 'Solicitud', outputs: 'Crédito desembolsado', inScope: 'Persona natural', outOfScope: 'Empresas', owner: 'jefe_riesgos', successCriteria: 'Ciclo < 4 h' });
    doc.scope.stakeholders.push({ id: 's1', name: 'Carlos Duarte', role: 'Riesgos' });
    expect(docChecklist(d, p, 'alcance').every((c) => c.done)).toBe(true);
    expect(docChecklist(d, p, 'campo').some((c) => c.done)).toBe(false);
    doc.fieldwork.push({ id: 'f1', type: 'entrevista', findings: 'Se repite la validación' });
    expect(docChecklist(d, p, 'campo').every((c) => c.done)).toBe(true);
    expect(docChecklist(d, p, 'validacion').find((c) => c.label.includes('aprobaron'))!.done).toBe(false);
    doc.validations.push({ stakeholderId: 's1', status: 'aprobado' });
    expect(docChecklist(d, p, 'validacion').every((c) => c.done)).toBe(true);
    expect(docChecklist(d, p, 'ficha')[0].done).toBe(false);
  });

  it('la ficha y la optimización sobreviven al YAML y no alteran la simulación', () => {
    const d = fresh();
    const p = credito(d);
    ensureDoc(p).scope.objective = 'X de prueba';
    ensureOptimization(p).eliminated = ['cumplimiento'];
    const back = parseCompany(companyToYaml(d));
    expect(back.errors).toEqual([]);
    expect(back.def).toEqual(d);
    const clean = fresh();
    expect(simulateCompany(d, { seed: 2, horizonDays: 3 }).events).toEqual(simulateCompany(clean, { seed: 2, horizonDays: 3 }).events);
  });
});

describe('ficha de proceso', () => {
  it('genera las secciones y la tabla de etapas del As-Is', () => {
    const d = fresh();
    const p = credito(d);
    const doc = ensureDoc(p);
    doc.scope.objective = 'Aprobar créditos';
    doc.scope.owner = 'jefe_riesgos';
    doc.scope.stakeholders.push({ id: 's1', name: 'Carlos Duarte', role: 'Riesgos' });
    doc.validations.push({ stakeholderId: 's1', status: 'aprobado', date: '2026-10-22', comment: 'Conforme' });
    doc.fieldwork.push({ id: 'f1', type: 'observacion', date: '2026-10-20', source: 'Sala de riesgos', findings: 'Cola en revisión legal' });
    doc.version = '1.0';
    doc.approvedAt = '2026-10-23';
    const md = fichaMarkdown(d, p);
    for (const h of ['# Ficha de proceso — Solicitud de crédito', '## 1. Identificación', '## 2. Objetivo y alcance', '## 3. Involucrados', '## 4. Hallazgos', '## 5. Proceso As-Is', '## 6. Validación']) {
      expect(md).toContain(h);
    }
    expect(md).toContain('| Dueño del proceso | Carlos Duarte |'); // el id se resuelve al nombre
    expect(md).toContain('Cola en revisión legal');
    expect(md).toContain('Versión 1.0 · aprobada el 2026-10-23');
    // una fila por etapa
    const rows = md.split('\n').filter((l) => /^\| \d+ \|/.test(l));
    expect(rows).toHaveLength(p.stages.length);
    expect(md).toContain('Riesgos › Análisis');
    expect(md).toContain('si amount > 50000 → Evaluación senior');
    expect(md).not.toContain('## 7.');
  });

  it('incluye la optimización y el impacto cuando hay pasos hechos', () => {
    const d = fresh();
    const p = credito(d);
    const o = ensureOptimization(p);
    o.reqReview.cumplimiento = { requestedBy: 'Laura Núñez', reason: 'Histórico', needed: 'no' };
    o.eliminated = ['cumplimiento'];
    o.steps['1'] = { completedAt: '2026-10-22' };
    const md = fichaMarkdown(d, p, [{ key: 'asis', label: 'As-Is (hoy)', stages: 8, completed: 100, cycleAvg: 300, cycleP90: 480, slaBreaches: 3, waitPerCase: 120 }]);
    expect(md).toContain('## 7. Optimización');
    expect(md).toContain('Paso 1 · Hacer el requerimiento menos tonto** — completado el 2026-10-22');
    expect(md).toContain('Paso 2 · Eliminar cualquier parte o proceso innecesario** — pendiente');
    expect(md).toContain('**Eliminado (paso 2):**');
    expect(md).toContain('| As-Is (hoy) | 8 |');
  });
});
