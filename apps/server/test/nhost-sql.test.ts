import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Prueba el esquema de Nhost (nhost/migrations) en un Postgres real en memoria:
 * triggers de versiones, historial, límite de 40 y la regla de «una sola empresa inicial».
 * (Los permisos por usuario los aplica Hasura con nhost/metadata; aquí se simulan las consultas que hará la app.)
 */
const up = readFileSync(new URL('../../../nhost/migrations/default/1792780000000_office_pixel/up.sql', import.meta.url), 'utf8');
const upDrafts = readFileSync(new URL('../../../nhost/migrations/default/1792790000000_company_drafts/up.sql', import.meta.url), 'utf8');
const downDrafts = readFileSync(new URL('../../../nhost/migrations/default/1792790000000_company_drafts/down.sql', import.meta.url), 'utf8');
const down = readFileSync(new URL('../../../nhost/migrations/default/1792780000000_office_pixel/down.sql', import.meta.url), 'utf8');

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';

let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  // lo que Nhost ya trae: el esquema auth y sus usuarios
  await pg.exec('CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY);');
  await pg.exec(`INSERT INTO auth.users (id) VALUES ('${U1}'), ('${U2}');`);
  await pg.exec(up);
  await pg.exec(upDrafts);
});
afterAll(async () => {
  await pg.close();
});

const one = async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0];
const all = async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows;

describe('esquema de Nhost', () => {
  let id = '';

  it('crea una empresa: versión 1, bytes calculados y fechas', async () => {
    const r = await one<{ id: string; version: number; yaml_bytes: number }>(
      `INSERT INTO public.companies (user_id, name, yaml) VALUES ($1, 'Ñandú', $2) RETURNING id, version, yaml_bytes`,
      [U1, 'company: Ñandú\n'],
    );
    id = r.id;
    expect(r.version).toBe(1);
    expect(r.yaml_bytes).toBe(Buffer.byteLength('company: Ñandú\n'));
  });

  it('al guardar un cambio sube la versión y deja la anterior en el historial con su nota', async () => {
    const r = await one<{ version: number; change_note: string | null; yaml: string }>(
      `UPDATE public.companies SET yaml = $2, change_note = $3 WHERE id = $1 RETURNING version, change_note, yaml`,
      [id, 'company: Ñandú\nx: 1\n', 'primer cambio'],
    );
    expect(r.version).toBe(2);
    expect(r.change_note).toBeNull(); // la nota se pasa al historial y se limpia
    const revs = await all<{ version: number; yaml: string; note: string | null; user_id: string }>('SELECT * FROM public.company_revisions WHERE company_id = $1', [id]);
    expect(revs).toHaveLength(1);
    expect(revs[0]).toMatchObject({ version: 1, yaml: 'company: Ñandú\n', note: 'primer cambio', user_id: U1 });
  });

  it('si no cambia nada, no sube la versión ni ensucia el historial', async () => {
    const r = await one<{ version: number }>(`UPDATE public.companies SET yaml = yaml WHERE id = $1 RETURNING version`, [id]);
    expect(r.version).toBe(2);
    expect((await all('SELECT 1 FROM public.company_revisions WHERE company_id = $1', [id])).length).toBe(1);
  });

  it('no pisa un cambio de otra pestaña: la actualización con versión vieja no toca nada', async () => {
    const mine = await pg.query(`UPDATE public.companies SET yaml = 'pisado' WHERE id = $1 AND version = $2`, [id, 1]);
    expect(mine.affectedRows).toBe(0); // la app lo interpreta como conflicto
    expect((await one<{ yaml: string }>('SELECT yaml FROM public.companies WHERE id = $1', [id])).yaml).toBe('company: Ñandú\nx: 1\n');
    const ok = await pg.query(`UPDATE public.companies SET yaml = 'company: Ñandú\nx: 2\n' WHERE id = $1 AND version = $2`, [id, 2]);
    expect(ok.affectedRows).toBe(1);
  });

  it('no se puede cambiar de dueño, de identificador ni la marca inicial desde un UPDATE', async () => {
    const r = await one<{ user_id: string; id: string; bootstrap: boolean }>(
      `UPDATE public.companies SET user_id = $2, bootstrap = true, id = gen_random_uuid() WHERE id = $1 RETURNING user_id, id, bootstrap`,
      [id, U2],
    );
    expect(r.user_id).toBe(U1);
    expect(r.id).toBe(id);
    expect(r.bootstrap).toBe(false);
  });

  it('el historial se recorta a las últimas 40 versiones', async () => {
    for (let i = 0; i < 50; i++) await pg.query(`UPDATE public.companies SET yaml = $2 WHERE id = $1`, [id, `cambio ${i}`]);
    const revs = await all<{ version: number }>('SELECT version FROM public.company_revisions WHERE company_id = $1 ORDER BY id DESC', [id]);
    expect(revs).toHaveLength(40);
    const cur = await one<{ version: number }>('SELECT version FROM public.companies WHERE id = $1', [id]);
    expect(revs[0].version).toBe(cur.version - 1);
  });

  it('dos pestañas que crean la empresa inicial a la vez: la segunda falla y no se duplica', async () => {
    await pg.query(`INSERT INTO public.companies (user_id, name, yaml, bootstrap) VALUES ($1, 'Inicial', 'a', true)`, [U2]);
    await expect(pg.query(`INSERT INTO public.companies (user_id, name, yaml, bootstrap) VALUES ($1, 'Inicial', 'a', true)`, [U2])).rejects.toThrow(/unique|duplicate/i);
    // el otro usuario sí puede tener la suya, y las empresas normales no tienen tope
    await pg.query(`INSERT INTO public.companies (user_id, name, yaml, bootstrap) VALUES ($1, 'Inicial', 'a', true)`, [U1]);
    await pg.query(`INSERT INTO public.companies (user_id, name, yaml) VALUES ($1, 'Otra', 'b'), ($1, 'Otra más', 'c')`, [U2]);
    expect((await all('SELECT 1 FROM public.companies WHERE user_id = $1', [U2])).length).toBe(3);
  });

  it('borrar una empresa borra su historial; borrar un usuario, todo lo suyo', async () => {
    await pg.query('DELETE FROM public.companies WHERE id = $1', [id]);
    expect((await all('SELECT 1 FROM public.company_revisions WHERE company_id = $1', [id])).length).toBe(0);
    await pg.query('DELETE FROM auth.users WHERE id = $1', [U2]);
    expect((await all('SELECT 1 FROM public.companies WHERE user_id = $1', [U2])).length).toBe(0);
  });

  it('las preferencias se guardan por usuario y se actualizan (upsert)', async () => {
    const up1 = `INSERT INTO public.settings (user_id, key, value) VALUES ($1, 'current_company', $2) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value`;
    await pg.query(up1, [U1, 'a']);
    await pg.query(up1, [U1, 'b']);
    expect((await all<{ value: string }>('SELECT value FROM public.settings WHERE user_id = $1', [U1])).map((r) => r.value)).toEqual(['b']);
    await expect(pg.query(`INSERT INTO public.settings (user_id, key, value) VALUES ($1, 'mal nombre', 'x')`, [U1])).rejects.toThrow();
  });

  it('rechaza una empresa de más de 25 MB', async () => {
    await expect(pg.query(`INSERT INTO public.companies (user_id, name, yaml) VALUES ($1, 'Enorme', repeat('x', 26214401))`, [U1])).rejects.toThrow();
  });

  it('borradores: uno por empresa y tipo, se reemplazan, no cambian de dueño y mueren con la empresa', async () => {
    const c = await one<{ id: string }>(`INSERT INTO public.companies (user_id, name, yaml) VALUES ($1, 'Con borrador', 'x') RETURNING id`, [U1]);
    const ins = `INSERT INTO public.company_drafts (company_id, user_id, kind, base_version, body) VALUES ($1, $2, $3, 1, $4)
      ON CONFLICT (company_id, kind) DO UPDATE SET body = EXCLUDED.body, base_version = EXCLUDED.base_version`;
    await pg.query(ins, [c.id, U1, 'config', '{"a":1}']);
    await pg.query(ins, [c.id, U1, 'config', '{"a":2}']);
    await pg.query(ins, [c.id, U1, 'hub', '{"h":1}']);
    expect((await all<{ kind: string; body: string }>('SELECT kind, body FROM public.company_drafts WHERE company_id = $1 ORDER BY kind', [c.id]))).toEqual([
      { kind: 'config', body: '{"a":2}' },
      { kind: 'hub', body: '{"h":1}' },
    ]);
    await expect(pg.query(ins, [c.id, U1, 'otro', 'x'])).rejects.toThrow(); // solo config y hub
    const moved = await one<{ user_id: string; kind: string }>(`UPDATE public.company_drafts SET user_id = $2, kind = 'hub', body = 'y' WHERE company_id = $1 AND kind = 'config' RETURNING user_id, kind`, [c.id, U1.replace(/1/g, '3')].slice(0, 1).concat([U2]));
    expect(moved).toEqual({ user_id: U1, kind: 'config' });
    await pg.query('DELETE FROM public.companies WHERE id = $1', [c.id]);
    expect((await all('SELECT 1 FROM public.company_drafts WHERE company_id = $1', [c.id])).length).toBe(0);
  });

  it('la migración se puede deshacer y volver a aplicar', async () => {
    await pg.exec(downDrafts);
    await pg.exec(down);
    expect((await all(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies'`)).length).toBe(0);
    await pg.exec(up);
    await pg.exec(upDrafts);
    await pg.exec(upDrafts); // repetirla no falla
    expect((await all(`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'companies'`)).length).toBe(1);
  });
});
