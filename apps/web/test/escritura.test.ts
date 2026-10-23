import { describe, expect, it } from 'vitest';
import { isNumText, normalizeAttrName, parseNumText, renameAttribute } from '../src/config/model';
import type { OrgProcessDef } from '@office-pixel/sim';

describe('escribir números con fluidez', () => {
  it('acepta textos a medio escribir sin descartarlos', () => {
    for (const t of ['', '-', '0', '0.', '0,', '.5', '12', '-3.25', '3,75']) expect(isNumText(t), t).toBe(true);
    for (const t of ['a', '1a', '1.2.3', '--1', '1e5', ' 1', '1 ']) expect(isNumText(t), t).toBe(false);
  });

  it('convierte a número solo cuando ya es un número (admite coma decimal)', () => {
    expect(parseNumText('')).toBeUndefined();
    expect(parseNumText('-')).toBeUndefined();
    expect(parseNumText('.')).toBeUndefined();
    expect(parseNumText('0.')).toBe(0);
    expect(parseNumText('0,45')).toBe(0.45);
    expect(parseNumText('0.45')).toBe(0.45);
    expect(parseNumText('-12')).toBe(-12);
    expect(parseNumText('.5')).toBe(0.5);
  });

  it('escribir «0.45» tecla a tecla nunca pierde lo escrito', () => {
    let shown = '';
    for (const key of ['0', '.', '4', '5']) {
      const next = shown + key;
      expect(isNumText(next)).toBe(true); // se conserva el texto
      shown = next;
    }
    expect(parseNumText(shown)).toBe(0.45);
  });
});

describe('nombres de los datos de cada caso', () => {
  it('se normalizan al confirmar: letras, números y guion bajo', () => {
    expect(normalizeAttrName('monto total')).toBe('monto_total');
    expect(normalizeAttrName('  prioridad ')).toBe('prioridad');
    expect(normalizeAttrName('año/mes')).toBe('a_o_mes');
    expect(normalizeAttrName('')).toBe('');
  });

  it('renombrar conserva el orden y actualiza las condiciones que lo usan', () => {
    const p = {
      id: 'x',
      arrivals: { type: 'poisson', ratePerHour: 1 },
      attributes: { a: { dist: 'fixed', value: 1 }, monto: { dist: 'fixed', value: 2 }, z: { dist: 'fixed', value: 3 } },
      stages: [{ id: 's', next: [{ when: 'case.monto > 5', to: 't' }, { otherwise: true, to: 't' }] }, { id: 't', terminal: true }],
    } as unknown as OrgProcessDef;
    renameAttribute(p, 'monto', 'monto_total');
    expect(Object.keys(p.attributes!)).toEqual(['a', 'monto_total', 'z']);
    expect((p.stages[0].next as Array<{ when?: string }>)[0].when).toBe('case.monto_total > 5');
  });
});
