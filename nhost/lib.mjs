import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const here = fileURLToPath(new URL('.', import.meta.url));
export const MIGRATION_DIR = join(here, 'migrations', 'default');
export const TABLES_DIR = join(here, 'metadata', 'databases', 'default', 'tables');

const KINDS = ['insert', 'select', 'update', 'delete'];

/**
 * Las migraciones en orden (nhost/migrations/default/<fecha>_<nombre>/up.sql). La primera línea de cada una,
 * «-- marker: tabla», dice qué tabla crea: si ya existe, esa migración se omite.
 */
export function readMigrations(dir = MIGRATION_DIR) {
  return readdirSync(dir)
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name, 'up.sql'), 'utf8');
      const marker = /^-- marker: (\w+)/.exec(sql)?.[1];
      if (!marker) throw new Error(`La migración ${name} no declara «-- marker: tabla» en su primera línea.`);
      return { name, marker, sql };
    });
}

/** Tablas y permisos tal como los declaran los YAML de nhost/metadata (la fuente única). */
export function readTables(dir = TABLES_DIR) {
  return readdirSync(dir)
    .filter((f) => f.startsWith('public_') && f.endsWith('.yaml'))
    .sort()
    .map((f) => parse(readFileSync(join(dir, f), 'utf8')));
}

/**
 * Peticiones de la API de metadatos de Hasura para seguir las tablas y fijar los permisos.
 * Primero se quitan los permisos que hubiera (para poder volver a ejecutar el script) y luego se crean.
 */
export function buildMetadataRequests(tables = readTables(), source = 'default') {
  const reqs = [];
  for (const t of tables) {
    const table = { schema: t.table.schema, name: t.table.name };
    reqs.push({ type: 'pg_track_table', args: { source, table } });
  }
  for (const t of tables) {
    const table = { schema: t.table.schema, name: t.table.name };
    for (const kind of KINDS) {
      for (const p of t[`${kind}_permissions`] ?? []) reqs.push({ type: `pg_drop_${kind}_permission`, args: { source, table, role: p.role } });
    }
  }
  for (const t of tables) {
    const table = { schema: t.table.schema, name: t.table.name };
    for (const kind of KINDS) {
      for (const p of t[`${kind}_permissions`] ?? []) {
        reqs.push({ type: `pg_create_${kind}_permission`, args: { source, table, role: p.role, permission: p.permission } });
      }
    }
  }
  return reqs;
}

export const hasuraUrl = (subdomain, region) => `https://${subdomain}.hasura.${region}.nhost.run`;
