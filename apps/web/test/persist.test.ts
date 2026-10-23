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
  const drafts = new Map<string, { baseVersion: number; body: string; savedAt: string }>();
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
    async getDraft(id, kind) {
      return drafts.get(`${id}/${kind}`);
    },
    async saveDraft(id, kind, baseVersion, body) {
      drafts.set(`${id}/${kind}`, { baseVersion, body, savedAt: '2026-10-23T12:00:00Z' });
    },
    async deleteDraft(id, kind) {
      drafts.delete(`${id}/${kind}`);
    },
    async setting(key) {
      return settings[key];
    },
    async setSetting(key, value) {
      settings[key] = value;
    },
  };
  return { backend, rows, settings, calls, drafts };
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

describe('días, semilla y velocidad se guardan por empresa y modo', () => {
  it('se recuperan al volver a abrir y no se mezclan entre empresas ni modos', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('A'));
    p.saveSimPrefs('explain', { days: 3, seed: 7, speed: 5 });
    p.saveSimPrefs('week', { days: 10, seed: 2, speed: 60 });
    await p.settled();
    expect(await p.simPrefs('explain')).toEqual({ days: 3, seed: 7, speed: 5 });
    expect(await p.simPrefs('week')).toEqual({ days: 10, seed: 2, speed: 60 });
    await p.create(co('B'));
    expect(await p.simPrefs('explain')).toBeUndefined();
    // una sesión nueva ve lo mismo
    const q = new Persistence(f.backend, memoryCache());
    await q.open(f.rows[0].id).catch(() => undefined);
    expect(await q.simPrefs('explain')).toEqual({ days: 3, seed: 7, speed: 5 });
  });

  it('un valor guardado inválido se ignora y los días se limitan a 1–30', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('A'));
    f.settings[`sim.${p.currentId}.week`] = '{"days":999,"seed":1,"speed":30}';
    f.settings[`sim.${p.currentId}.explain`] = 'no es json';
    expect((await p.simPrefs('week'))?.days).toBe(30);
    expect(await p.simPrefs('explain')).toBeUndefined();
  });

  it('sin base de datos no guarda nada y no falla', async () => {
    const f = fakeBackend(false);
    const p = new Persistence(f.backend, cache);
    await p.boot();
    p.saveSimPrefs('week', { days: 5, seed: 1, speed: 30 });
    expect(await p.simPrefs('week')).toBeUndefined();
    expect(Object.keys(f.settings)).toEqual([]);
  });
});

describe('modo y disposición son de la cuenta', () => {
  it('se guardan en la base de datos y los lee una sesión nueva, aun sin empresas', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    p.saveViewPref('mode', 'week');
    p.saveViewPref('layout', 'horizontal');
    const q = new Persistence(f.backend, memoryCache());
    await q.boot();
    expect(await q.viewPref('mode')).toBe('week');
    expect(await q.viewPref('layout')).toBe('horizontal');
    expect(await q.viewPref('otra')).toBeUndefined();
  });

  it('sin base de datos no guarda ni falla', async () => {
    const f = fakeBackend(false);
    const p = new Persistence(f.backend, cache);
    await p.boot();
    p.saveViewPref('mode', 'week');
    expect(await p.viewPref('mode')).toBeUndefined();
    expect(Object.keys(f.settings)).toEqual([]);
  });
});

describe('borradores de los formularios', () => {
  const withEdit = (name: string): CompanyDef => ({ ...co('A'), company: name });

  it('se guardan en la base de datos, se recuperan y se descartan', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('A'));
    expect(await p.draft('config')).toBeUndefined();
    p.saveDraft('config', withEdit('Editada'));
    p.saveDraft('hub', withEdit('Otra'));
    await p.settled();
    const d = await p.draft('config');
    expect(d?.def.company).toBe('Editada');
    expect(d?.stale).toBe(false);
    expect((await p.draft('hub'))?.def.company).toBe('Otra'); // cada formulario tiene el suyo
    // una sesión nueva (otro equipo) también lo ve
    const q = new Persistence(f.backend, memoryCache());
    await q.boot();
    expect((await q.draft('config'))?.def.company).toBe('Editada');
    p.discardDraft('config');
    await p.settled();
    expect(await p.draft('config')).toBeUndefined();
    expect(await p.draft('hub')).toBeDefined();
  });

  it('los guardados llegan en orden: el borrado de «Aplicar» gana a un borrador pendiente', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('A'));
    p.saveDraft('config', withEdit('Pendiente'));
    p.discardDraft('config');
    await p.settled();
    expect(await p.draft('config')).toBeUndefined();
  });

  it('avisa si la empresa se guardó otra vez después del borrador', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('A'));
    p.saveDraft('config', withEdit('Borrador'));
    p.save(withEdit('Cambio posterior'));
    await p.settled();
    expect((await p.draft('config'))?.stale).toBe(true);
  });

  it('un borrador dañado se ignora y sin base de datos no se guarda nada', async () => {
    const f = fakeBackend();
    const p = new Persistence(f.backend, cache);
    await p.boot();
    await p.create(co('A'));
    f.drafts.set(`${p.currentId}/config`, { baseVersion: 1, body: 'no es json', savedAt: 't' });
    f.drafts.set(`${p.currentId}/hub`, { baseVersion: 1, body: '{"x":1}', savedAt: 't' });
    expect(await p.draft('config')).toBeUndefined();
    expect(await p.draft('hub')).toBeUndefined();
    const off = fakeBackend(false);
    const o = new Persistence(off.backend, memoryCache());
    await o.boot();
    o.saveDraft('config', co('A'));
    await o.settled();
    expect(off.drafts.size).toBe(0);
  });
});
