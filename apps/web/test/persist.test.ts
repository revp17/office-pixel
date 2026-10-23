import { beforeEach, describe, expect, it } from 'vitest';
import { companyToYaml, type CompanyDef } from '@office-pixel/sim';
import type { Backend, CompanyFull, CompanyInfo } from '../src/application/ports';
import { emptyCompany } from '../src/application/editing/model';
import { Persistence } from '../src/application/persistence';
import { memoryCache } from '../src/infrastructure/browserCache';

/** Una base de datos de mentira en memoria con la misma interfaz que SQLite y Nhost. */
function fakeBackend(online = true) {
  const rows: CompanyFull[] = [];
  const settings: Record<string, string> = {};
  const calls: string[] = [];
  let n = 0;
  const info = (c: CompanyFull): CompanyInfo => ({ id: c.id, name: c.name, version: c.version, createdAt: c.createdAt, updatedAt: c.updatedAt, bytes: c.yaml.length });
  const nameOf = (yaml: string) => /^company: "?(.*?)"?$/m.exec(yaml)?.[1] ?? 'x';
  const backend: Backend = {
    kind: 'sqlite',
    label: 'la base de datos',
    lastError: online ? undefined : 'sin conexión',
    async ping() {
      calls.push('ping');
      return online;
    },
    async list() {
      calls.push('list');
      return rows.map(info);
    },
    async get(id) {
      const c = rows.find((r) => r.id === id);
      if (!c) throw new Error('no existe');
      return structuredClone(c);
    },
    async create(yaml) {
      calls.push('create');
      const c: CompanyFull = { id: `c${++n}`, name: nameOf(yaml), yaml, version: 1, createdAt: 't', updatedAt: 't' };
      rows.push(c);
      return structuredClone(c);
    },
    async save(id, yaml, version) {
      calls.push('save');
      const c = rows.find((r) => r.id === id)!;
      if (version !== undefined && version !== c.version) return { ok: false, conflict: structuredClone(c) };
      if (yaml !== c.yaml) {
        c.yaml = yaml;
        c.name = nameOf(yaml);
        c.version += 1;
      }
      return { ok: true, company: structuredClone(c) };
    },
    async remove(id) {
      calls.push('remove');
      rows.splice(rows.findIndex((r) => r.id === id), 1);
    },
    async duplicate(id) {
      const c = rows.find((r) => r.id === id)!;
      const copy: CompanyFull = { ...c, id: `c${++n}`, name: `${c.name} (copia)` };
      rows.push(copy);
      return structuredClone(copy);
    },
    async revisions() {
      return [];
    },
    async restore(id) {
      return structuredClone(rows.find((r) => r.id === id)!);
    },
    async setting(key) {
      return settings[key];
    },
    async setSetting(key, value) {
      settings[key] = value;
    },
  };
  return { backend, rows, settings, calls };
}

const co = (name: string): CompanyDef => ({ ...emptyCompany(), company: name });

let cache = memoryCache();
beforeEach(() => {
  cache = memoryCache();
});

describe('una cuenta nueva empieza en cero', () => {
  it('al abrir sin empresas no crea nada y avisa de que no hay ninguna', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    expect(await p.boot()).toBeUndefined();
    expect(f.rows).toHaveLength(0);
    expect(f.calls).not.toContain('create');
    expect(p.status).toBe('db');
    expect(p.online).toBe(true);
    expect(p.list).toEqual([]);
    expect(p.currentId).toBeUndefined();
  });

  it('el usuario crea la primera empresa y queda guardada y abierta', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    const def = await p.create(co('Mi Banco'));
    expect(def.company).toBe('Mi Banco');
    expect(f.rows).toHaveLength(1);
    expect(p.list.map((c) => c.name)).toEqual(['Mi Banco']);
    expect(p.currentId).toBe(f.rows[0].id);
    expect(f.settings.current_company).toBe(f.rows[0].id);
  });

  it('guardar cambios sube la versión; al volver a abrir se retoma la última empresa', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('Una'));
    await p.create(co('Dos'));
    p.save(co('Dos v2'));
    await p.settled();
    expect(f.rows.find((r) => r.name === 'Dos v2')?.version).toBe(2);

    const otra = new Persistence(f.backend, cache); // otra visita
    const abierta = await otra.boot();
    expect(abierta?.company).toBe('Dos v2'); // la que estaba abierta
    expect(otra.list).toHaveLength(2);
  });

  it('borrar la última empresa deja la aplicación otra vez en cero', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('Única'));
    expect(await p.removeCurrent()).toBeUndefined();
    expect(f.rows).toHaveLength(0);
    expect(p.currentId).toBeUndefined();
    expect(p.list).toEqual([]);
  });

  it('borrar una de varias abre otra', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('Una'));
    await p.create(co('Dos'));
    const next = await p.removeCurrent();
    expect(next?.company).toBe('Una');
    expect(f.rows).toHaveLength(1);
  });

  it('un conflicto (otra pestaña guardó antes) pregunta y respeta la respuesta', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('Base'));
    f.rows[0].yaml = companyToYaml(co('De la otra pestaña'));
    f.rows[0].name = 'De la otra pestaña';
    f.rows[0].version = 5; // la otra pestaña ya guardó
    let preguntado = false;
    p.onConflict = async () => {
      preguntado = true;
      return 'reload';
    };
    let recargada: CompanyDef | undefined;
    p.onReloaded = (d) => (recargada = d);
    p.save(co('Mío'));
    await p.settled();
    expect(preguntado).toBe(true);
    expect(recargada?.company).toBe('De la otra pestaña');
    expect(f.rows[0].name).toBe('De la otra pestaña'); // no se pisó
  });
});

describe('copia local del navegador', () => {
  it('lo que quedó en el navegador no se mezcla con una cuenta vacía y se borra', async () => {
    const f = fakeBackend();
    cache.write(companyToYaml(co('De otra cuenta')));
    const p = new Persistence(f.backend, cache);
    expect(await p.boot()).toBeUndefined(); // no se adopta
    expect(cache.read()).toBeNull(); // y se limpia
  });

  it('cada cambio guardado deja una copia local, y borrar la última la quita', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('Una'));
    expect(cache.read()).toContain('company: Una');
    p.save(co('Una v2'));
    expect(cache.read()).toContain('company: Una v2');
    await p.settled();
    await p.removeCurrent();
    expect(cache.read()).toBeNull();
  });

  it('sin conexión se retoma la copia local', async () => {
    const f = fakeBackend(false);
    cache.write(companyToYaml(co('Guardada en el navegador')));
    const p = new Persistence(f.backend, cache);
    expect((await p.boot())?.company).toBe('Guardada en el navegador');
    expect(p.status).toBe('local');
  });
});

describe('sin conexión', () => {
  it('avisa del motivo, trabaja solo en el navegador y no toca la base de datos', async () => {
    const f = fakeBackend(false);
    const p = new Persistence(f.backend, cache);
    expect(await p.boot()).toBeUndefined(); // sin copia local, también en cero
    expect(p.status).toBe('local');
    expect(p.detail).toContain('se guarda solo en este navegador');
    const def = await p.create(co('Local'));
    expect(def.company).toBe('Local');
    p.save(co('Local 2'));
    await p.settled();
    expect(f.calls).not.toContain('create');
    expect(f.calls).not.toContain('save');
  });
});
