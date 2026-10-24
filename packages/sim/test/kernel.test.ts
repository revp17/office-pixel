import { describe, expect, it } from 'vitest';
import { compileExpr, mulberry32 } from '../src';

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
