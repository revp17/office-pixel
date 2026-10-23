import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { start } from '../src/server';

const banco = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');

let base = '';
let close: () => void = () => {};

beforeAll(async () => {
  const { server, store } = start(0, ':memory:'); // puerto libre, base en memoria
  await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => {
    server.close();
    store.close();
  };
});
afterAll(() => close());

const call = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  return { status: r.status, json: text ? JSON.parse(text) : undefined };
};

describe('API de empresas', () => {
  let id = '';

  it('responde que está viva', async () => {
    const r = await call('GET', '/api/health');
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, database: ':memory:', companies: 0 });
  });

  it('crea una empresa válida (el nombre sale del YAML) y la lista', async () => {
    const r = await call('POST', '/api/companies', { yaml: banco });
    expect(r.status).toBe(201);
    expect(r.json).toMatchObject({ name: 'Banco Pixel', version: 1 });
    id = r.json.id;
    const list = await call('GET', '/api/companies');
    expect(list.json).toHaveLength(1);
    expect(list.json[0]).toMatchObject({ id, name: 'Banco Pixel' });
    expect(list.json[0].yaml).toBeUndefined(); // la lista no trae el contenido
  });

  it('rechaza lo que no es una empresa válida y dice por qué', async () => {
    const mala = await call('POST', '/api/companies', { yaml: 'company: X\nunits: []\n' });
    expect(mala.status).toBe(400);
    expect(mala.json.errors.length).toBeGreaterThan(0);
    expect((await call('POST', '/api/companies', {})).status).toBe(400);
    expect((await call('POST', '/api/companies', { yaml: '   ' })).status).toBe(400);
    expect((await call('GET', '/api/companies')).json).toHaveLength(1); // no se guardó nada
  });

  it('lee una empresa con todo su contenido', async () => {
    const r = await call('GET', `/api/companies/${id}`);
    expect(r.status).toBe(200);
    expect(r.json.yaml).toBe(banco);
    expect((await call('GET', '/api/companies/no_existe')).status).toBe(404);
    expect((await call('GET', '/api/companies/..%2F..')).status).toBe(400);
  });

  it('actualiza con control de versión y avisa del conflicto', async () => {
    const nuevo = banco.replace('company: Banco Pixel', 'company: Banco Pixel 2');
    const ok = await call('PUT', `/api/companies/${id}`, { yaml: nuevo, version: 1, note: 'cambio de nombre' });
    expect(ok.status).toBe(200);
    expect(ok.json).toMatchObject({ name: 'Banco Pixel 2', version: 2 });
    const viejo = await call('PUT', `/api/companies/${id}`, { yaml: banco, version: 1 });
    expect(viejo.status).toBe(409);
    expect(viejo.json.current.version).toBe(2);
    expect((await call('GET', `/api/companies/${id}`)).json.name).toBe('Banco Pixel 2');
    expect((await call('PUT', `/api/companies/${id}`, { yaml: nuevo, version: 'x' })).status).toBe(400);
    expect((await call('PUT', `/api/companies/${id}`, { yaml: 'company: roto' })).status).toBe(400);
  });

  it('guarda el historial y permite restaurar una versión anterior', async () => {
    const hist = await call('GET', `/api/companies/${id}/revisions`);
    expect(hist.json).toHaveLength(1);
    expect(hist.json[0]).toMatchObject({ version: 1, name: 'Banco Pixel' });
    const rev = await call('GET', `/api/companies/${id}/revisions/${hist.json[0].id}`);
    expect(rev.json.yaml).toBe(banco);
    const back = await call('POST', `/api/companies/${id}/revisions/${hist.json[0].id}/restore`);
    expect(back.status).toBe(200);
    expect(back.json).toMatchObject({ name: 'Banco Pixel', version: 3 });
    expect((await call('GET', `/api/companies/${id}/revisions/99999`)).status).toBe(404);
  });

  it('duplica una empresa con otro nombre', async () => {
    const r = await call('POST', `/api/companies/${id}/duplicate`);
    expect(r.status).toBe(201);
    expect(r.json.name).toBe('Banco Pixel (copia)');
    expect(r.json.id).not.toBe(id);
    expect(r.json.yaml).toContain('company: "Banco Pixel (copia)"');
    expect((await call('GET', '/api/companies')).json).toHaveLength(2);
  });

  it('guarda preferencias', async () => {
    expect((await call('GET', '/api/settings/modo')).status).toBe(404);
    expect((await call('PUT', '/api/settings/modo', { value: 'week' })).status).toBe(200);
    expect((await call('GET', '/api/settings/modo')).json.value).toBe('week');
    expect((await call('PUT', '/api/settings/modo', { value: 3 })).status).toBe(400);
    expect((await call('PUT', '/api/settings/mal nombre', { value: 'x' })).status).toBe(400);
  });

  it('borra una empresa y todo lo suyo', async () => {
    expect((await call('DELETE', `/api/companies/${id}`)).status).toBe(204);
    expect((await call('GET', `/api/companies/${id}`)).status).toBe(404);
    expect((await call('GET', `/api/companies/${id}/revisions`)).status).toBe(404);
    expect((await call('GET', '/api/companies')).json).toHaveLength(1);
  });

  it('responde con errores claros ante rutas, métodos y cuerpos raros', async () => {
    expect((await call('GET', '/api/nada')).status).toBe(404);
    expect((await call('PATCH', '/api/companies')).status).toBe(405);
    const r = await fetch(`${base}/api/companies`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{no es json' });
    expect(r.status).toBe(400);
    const lista = await fetch(`${base}/api/companies`, { method: 'POST', body: '[1,2]' });
    expect(lista.status).toBe(400);
  });

  it('acepta empresas grandes (con ilustraciones) y rechaza las enormes', async () => {
    const grande = banco + `\n# ${'x'.repeat(2_000_000)}\n`;
    expect((await call('POST', '/api/companies', { yaml: grande })).status).toBe(201);
    const enorme = await fetch(`${base}/api/companies`, { method: 'POST', body: JSON.stringify({ yaml: 'x'.repeat(26 * 1024 * 1024) }) });
    expect(enorme.status).toBe(413);
  });

  it('sin la app compilada, la raíz explica cómo verla', async () => {
    const r = await fetch(base + '/');
    expect(r.status).toBe(200);
  });
});

describe('API: primera empresa sin duplicados', () => {
  it('dos pestañas que abren a la vez crean una sola empresa', async () => {
    const { server, store } = start(0, ':memory:');
    await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = () => fetch(`${url}/api/bootstrap`, { method: 'POST', body: JSON.stringify({ yaml: banco }) }).then(async (r) => ({ status: r.status, json: await r.json() }));
    const [a, b, c] = await Promise.all([post(), post(), post()]);
    expect(store.list()).toHaveLength(1);
    expect(new Set([a.json.id, b.json.id, c.json.id]).size).toBe(1);
    expect([a.status, b.status, c.status].filter((s) => s === 201)).toHaveLength(1);
    expect((await fetch(`${url}/api/bootstrap`)).status).toBe(405);
    expect((await fetch(`${url}/api/bootstrap`, { method: 'POST', body: JSON.stringify({ yaml: 'company: roto' }) })).status).toBe(400);
    server.close();
    store.close();
  });
});
