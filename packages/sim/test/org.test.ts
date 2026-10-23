import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DAY, OrgReplayer, makeBizCalendar, parseCompany, simulateCompany, type CompanyDef } from '../src';

const text = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');

function load(src = text): CompanyDef {
  const r = parseCompany(src);
  expect(r.errors).toEqual([]);
  return r.def!;
}

const opts = { seed: 11, horizonDays: 8 };

describe('tiempo hábil', () => {
  const cal = makeBizCalendar([0, 1, 2, 3, 4], 540, 1080);
  it('salta noches y fines de semana', () => {
    // viernes 17:00 + 120 min hábiles → lunes 10:00
    expect(cal.addBiz(4 * DAY + 17 * 60, 120)).toBe(7 * DAY + 10 * 60);
    expect(cal.bizBetween(4 * DAY + 17 * 60, 7 * DAY + 10 * 60)).toBe(120);
  });
  it('no cuenta nada fuera de jornada', () => {
    expect(cal.bizBetween(5 * DAY, 6 * DAY)).toBe(0);
    expect(cal.bizBetween(0, DAY)).toBe(540);
  });
});

describe('validación de empresa', () => {
  it('acepta el ejemplo (32 personas)', () => {
    const def = load();
    expect(def.people).toHaveLength(32);
  });
  it('detecta unidad inexistente', () => {
    expect(parseCompany(text.replace('unit: ventas\n        role: ejecutivo', 'unit: fantasma\n        role: ejecutivo')).errors.join('|')).toContain('fantasma');
  });
  it('detecta etapa sin nadie que pueda ejecutarla', () => {
    const { errors } = parseCompany(text.replace('role: abogado\n        duration', 'role: astronauta\n        duration'));
    expect(errors.some((e) => e.includes('nadie'))).toBe(true);
  });
  it('detecta horas inválidas', () => {
    expect(parseCompany(text.replace('"09:00", end: "18:00"', '"9am", end: "18:00"')).errors.length).toBeGreaterThan(0);
  });
});

describe('responsables y colaboradores', () => {
  it('el ejemplo tiene responsables en áreas y subáreas, y varios en una misma unidad', () => {
    const def = load();
    const resp = def.people.filter((p) => p.kind === 'responsable');
    expect(resp.length).toBeGreaterThanOrEqual(10);
    expect(def.units.every((u) => u.head === undefined)).toBe(true);
    expect(resp.filter((p) => p.unit === 'contact_center').length).toBeGreaterThanOrEqual(2);
    expect(def.people.some((p) => !p.kind)).toBe(true); // el resto son colaboradores por defecto
  });
  it('el formato antiguo (head) se convierte en responsable', () => {
    const legacy = text.replace('- id: riesgos\n    name: Riesgos', '- id: riesgos\n    name: Riesgos\n    head: a2');
    const r = parseCompany(legacy);
    expect(r.errors).toEqual([]);
    expect(r.def!.people.find((p) => p.id === 'jefe_riesgos')!.kind).toBe('responsable');
    expect(r.def!.units.find((u) => u.id === 'riesgos')!.head).toBeUndefined();
  });
  it('rechaza un tipo desconocido', () => {
    const bad = text.replace('id: e1, name: Sofía Luna,', 'id: e1, kind: jefazo, name: Sofía Luna,');
    expect(parseCompany(bad).errors.some((e) => e.includes('kind'))).toBe(true);
  });
  it('no cambia el resultado de la simulación', () => {
    const def = load();
    const a = simulateCompany(def, { seed: 3, horizonDays: 3 });
    const stripped: CompanyDef = { ...def, people: def.people.map(({ kind: _k, ...p }) => p) };
    expect(simulateCompany(stripped, { seed: 3, horizonDays: 3 }).events).toEqual(a.events);
  });
});

describe('motor de empresa', () => {
  const def = load();
  const res = simulateCompany(def, opts);

  it('es reproducible por semilla', () => {
    expect(simulateCompany(def, opts).events).toEqual(res.events);
    expect(simulateCompany(def, { ...opts, seed: 12 }).events).not.toEqual(res.events);
  });

  it('eventos ordenados y métricas coherentes', () => {
    for (let i = 1; i < res.events.length; i++) expect(res.events[i].t).toBeGreaterThanOrEqual(res.events[i - 1].t);
    const m = res.metrics;
    expect(m.created).toBeGreaterThan(50);
    expect(m.completed + m.inFlight).toBe(m.created);
    for (const p of Object.values(m.byPerson)) {
      expect(p.utilization).toBeGreaterThanOrEqual(0);
      expect(p.utilization).toBeLessThanOrEqual(1);
    }
    expect(m.byUnit.riesgos.headcount).toBe(7);
  });

  it('nadie trabaja dos casos a la vez y solo quien tiene el rol', () => {
    const roleOf = new Map(def.people.map((p) => [p.id, p.role]));
    const stageRole = new Map<string, string | undefined>();
    for (const pr of def.processes) for (const s of pr.stages) stageRole.set(`${pr.id}.${s.id}`, s.role);
    const caseProc = new Map<string, string>();
    const busy = new Map<string, string>();
    for (const e of res.events) {
      if (e.type === 'case.created') caseProc.set(e.caseId, e.process);
      if (e.type === 'work.started') {
        expect(busy.has(e.person)).toBe(false);
        busy.set(e.person, e.caseId);
        const want = stageRole.get(`${caseProc.get(e.caseId)}.${e.stage}`);
        if (want) expect(roleOf.get(e.person)).toBe(want);
      }
      if (e.type === 'work.finished') {
        expect(busy.get(e.person)).toBe(e.caseId);
        busy.delete(e.person);
      }
    }
  });

  it('solo se empieza a trabajar en jornada: sin fines de semana, almuerzo ni reuniones', () => {
    const afternoon = new Set(['g4', 'g5']);
    const riesgos = new Set(['a1', 'a2', 'a3', 'a4', 's1', 's2', 'jefe_riesgos']);
    let started = 0;
    for (const e of res.events) {
      if (e.type !== 'work.started') continue;
      started++;
      const day = Math.floor(e.t / DAY);
      const mod = e.t % DAY;
      expect(day % 7).toBeLessThan(5);
      if (afternoon.has(e.person)) {
        expect(mod).toBeGreaterThanOrEqual(720);
        expect(mod).toBeLessThan(1260);
        expect(mod >= 960 && mod < 1020).toBe(false);
      } else {
        expect(mod).toBeGreaterThanOrEqual(540);
        expect(mod).toBeLessThan(1080);
        expect(mod >= 780 && mod < 840).toBe(false);
      }
      if (riesgos.has(e.person)) expect(mod >= 555 && mod < 570).toBe(false);
    }
    expect(started).toBeGreaterThan(100);
  });

  it('no llegan casos fuera del horario hábil', () => {
    for (const e of res.events)
      if (e.type === 'case.created') {
        expect(Math.floor(e.t / DAY) % 7).toBeLessThan(5);
        expect(e.t % DAY).toBeGreaterThanOrEqual(540);
        expect(e.t % DAY).toBeLessThanOrEqual(1080);
      }
  });

  it('el trabajo se pausa y se reanuda tras pausas/fin de jornada', () => {
    const paused = new Map<string, number>();
    let resumed = 0;
    for (const e of res.events) {
      if (e.type === 'work.paused') paused.set(e.caseId, e.t);
      if (e.type === 'work.resumed') {
        resumed++;
        expect(e.t).toBeGreaterThan(paused.get(e.caseId)!);
      }
    }
    expect(paused.size).toBeGreaterThan(0);
    expect(resumed).toBeGreaterThan(0);
  });

  it('los traspasos entre áreas cuestan el traslado configurado', () => {
    const hand = res.events.filter((e) => e.type === 'handoff.started');
    expect(hand.length).toBeGreaterThan(0);
    for (const h of hand) if (h.type === 'handoff.started') expect([2, 5]).toContain(h.minutes);
  });

  it('una ausencia del escenario deja a la persona fuera ese día', () => {
    const scenario: CompanyDef = {
      ...def,
      scenario: { absences: ['a1', 'a2', 'a3', 'a4'].map((p) => ({ person: p, days: [1] })) },
    };
    const r = simulateCompany(scenario, opts);
    const analysts = new Set(['a1', 'a2', 'a3', 'a4']);
    for (const e of r.events) if (e.type === 'work.started' && analysts.has(e.person)) expect(Math.floor(e.t / DAY)).not.toBe(1);
    expect(r.events.some((e) => e.type === 'person.state' && e.person === 'a1' && e.state === 'absent')).toBe(true);
  });

  it('detecta el cuello de botella: menos analistas → más espera', () => {
    const lean: CompanyDef = { ...def, people: def.people.filter((p) => !['a2', 'a3', 'a4'].includes(p.id)) };
    const a = simulateCompany(lean, opts).metrics.byStage['solicitud_credito.evaluacion_analista'];
    const b = res.metrics.byStage['solicitud_credito.evaluacion_analista'];
    expect(a.waitAvg).toBeGreaterThan(b.waitAvg * 2);
  });

  it('el replay coincide con las métricas y soporta retroceder', () => {
    const ids = def.people.map((p) => p.id);
    const end = opts.horizonDays * DAY;
    const rp = new OrgReplayer(res.events, ids);
    rp.advanceTo(end);
    expect(rp.counters.created).toBe(res.metrics.created);
    expect(rp.counters.completed).toBe(res.metrics.completed);
    const mid = new OrgReplayer(res.events, ids);
    mid.advanceTo(2 * DAY + 700);
    const snap = JSON.stringify([...mid.cases.values()].map((c) => [c.id, c.stage, c.status, c.person]));
    rp.advanceTo(DAY);
    rp.advanceTo(2 * DAY + 700);
    expect(JSON.stringify([...rp.cases.values()].map((c) => [c.id, c.stage, c.status, c.person]))).toBe(snap);
    expect([...rp.persons.values()].map((p) => p.state)).toEqual([...mid.persons.values()].map((p) => p.state));
  });
});
