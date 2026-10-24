import { describe, expect, it } from 'vitest';
import { dropDanglingDependencies, newProcedure, pruneExceptionLinks, type CompanyDef, type Procedure } from '../src';
import { emptyDef } from './helpers-integridad';

const withException = (): Procedure => {
  const d = emptyDef();
  const pc = newProcedure(d, d.processes[0], 's1', 'Registrar');
  pc.fieldwork = [
    { id: 'r1', operator: 'Beto', method: 'en_vivo', exceptions: [{ id: 'e1', text: 'No llega el dato' }, { id: 'e2', text: 'Cliente ausente' }], tricks: [] },
    { id: 'r2', operator: 'Ana', method: 'entrevista', exceptions: [{ id: 'e3', text: 'Sistema caído' }], tricks: [] },
  ];
  pc.steps = [
    {
      id: 's1',
      actor: 'Cajero',
      action: 'Registrar',
      alternatives: [
        { id: 'a1', condition: 'no llega el dato', action: 'pedirlo', exceptionId: 'e1' },
        { id: 'a2', condition: 'sistema caído', action: 'usar papel', exceptionId: 'e3' },
        { id: 'a3', condition: 'otro caso', action: 'escalar' },
      ],
    },
  ];
  return pc;
};

describe('borrar una excepción o un registro del levantamiento', () => {
  it('los caminos alternativos que la cubrían dejan de apuntar a algo que ya no existe, pero se conservan', () => {
    const pc = withException();
    pc.fieldwork[0].exceptions.splice(0, 1); // se borra e1
    pruneExceptionLinks(pc);
    const alts = pc.steps[0].alternatives;
    expect(alts.map((a) => a.id)).toEqual(['a1', 'a2', 'a3']);
    expect(alts.map((a) => a.exceptionId)).toEqual([undefined, 'e3', undefined]);

    pc.fieldwork.splice(1, 1); // se borra el registro entero (e3)
    pruneExceptionLinks(pc);
    expect(pc.steps[0].alternatives.every((a) => a.exceptionId === undefined)).toBe(true);
  });

  it('dropDanglingDependencies también lo limpia en todos los procedimientos', () => {
    const d: CompanyDef = emptyDef();
    const pc = withException();
    pc.fieldwork = [];
    d.processes[0].procedures = [pc];
    dropDanglingDependencies(d);
    expect(pc.steps[0].alternatives.every((a) => a.exceptionId === undefined)).toBe(true);
  });
});
