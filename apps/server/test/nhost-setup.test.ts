import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo .mjs sin tipos
import { buildMetadataRequests, hasuraUrl, readMigrations, readTables } from '../../../nhost/lib.mjs';

type Req = { type: string; args: { table: { name: string }; role?: string; permission?: Record<string, unknown> } };

describe('preparación de Nhost (nhost/setup.mjs)', () => {
  const tables = readTables() as Array<{ table: { name: string; schema: string } }>;
  const reqs = buildMetadataRequests() as Req[];

  it('lee las cuatro tablas de los metadatos', () => {
    expect(tables.map((t) => t.table.name).sort()).toEqual(['companies', 'company_drafts', 'company_revisions', 'settings']);
    expect(tables.every((t) => t.table.schema === 'public')).toBe(true);
  });

  it('sigue cada tabla y luego quita y crea los permisos (se puede repetir)', () => {
    expect(reqs.filter((r) => r.type === 'pg_track_table')).toHaveLength(4);
    const order = reqs.map((r) => r.type.replace(/^pg_(drop|create)_(\w+)_permission$/, '$1'));
    const lastDrop = order.lastIndexOf('drop');
    const firstCreate = order.indexOf('create');
    expect(lastDrop).toBeLessThan(firstCreate); // primero se quitan todos, luego se crean
    expect(reqs.filter((r) => r.type.startsWith('pg_drop_')).length).toBe(reqs.filter((r) => r.type.startsWith('pg_create_')).length);
  });

  it('todo permiso es del rol «user» y limita a las filas del propio usuario', () => {
    const perms = reqs.filter((r) => r.type.startsWith('pg_create_'));
    expect(perms.length).toBeGreaterThanOrEqual(13);
    for (const p of perms) {
      expect(p.args.role).toBe('user');
      const permission = p.args.permission as { filter?: unknown; check?: unknown; set?: Record<string, string> };
      if (p.type === 'pg_create_insert_permission') expect(permission.set?.user_id).toBe('x-hasura-user-id'); // el dueño lo pone el servidor
      else expect(JSON.stringify(permission.filter)).toContain('X-Hasura-User-Id');
    }
  });

  it('el historial es de solo lectura y las empresas no dejan cambiar al dueño', () => {
    const on = (table: string) => reqs.filter((r) => r.type.startsWith('pg_create_') && r.args.table.name === table).map((r) => r.type);
    expect(on('company_revisions')).toEqual(['pg_create_select_permission']);
    const upd = reqs.find((r) => r.type === 'pg_create_update_permission' && r.args.table.name === 'companies')!;
    const cols = upd.args.permission!.columns as string[];
    expect(cols).toEqual(expect.arrayContaining(['name', 'yaml', 'change_note']));
    expect(cols).not.toContain('user_id');
    const ins = reqs.find((r) => r.type === 'pg_create_insert_permission' && r.args.table.name === 'companies')!;
    expect(ins.args.permission!.columns as string[]).not.toContain('user_id');
  });

  it('el SQL y la dirección de Hasura son los esperados', () => {
    const migs = readMigrations() as Array<{ name: string; marker: string; sql: string }>;
    expect(migs.map((m) => m.marker)).toEqual(['companies', 'company_drafts']);
    expect(migs[0].sql).toContain('CREATE TABLE public.companies');
    expect(hasuraUrl('abc', 'eu-central-1')).toBe('https://abc.hasura.eu-central-1.nhost.run');
  });
});
