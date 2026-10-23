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

describe('borradores de formularios', () => {
  let id = '';
  it('se guardan por empresa y tipo, se reemplazan y se borran', async () => {
    id = (await call('POST', '/api/companies', { yaml: banco })).json.id;
    expect((await call('GET', `/api/companies/${id}/drafts/config`)).status).toBe(404);
    const a = await call('PUT', `/api/companies/${id}/drafts/config`, { baseVersion: 1, body: '{"a":1}' });
    expect(a.status).toBe(200);
    expect(a.json).toMatchObject({ kind: 'config', baseVersion: 1, body: '{"a":1}' });
    await call('PUT', `/api/companies/${id}/drafts/config`, { baseVersion: 2, body: '{"a":2}' });
    await call('PUT', `/api/companies/${id}/drafts/hub`, { baseVersion: 2, body: '{"h":1}' });
    expect((await call('GET', `/api/companies/${id}/drafts/config`)).json).toMatchObject({ baseVersion: 2, body: '{"a":2}' });
    expect((await call('GET', `/api/companies/${id}/drafts/hub`)).json.body).toBe('{"h":1}'); // no se mezclan los tipos
    expect((await call('DELETE', `/api/companies/${id}/drafts/config`)).status).toBe(204);
    expect((await call('GET', `/api/companies/${id}/drafts/config`)).status).toBe(404);
    expect((await call('GET', `/api/companies/${id}/drafts/hub`)).status).toBe(200);
  });

  it('rechaza tipos y datos no válidos, y se borran con la empresa', async () => {
    expect((await call('GET', `/api/companies/${id}/drafts/otro`)).status).toBe(400);
    expect((await call('PUT', `/api/companies/${id}/drafts/hub`, { baseVersion: 'x', body: 'z' })).status).toBe(400);
    expect((await call('PUT', `/api/companies/${id}/drafts/hub`, { baseVersion: 1 })).status).toBe(400);
    await call('DELETE', `/api/companies/${id}`);
    expect((await call('GET', `/api/companies/${id}/drafts/hub`)).status).toBe(404);
  });
});
