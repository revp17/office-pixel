#!/usr/bin/env node
/**
 * Prepara un proyecto de Nhost para Office-Pixel: crea las tablas (nhost/migrations), las hace visibles en
 * GraphQL y fija los permisos (cada usuario solo ve lo suyo, según nhost/metadata).
 *
 *   NHOST_SUBDOMAIN=abcdefgh NHOST_REGION=eu-central-1 NHOST_ADMIN_SECRET=... node nhost/setup.mjs
 *
 * El «admin secret» está en el panel de Nhost → Settings → Environment Variables (HASURA_GRAPHQL_ADMIN_SECRET).
 * Es una clave de administración: se pasa por variable de entorno y no se guarda en ningún archivo.
 * Se puede ejecutar más de una vez: lo que ya existe se respeta.
 */
import { buildMetadataRequests, hasuraUrl, readMigrationSql } from './lib.mjs';

const { NHOST_SUBDOMAIN: sub, NHOST_REGION: region, NHOST_ADMIN_SECRET: secret } = process.env;
if (!sub || !region || !secret) {
  console.error('Faltan variables: NHOST_SUBDOMAIN, NHOST_REGION y NHOST_ADMIN_SECRET.\nEjemplo: NHOST_SUBDOMAIN=abcdefgh NHOST_REGION=eu-central-1 NHOST_ADMIN_SECRET=... node nhost/setup.mjs');
  process.exit(1);
}

const base = hasuraUrl(sub, region);
const headers = { 'content-type': 'application/json', 'x-hasura-admin-secret': secret };

async function post(path, body) {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

const run_sql = (sql) => post('/v2/query', { type: 'run_sql', args: { source: 'default', sql } });

console.log(`Proyecto: ${base}`);

// 1) tablas
const exists = await run_sql("SELECT to_regclass('public.companies') IS NOT NULL AS existe");
if (!exists.ok) {
  console.error(`No se pudo conectar (${exists.status}). Revisa el subdominio, la región y el admin secret.\n`, JSON.stringify(exists.json));
  process.exit(1);
}
if (exists.json.result?.[1]?.[0] === 't' || exists.json.result?.[1]?.[0] === true) {
  console.log('• Las tablas ya existen: no se vuelven a crear.');
} else {
  const r = await run_sql(readMigrationSql());
  if (!r.ok) {
    console.error('• Error al crear las tablas:', JSON.stringify(r.json));
    process.exit(1);
  }
  console.log('• Tablas creadas: companies, company_revisions, settings (con sus triggers).');
}

// 2) seguimiento en GraphQL y permisos
const requests = buildMetadataRequests();
const r = await post('/v1/metadata', { type: 'bulk_keep_going', args: requests });
const results = Array.isArray(r.json) ? r.json : [];
const benign = (e) => /already-tracked|already exists|permission-denied|does not exist|not-exists|not found/i.test(JSON.stringify(e));
const failures = results.filter((x) => x && x.error && !benign(x));
if (!r.ok && !results.length) {
  console.error('• Error en los metadatos:', JSON.stringify(r.json));
  process.exit(1);
}
console.log(`• Metadatos aplicados (${requests.length} operaciones).`);
if (failures.length) {
  console.error('• Hubo errores que conviene revisar:');
  for (const f of failures) console.error('  -', f.error ?? JSON.stringify(f), f.code ? `(${f.code})` : '');
  process.exit(1);
}
console.log('\nListo. Ahora configura VITE_NHOST_SUBDOMAIN y VITE_NHOST_REGION en la aplicación (ver docs/publicar.md).');
