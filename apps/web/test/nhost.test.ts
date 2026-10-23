import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { companyToYaml, parseCompany } from '@office-pixel/sim';
import { ApiError } from '../src/application/ports';
import { createNhostBackend } from '../src/infrastructure/backend/nhostDb';
import { AuthError, NhostAuth, nhostEndpoints } from '../src/infrastructure/backend/nhostAuth';

const banco = readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8');
const yamlOf = (name: string) => companyToYaml({ ...parseCompany(banco).def!, company: name });

const EP = { auth: 'https://demo.auth.eu-central-1.nhost.run/v1', graphql: 'https://demo.graphql.eu-central-1.nhost.run/v1' };

interface Co {
  id: string;
  name: string;
  yaml: string;
  version: number;
  created_at: string;
  updated_at: string;
  bootstrap: boolean;
}

/** Un Nhost de mentira: Auth + Hasura con las mismas reglas que el esquema SQL (versión, historial, una empresa inicial). */
function fakeNhost() {
  const state = {
    companies: [] as Co[],
    revisions: [] as Array<{ id: number; company_id: string; version: number; name: string; yaml: string; saved_at: string; note: string | null }>,
    settings: {} as Record<string, string>,
    drafts: {} as Record<string, { base_version: number; body: string; updated_at: string }>,
    accounts: { 'ana@correo.com': 'claveSegura1' } as Record<string, string>,
    validTokens: new Set<string>(),
    issued: 0,
    refreshes: 0,
    expiresIn: 900,
    log: [] as string[],
    requireVerification: false,
  };
  let rev = 0;
  let uid = 0;
  const session = (email: string) => {
    const n = ++state.issued;
    const accessToken = `tok-${n}`;
    state.validTokens.add(accessToken);
    return { accessToken, accessTokenExpiresIn: state.expiresIn, refreshToken: `ref-${n}`, user: { id: 'user-1', email } };
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const row = (c: Co) => ({ id: c.id, name: c.name, yaml: c.yaml, version: c.version, created_at: c.created_at, updated_at: c.updated_at, yaml_bytes: Buffer.byteLength(c.yaml) });

  const update = (c: Co, set: { name: string; yaml: string; change_note: string | null }) => {
    if (set.yaml !== c.yaml || set.name !== c.name) {
      state.revisions.push({ id: ++rev, company_id: c.id, version: c.version, name: c.name, yaml: c.yaml, saved_at: c.updated_at, note: set.change_note });
      c.version += 1;
      c.updated_at = new Date().toISOString();
      c.name = set.name;
      c.yaml = set.yaml;
    }
    return c;
  };

  const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (u.startsWith(EP.auth)) {
      const path = u.slice(EP.auth.length);
      state.log.push(`auth ${path}`);
      if (path === '/signin/email-password') {
        if (state.accounts[body.email] !== body.password) return json(401, { error: 'invalid-email-password', message: 'Incorrect email or password' });
        return json(200, { session: session(body.email) });
      }
      if (path === '/signup/email-password') {
        if (state.accounts[body.email]) return json(409, { error: 'email-already-in-use', message: 'x' });
        if (String(body.password).length < 9) return json(400, { error: 'weak-password', message: 'x' });
        state.accounts[body.email] = body.password;
        return json(200, { session: state.requireVerification ? null : session(body.email) });
      }
      if (path === '/token') {
        if (!String(body.refreshToken).startsWith('ref-')) return json(401, { error: 'invalid-refresh-token', message: 'x' });
        state.refreshes++;
        return json(200, session('ana@correo.com'));
      }
      if (path === '/signout' || path === '/user/password/reset') return json(200, 'OK');
      return json(404, {});
    }

    // GraphQL
    const token = String((init?.headers as Record<string, string>)?.authorization ?? '').replace('Bearer ', '');
    if (!state.validTokens.has(token)) return json(200, { errors: [{ message: 'Could not verify JWT: JWTExpired', extensions: { code: 'invalid-jwt' } }] });
    const q: string = body.query;
    const v = body.variables ?? {};
    state.log.push(q.match(/(query|mutation)[^{]*\{\s*(\w+)/)?.[2] ?? 'gql');
    const ok = (data: unknown) => json(200, { data });

    if (q.includes('delete_companies_by_pk')) {
      state.companies = state.companies.filter((x) => x.id !== v.id);
      state.revisions = state.revisions.filter((r) => r.company_id !== v.id);
      return ok({ delete_companies_by_pk: { id: v.id } });
    }
    // como en Hasura: los conteos (aggregate) solo existen si el permiso lo habilita, y el nuestro no
    if (q.includes('companies_aggregate')) return json(200, { errors: [{ message: "field 'companies_aggregate' not found in type: 'query_root'", extensions: { code: 'validation-failed' } }] });
    if (q.includes('companies(limit')) return ok({ companies: state.companies.slice(0, 1).map(row) });
    if (q.includes('companies(order_by')) return ok({ companies: [...state.companies].reverse().map(row) });
    if (q.includes('companies_by_pk(id')) {
      const c = state.companies.find((x) => x.id === v.id);
      return ok({ companies_by_pk: c ? row(c) : null });
    }
    if (q.includes('insert_companies_one')) {
      if (v.o.bootstrap && state.companies.some((c) => c.bootstrap)) return json(200, { errors: [{ message: 'Uniqueness violation.', extensions: { code: 'constraint-violation' } }] });
      const t = new Date().toISOString();
      const c: Co = { id: `co-${++uid}`, name: v.o.name, yaml: v.o.yaml, version: 1, created_at: t, updated_at: t, bootstrap: !!v.o.bootstrap };
      state.companies.push(c);
      return ok({ insert_companies_one: row(c) });
    }
    if (q.includes('update_companies_by_pk')) {
      const c = state.companies.find((x) => x.id === v.id);
      return ok({ update_companies_by_pk: c ? row(update(c, v.set)) : null });
    }
    if (q.includes('update_companies(where')) {
      const c = state.companies.find((x) => x.id === v.id && x.version === v.v);
      return ok({ update_companies: { affected_rows: c ? 1 : 0, returning: c ? [row(update(c, v.set))] : [] } });
    }
    if (q.includes('company_revisions(where')) {
      return ok({ company_revisions: state.revisions.filter((r) => r.company_id === v.id).reverse().map((r) => ({ ...r, id: String(r.id), saved_at: r.saved_at, yaml_bytes: Buffer.byteLength(r.yaml) })) });
    }
    if (q.includes('company_revisions_by_pk')) {
      const r = state.revisions.find((x) => x.id === v.rid);
      return ok({ company_revisions_by_pk: r ? { yaml: r.yaml, version: r.version } : null });
    }
    if (q.includes('company_drafts_by_pk') && q.startsWith('query')) {
      return ok({ company_drafts_by_pk: state.drafts[`${v.id}/${v.k}`] ?? null });
    }
    if (q.includes('insert_company_drafts_one')) {
      const o = v.o;
      state.drafts[`${o.company_id}/${o.kind}`] = { base_version: o.base_version, body: o.body, updated_at: '2026-10-23T12:00:00Z' };
      return ok({ insert_company_drafts_one: { kind: o.kind } });
    }
    if (q.includes('delete_company_drafts_by_pk')) {
      delete state.drafts[`${v.id}/${v.k}`];
      return ok({ delete_company_drafts_by_pk: { kind: v.k } });
    }
    if (q.includes('insert_settings_one')) {
      state.settings[v.o.key] = v.o.value;
      return ok({ insert_settings_one: { key: v.o.key } });
    }
    if (q.includes('settings(where')) return ok({ settings: v.k in state.settings ? [{ value: state.settings[v.k] }] : [] });
    return json(400, { errors: [{ message: `consulta no prevista: ${q.slice(0, 60)}` }] });
  }) as typeof fetch;

  return { state, fetcher };
}

const signedIn = async (n = fakeNhost()) => {
  const be = createNhostBackend(EP, n.fetcher);
  await be.account.signIn('ana@correo.com', 'claveSegura1');
  return { ...n, be };
};

describe('configuración de Nhost', () => {
  it('arma las direcciones a partir del subdominio y la región, o de URLs completas', () => {
    expect(nhostEndpoints({ VITE_NHOST_SUBDOMAIN: 'abc', VITE_NHOST_REGION: 'eu-central-1' })).toEqual({
      auth: 'https://abc.auth.eu-central-1.nhost.run/v1',
      graphql: 'https://abc.graphql.eu-central-1.nhost.run/v1',
    });
    expect(nhostEndpoints({ VITE_NHOST_AUTH_URL: 'http://localhost:1337/v1/', VITE_NHOST_GRAPHQL_URL: 'http://localhost:1337/graphql/' })).toEqual({ auth: 'http://localhost:1337/v1', graphql: 'http://localhost:1337/graphql' });
    expect(nhostEndpoints({})).toBeUndefined();
    expect(nhostEndpoints({ VITE_NHOST_SUBDOMAIN: 'abc' })).toBeUndefined(); // sin región no hay proyecto
  });
});

describe('acceso con cuenta', () => {
  it('entra, guarda la sesión y entrega el token', async () => {
    const { be } = await signedIn();
    expect(be.account.signedIn).toBe(true);
    expect(be.account.user).toEqual({ id: 'user-1', email: 'ana@correo.com' });
    expect(await be.account.accessToken()).toBe('tok-1');
  });

  it('explica en español cuando la contraseña es incorrecta', async () => {
    const be = createNhostBackend(EP, fakeNhost().fetcher);
    await expect(be.account.signIn('ana@correo.com', 'mala')).rejects.toThrow('El correo o la contraseña no son correctos.');
    expect(be.account.signedIn).toBe(false);
    expect(await be.ping()).toBe(false); // sin sesión no hay conexión útil
  });

  it('crea cuentas: con sesión directa, o pidiendo verificar el correo', async () => {
    const n = fakeNhost();
    const be = createNhostBackend(EP, n.fetcher);
    expect(await be.account.signUp('nuevo@correo.com', 'otraClave123')).toEqual({ needsVerification: false });
    expect(be.account.user?.email).toBe('nuevo@correo.com');
    n.state.requireVerification = true;
    const be2 = createNhostBackend(EP, n.fetcher);
    expect(await be2.account.signUp('otro@correo.com', 'otraClave123')).toEqual({ needsVerification: true });
    expect(be2.account.signedIn).toBe(false);
    await expect(be2.account.signUp('ana@correo.com', 'otraClave123')).rejects.toThrow(/Ya existe una cuenta/);
    await expect(be2.account.signUp('x@correo.com', 'corta')).rejects.toThrow(/débil o corta/);
    await be2.account.resetPassword('otro@correo.com');
  });

  it('renueva el token cuando está por caducar, sin pedir la contraseña', async () => {
    const n = fakeNhost();
    n.state.expiresIn = 30; // caduca en menos de un minuto: se renueva en cada uso
    const { be } = await signedIn(n);
    const t = await be.account.accessToken();
    expect(t).toBe('tok-2');
    expect(n.state.refreshes).toBe(1);
  });

  it('si Nhost rechaza el refresco, cierra la sesión; sin red, la conserva', async () => {
    const n = fakeNhost();
    n.state.expiresIn = 30;
    const a = new NhostAuth(EP.auth, n.fetcher);
    await a.signIn('ana@correo.com', 'claveSegura1');
    let changed = 0;
    a.onChange = () => changed++;
    const broken = new NhostAuth(EP.auth, (async () => json500()) as unknown as typeof fetch);
    expect(broken.signedIn).toBe(false);
    expect(await a.accessToken(true)).toBe('tok-2');
    expect(changed).toBe(1);
    // sin red
    const offline = new NhostAuth(EP.auth, (async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    await expect(offline.signIn('a@b.c', 'x')).rejects.toBeInstanceOf(AuthError);
  });

  it('cerrar sesión borra la sesión', async () => {
    const { be, state } = await signedIn();
    await be.account.signOut();
    expect(be.account.signedIn).toBe(false);
    expect(state.log).toContain('auth /signout');
    expect(await be.account.accessToken()).toBeNull();
  });
});
const json500 = () => new Response('{}', { status: 500 });

describe('empresas en Nhost', () => {
  it('crea una empresa con el nombre de su YAML y la lee de vuelta', async () => {
    const { be, state } = await signedIn();
    expect(await be.list()).toEqual([]); // una cuenta nueva no trae nada
    const a = await be.create(yamlOf('Mi Banco'));
    expect(a).toMatchObject({ name: 'Mi Banco', version: 1 });
    expect(state.companies).toHaveLength(1);
    expect((await be.get(a.id)).yaml).toContain('company: Mi Banco');
    expect(await be.ping()).toBe(true);
    expect(be.lastError).toBeUndefined();
  });

  it('la comprobación de conexión no usa consultas que los permisos no habilitan, y explica por qué falla', async () => {
    const { be, state } = await signedIn();
    expect(await be.ping()).toBe(true);
    expect(state.log).not.toContain('companies_aggregate');
    const rota = createNhostBackend(EP, (async () => new Response(JSON.stringify({ errors: [{ message: 'Permiso denegado', extensions: { code: 'access-denied' } }] }), { status: 200 })) as unknown as typeof fetch);
    await rota.account.signIn('ana@correo.com', 'claveSegura1').catch(() => undefined);
    expect(await rota.ping()).toBe(false);
    expect(rota.lastError).toBeTruthy();
  });

  it('guarda con control de versión: cambia, no pisa y avisa del conflicto', async () => {
    const { be } = await signedIn();
    const c = await be.create(yamlOf('A'));
    const v2 = await be.save(c.id, yamlOf('A'), 1);
    expect(v2.ok && v2.company.version).toBe(1); // sin cambios: misma versión
    const v3 = await be.save(c.id, yamlOf('A2'), 1, 'cambio');
    expect(v3.ok && v3.company).toMatchObject({ name: 'A2', version: 2 });
    const viejo = await be.save(c.id, yamlOf('Mio'), 1); // yo seguía en la versión 1
    expect(viejo.ok).toBe(false);
    expect(!viejo.ok && viejo.conflict.name).toBe('A2');
    expect((await be.get(c.id)).name).toBe('A2'); // no se perdió nada
    const forzado = await be.save(c.id, yamlOf('Forzado'));
    expect(forzado.ok && forzado.company.version).toBe(3);
  });

  it('rechaza guardar algo que no es una empresa válida sin llamar a Nhost', async () => {
    const { be, state } = await signedIn();
    const c = await be.create(yamlOf('A'));
    const antes = state.log.length;
    await expect(be.save(c.id, 'company: roto')).rejects.toMatchObject({ status: 400 });
    expect(state.log.length).toBe(antes);
    await expect(be.create('company: roto')).rejects.toBeInstanceOf(ApiError);
  });

  it('lista, duplica, borra y respeta el historial', async () => {
    const { be, state } = await signedIn();
    const a = await be.create(yamlOf('Primera'));
    await be.save(a.id, yamlOf('Primera v2'), undefined, 'segundo');
    const copy = await be.duplicate(a.id);
    expect(copy.name).toBe('Primera v2 (copia)');
    expect(copy.yaml).toContain('company: "Primera v2 (copia)"');
    const lista = await be.list();
    expect(lista.map((x) => x.name)).toEqual(['Primera v2 (copia)', 'Primera v2']);
    expect(lista[0].bytes).toBeGreaterThan(1000);
    const revs = await be.revisions(a.id);
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ version: 1, name: 'Primera', note: 'segundo' });
    await be.remove(a.id);
    expect(state.revisions).toHaveLength(0);
    await expect(be.get(a.id)).rejects.toMatchObject({ status: 404 });
  });

  it('restaura una versión anterior como un cambio nuevo', async () => {
    const { be } = await signedIn();
    const a = await be.create(yamlOf('Original'));
    await be.save(a.id, yamlOf('Cambiada'));
    const [rev] = await be.revisions(a.id);
    const back = await be.restore(a.id, rev.id);
    expect(back).toMatchObject({ name: 'Original', version: 3 });
    expect((await be.revisions(a.id))[0].note).toBe('Restaurada la versión 1');
    await expect(be.restore(a.id, 9999)).rejects.toMatchObject({ status: 404 });
  });

  it('guarda, lee y borra borradores por empresa y tipo (upsert)', async () => {
    const { be } = await signedIn();
    const a = await be.create(banco);
    expect(await be.getDraft(a.id, 'config')).toBeUndefined();
    await be.saveDraft(a.id, 'config', 1, '{"v":1}');
    await be.saveDraft(a.id, 'config', 2, '{"v":2}');
    await be.saveDraft(a.id, 'hub', 2, '{"h":1}');
    expect(await be.getDraft(a.id, 'config')).toEqual({ baseVersion: 2, savedAt: '2026-10-23T12:00:00Z', body: '{"v":2}' });
    await be.deleteDraft(a.id, 'config');
    expect(await be.getDraft(a.id, 'config')).toBeUndefined();
    expect((await be.getDraft(a.id, 'hub'))?.body).toBe('{"h":1}');
  });

  it('guarda preferencias por clave', async () => {
    const { be } = await signedIn();
    expect(await be.setting('current_company')).toBeUndefined();
    await be.setSetting('current_company', 'co-1');
    await be.setSetting('current_company', 'co-2');
    expect(await be.setting('current_company')).toBe('co-2');
  });

  it('si el token caduca a mitad de camino, lo renueva y repite la consulta una vez', async () => {
    const n = fakeNhost();
    const { be } = await signedIn(n);
    n.state.validTokens.clear(); // el servidor ya no acepta el token que tiene la app
    const lista = await be.list();
    expect(lista).toEqual([]);
    expect(n.state.refreshes).toBe(1);
    expect(n.state.log).toContain('auth /token'); // se renovó el token antes de repetir
  });

  it('sin sesión no consulta nada y lo dice', async () => {
    const be = createNhostBackend(EP, fakeNhost().fetcher);
    await expect(be.list()).rejects.toMatchObject({ status: 401 });
  });
});
