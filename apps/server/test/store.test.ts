import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConflictError, MAX_REVISIONS, Store } from '../src/store';

const open: Store[] = [];
const mem = () => {
  const s = new Store(':memory:');
  open.push(s);
  return s;
};
afterEach(() => {
  for (const s of open.splice(0)) s.close();
});

describe('base de datos: empresas', () => {
  it('crea, lee, lista y borra', () => {
    const s = mem();
    expect(s.list()).toEqual([]);
    const c = s.create('Mi empresa', 'company: Mi empresa\n');
    expect(c.id).toMatch(/^emp_[0-9a-f]{8}$/);
    expect(c.version).toBe(1);
    expect(s.get(c.id)?.yaml).toBe('company: Mi empresa\n');
    expect(s.list()).toHaveLength(1);
    expect(s.list()[0]).toMatchObject({ id: c.id, name: 'Mi empresa', version: 1 });
    expect(s.list()[0].bytes).toBe(Buffer.byteLength('company: Mi empresa\n'));
    expect(s.remove(c.id)).toBe(true);
    expect(s.remove(c.id)).toBe(false);
    expect(s.get(c.id)).toBeUndefined();
  });

  it('guardar sube la versión y deja la anterior en el historial', () => {
    const s = mem();
    const c = s.create('A', 'v1');
    const v2 = s.save(c.id, 'A', 'v2', 1, 'segundo')!;
    expect(v2.version).toBe(2);
    expect(v2.yaml).toBe('v2');
    const v3 = s.save(c.id, 'A2', 'v3', 2)!;
    expect(v3.version).toBe(3);
    expect(v3.name).toBe('A2');
    const hist = s.revisions(c.id);
    expect(hist.map((r) => r.version)).toEqual([2, 1]); // la más reciente primero
    expect(hist[1].note).toBe('segundo'); // la nota va con el cambio que reemplazó a esa versión
    expect(s.revision(c.id, hist[1].id)!.yaml).toBe('v1');
    expect(s.revision(c.id, hist[0].id)!.yaml).toBe('v2');
    expect(s.revision('otra', hist[0].id)).toBeUndefined();
  });

  it('si no hay cambios, no sube la versión ni ensucia el historial', () => {
    const s = mem();
    const c = s.create('A', 'x');
    expect(s.save(c.id, 'A', 'x', 1)!.version).toBe(1);
    expect(s.revisions(c.id)).toEqual([]);
  });

  it('no pisa un cambio hecho desde otra pestaña (conflicto por versión)', () => {
    const s = mem();
    const c = s.create('A', 'v1');
    s.save(c.id, 'A', 'v2', 1);
    let err: unknown;
    try {
      s.save(c.id, 'A', 'mio', 1); // yo seguía en la versión 1
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ConflictError);
    expect((err as ConflictError).current.version).toBe(2);
    expect(s.get(c.id)!.yaml).toBe('v2'); // no se perdió nada
    // sin versión esperada se guarda igualmente (para restaurar o importar)
    expect(s.save(c.id, 'A', 'forzado')!.version).toBe(3);
  });

  it('guardar algo que no existe devuelve undefined', () => {
    expect(mem().save('nada', 'x', 'y')).toBeUndefined();
  });

  it('el historial se recorta a las últimas versiones', () => {
    const s = mem();
    const c = s.create('A', '0');
    for (let i = 1; i <= MAX_REVISIONS + 10; i++) s.save(c.id, 'A', String(i));
    const hist = s.revisions(c.id);
    expect(hist).toHaveLength(MAX_REVISIONS);
    expect(s.get(c.id)!.version).toBe(MAX_REVISIONS + 11);
    expect(hist[0].version).toBe(MAX_REVISIONS + 10);
  });

  it('borrar la empresa borra su historial', () => {
    const s = mem();
    const c = s.create('A', '1');
    s.save(c.id, 'A', '2');
    s.remove(c.id);
    expect(s.revisions(c.id)).toEqual([]);
  });

  it('las preferencias se guardan y se actualizan', () => {
    const s = mem();
    expect(s.getSetting('modo')).toBeUndefined();
    s.setSetting('modo', 'explain');
    s.setSetting('modo', 'week');
    expect(s.getSetting('modo')).toBe('week');
  });
});

describe('base de datos: archivo en disco', () => {
  it('lo guardado sobrevive a cerrar y volver a abrir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'op-db-'));
    try {
      const path = join(dir, 'sub', 'datos.db'); // crea la carpeta si no existe
      const a = new Store(path);
      const c = a.create('Persistente', 'company: Persistente\n');
      a.save(c.id, 'Persistente', 'company: Persistente\nx: 1\n');
      a.setSetting('k', 'v');
      a.close();
      const b = new Store(path);
      expect(b.get(c.id)).toMatchObject({ name: 'Persistente', version: 2 });
      expect(b.revisions(c.id)).toHaveLength(1);
      expect(b.getSetting('k')).toBe('v');
      b.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('guarda bien tildes, emojis y textos grandes (ilustraciones)', () => {
    const s = mem();
    const grande = `company: Ñandú 🧪\n# ${'x'.repeat(3_000_000)}\n`;
    const c = s.create('Ñandú 🧪', grande);
    expect(s.get(c.id)!.yaml).toBe(grande);
    expect(s.list()[0].bytes).toBe(Buffer.byteLength(grande));
  });
});
