import type { Backend } from './backendTypes';
import { createNhostBackend } from './nhostDb';
import { nhostEndpoints } from './nhostAuth';
import { sqliteBackend } from './sqliteDb';

export * from './backendTypes';

/**
 * Dónde se guardan las empresas: en Nhost si la aplicación está configurada con un proyecto
 * (VITE_NHOST_SUBDOMAIN y VITE_NHOST_REGION); si no, en la base de datos SQLite local (`npm run dev` / `npm start`).
 */
const endpoints = nhostEndpoints(import.meta.env as unknown as Record<string, string | undefined>);
export const db: Backend = endpoints ? createNhostBackend(endpoints) : sqliteBackend;
