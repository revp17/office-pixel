import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Replayer, compileExpr, mulberry32, parseProcess, simulate, type ProcessDef } from '../src';

const yamlText = readFileSync(new URL('../../../examples/aprobacion_credito.yaml', import.meta.url), 'utf8');

function load(text = yamlText): ProcessDef {
  const r = parseProcess(text);
  expect(r.errors).toEqual([]);
  return r.def!;
}

describe('rng', () => {
  it('es determinista por semilla', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('expr', () => {
  it('evalúa comparaciones y lógica', () => {
    const f = compileExpr('case.amount > 10000 && !case.vip || case.tag == "x"');
    expect(f({ case: { amount: 20000, vip: false } })).toBe(true);
    expect(f({ case: { amount: 20000, vip: true } })).toBe(false);
    expect(f({ case: { amount: 1, tag: 'x' } })).toBe(true);
  });
  it('rechaza sintaxis inválida', () => {
    expect(() => compileExpr('case.amount >')).toThrow();
    expect(() => compileExpr('a b')).toThrow();
  });
});

describe('validación', () => {
  it('acepta el ejemplo', () => {
    expect(parseProcess(yamlText).errors).toEqual([]);
  });
  it('reporta referencias rotas y falta de otherwise', () => {
    const bad = yamlText.replace('next: validacion', 'next: no_existe').replace('- { otherwise: true, to: revision }', '');
    const { errors } = parseProcess(bad);
    expect(errors.some((e) => e.includes('no_existe'))).toBe(true);
    expect(errors.some((e) => e.includes('otherwise'))).toBe(true);
  });
  it('reporta YAML roto', () => {
    expect(parseProcess('a: [').errors.length).toBeGreaterThan(0);
  });
});

describe('motor', () => {
  const def = load();
  const opts = { seed: 42, horizonMinutes: 480 };

  it('es reproducible con la misma semilla y distinto con otra', () => {
    const a = simulate(def, opts);
    const b = simulate(def, opts);
    const c = simulate(def, { ...opts, seed: 43 });
    expect(a.events).toEqual(b.events);
    expect(a.events).not.toEqual(c.events);
  });

  it('mantiene invariantes básicas', () => {
    const { events, metrics } = simulate(def, opts);
    expect(metrics.created).toBeGreaterThan(0);
    expect(metrics.completed).toBeLessThanOrEqual(metrics.created);
    expect(metrics.completed + metrics.inFlight).toBe(metrics.created);
    for (let i = 1; i < events.length; i++) expect(events[i].t).toBeGreaterThanOrEqual(events[i - 1].t);
    for (const u of Object.values(metrics.utilization)) {
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThanOrEqual(1);
    }
  });

  it('enruta por regla: montos > 10000 nunca pasan por "revision"', () => {
    const { events } = simulate(def, { seed: 1, horizonMinutes: 1440 });
    const amount = new Map<string, number>();
    let senior = 0;
    for (const e of events) {
      if (e.type === 'case.created') amount.set(e.caseId, e.attrs.amount);
      if (e.type === 'stage.entered' && e.stage === 'revision') expect(amount.get(e.caseId)!).toBeLessThanOrEqual(10000);
      if (e.type === 'stage.entered' && e.stage === 'revision_senior') {
        senior++;
        expect(amount.get(e.caseId)!).toBeGreaterThan(10000);
      }
    }
    expect(senior).toBeGreaterThan(0);
  });

  it('detecta el cuello de botella: menos analistas → más espera en revisión', () => {
    const scarce = structuredClone(def);
    scarce.resources!.find((r) => r.id === 'analistas')!.count = 1;
    const rich = structuredClone(def);
    rich.resources!.find((r) => r.id === 'analistas')!.count = 12;
    const o = { seed: 5, horizonMinutes: 960 };
    const a = simulate(scarce, o).metrics;
    const b = simulate(rich, o).metrics;
    expect(a.waitByStage.revision.avg).toBeGreaterThan(b.waitByStage.revision.avg * 3);
    expect(a.utilization.analistas).toBeGreaterThan(b.utilization.analistas);
  });
});

describe('replay', () => {
  it('coincide con las métricas finales y soporta retroceder', () => {
    const def = load();
    const res = simulate(def, { seed: 9, horizonMinutes: 480 });
    const rp = new Replayer(res.events);
    rp.advanceTo(480);
    expect(rp.counters.created).toBe(res.metrics.created);
    expect(rp.counters.completed).toBe(res.metrics.completed);
    const mid = new Replayer(res.events);
    mid.advanceTo(200);
    const snapshot = [...mid.cases.values()].map((c) => `${c.id}:${c.stage}:${c.status}`);
    rp.advanceTo(100);
    rp.advanceTo(200);
    expect([...rp.cases.values()].map((c) => `${c.id}:${c.stage}:${c.status}`)).toEqual(snapshot);
  });
});
