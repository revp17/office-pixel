import { describe, expect, it } from 'vitest';
import { DAY, compileExpr, makeBizCalendar, mulberry32 } from '../src';

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

describe('calendario hábil con pausas', () => {
  const H = (h: number, m = 0) => h * 60 + m;
  const lun = [0, 1, 2, 3, 4];
  // jornada 09:00–18:00 con almuerzo 13:00–14:00 → 8 horas hábiles por día
  const conAlmuerzo = makeBizCalendar(lun, H(9), H(18), [[H(13), H(14)]]);
  const sinAlmuerzo = makeBizCalendar(lun, H(9), H(18));

  it('sin pausas se comporta como antes', () => {
    expect(sinAlmuerzo.bizBetween(H(9), H(18))).toBe(9 * 60);
    expect(sinAlmuerzo.addBiz(H(9), 4 * 60)).toBe(H(13));
  });

  it('las pausas no cuentan al medir el tiempo transcurrido', () => {
    expect(conAlmuerzo.bizBetween(H(9), H(18))).toBe(8 * 60);
    expect(conAlmuerzo.bizBetween(H(12), H(15))).toBe(2 * 60); // 12–13 y 14–15
    expect(conAlmuerzo.bizBetween(H(13), H(14))).toBe(0);
    expect(conAlmuerzo.bizBetween(0, 7 * DAY)).toBe(5 * 8 * 60); // una semana: 5 días de 8 h
  });

  it('un plazo que cruza el almuerzo se corre una hora', () => {
    expect(conAlmuerzo.addBiz(H(12), 2 * 60)).toBe(H(15)); // 1 h antes + 1 h después del almuerzo
    expect(conAlmuerzo.addBiz(H(9), 4 * 60)).toBe(H(13)); // justo hasta el almuerzo
    expect(conAlmuerzo.addBiz(H(9), 4 * 60 + 1)).toBe(H(14, 1));
    expect(conAlmuerzo.addBiz(H(13, 30), 0)).toBe(H(14)); // en pausa: el reloj arranca al volver
  });

  it('al final del día pasa al siguiente día laborable y salta el fin de semana', () => {
    expect(conAlmuerzo.addBiz(H(17), 2 * 60)).toBe(DAY + H(10)); // 1 h hoy + 1 h mañana a las 09–10
    const viernes = 4 * DAY;
    expect(conAlmuerzo.addBiz(viernes + H(17), 2 * 60)).toBe(7 * DAY + H(10)); // lunes
  });

  it('varias pausas, solapadas o fuera de la jornada', () => {
    const c = makeBizCalendar(lun, H(9), H(18), [[H(10), H(10, 15)], [H(10), H(11)], [H(7), H(8)], [H(17), H(20)]]);
    expect(c.bizBetween(H(9), H(18))).toBe(9 * 60 - 60 - 60); // 10–11 y 17–18 fuera
  });
});
