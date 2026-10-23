import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface CompanyRow {
  id: string;
  name: string;
  yaml: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export type CompanySummary = Omit<CompanyRow, 'yaml'> & { bytes: number };

export interface RevisionRow {
  id: number;
  companyId: string;
  version: number;
  name: string;
  yaml: string;
  savedAt: string;
  note: string | null;
}
export type RevisionSummary = Omit<RevisionRow, 'yaml'> & { bytes: number };

/** El que guarda tenía una versión vieja: otro cambio se guardó antes. */
export class ConflictError extends Error {
  constructor(readonly current: CompanyRow) {
    super('La empresa cambió desde que la abriste.');
  }
}

/** Cuántas versiones anteriores se conservan por empresa. */
export const MAX_REVISIONS = 40;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  yaml TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  yaml TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  note TEXT
);
CREATE INDEX IF NOT EXISTS revisions_company ON revisions(company_id, id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const now = () => new Date().toISOString();

type Raw = Record<string, unknown>;
const company = (r: Raw): CompanyRow => ({
  id: String(r.id),
  name: String(r.name),
  yaml: String(r.yaml),
  version: Number(r.version),
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});
const revision = (r: Raw): RevisionRow => ({
  id: Number(r.id),
  companyId: String(r.company_id),
  version: Number(r.version),
  name: String(r.name),
  yaml: String(r.yaml),
  savedAt: String(r.saved_at),
  note: r.note === null || r.note === undefined ? null : String(r.note),
});

/**
 * Base de datos de Office-Pixel (SQLite). Cada empresa se guarda completa (su YAML: áreas, personas, procesos,
 * procedimientos, ilustraciones…) con un número de versión; cada cambio deja una versión anterior consultable.
 */
export class Store {
  readonly db: DatabaseSync;

  constructor(readonly path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  // ---------- empresas ----------

  list(): CompanySummary[] {
    return (this.db.prepare('SELECT id, name, version, created_at, updated_at, length(CAST(yaml AS BLOB)) AS n FROM companies ORDER BY updated_at DESC, id').all() as Raw[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      version: Number(r.version),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      bytes: Number(r.n),
    }));
  }

  get(id: string): CompanyRow | undefined {
    const r = this.db.prepare('SELECT * FROM companies WHERE id = ?').get(id) as Raw | undefined;
    return r ? company(r) : undefined;
  }

  create(name: string, yaml: string): CompanyRow {
    const id = `emp_${randomUUID().slice(0, 8)}`;
    const t = now();
    this.db.prepare('INSERT INTO companies (id, name, yaml, version, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)').run(id, name, yaml, t, t);
    return this.get(id)!;
  }

  /**
   * Primera empresa de una base de datos vacía. Si dos pestañas abren la app a la vez, solo se crea una:
   * la segunda recibe la que ya existe.
   */
  bootstrap(name: string, yaml: string): { company: CompanyRow; created: boolean } {
    const first = this.db.prepare('SELECT id FROM companies ORDER BY created_at, id LIMIT 1').get() as Raw | undefined;
    if (first) return { company: this.get(String(first.id))!, created: false };
    return { company: this.create(name, yaml), created: true };
  }

  /**
   * Guarda la empresa. Si `expectedVersion` no coincide con la guardada, lanza ConflictError (no se pisa el cambio
   * de otra pestaña). Si el contenido no cambió, no hace nada. Antes de sobrescribir se conserva la versión anterior.
   */
  save(id: string, name: string, yaml: string, expectedVersion?: number, note?: string): CompanyRow | undefined {
    const cur = this.get(id);
    if (!cur) return undefined;
    if (expectedVersion !== undefined && expectedVersion !== cur.version) throw new ConflictError(cur);
    if (cur.yaml === yaml && cur.name === name) return cur;
    this.db.exec('BEGIN');
    try {
      this.db.prepare('INSERT INTO revisions (company_id, version, name, yaml, saved_at, note) VALUES (?, ?, ?, ?, ?, ?)').run(id, cur.version, cur.name, cur.yaml, cur.updatedAt, note ?? null);
      this.db.prepare('DELETE FROM revisions WHERE company_id = ? AND id NOT IN (SELECT id FROM revisions WHERE company_id = ? ORDER BY id DESC LIMIT ?)').run(id, id, MAX_REVISIONS);
      this.db.prepare('UPDATE companies SET name = ?, yaml = ?, version = version + 1, updated_at = ? WHERE id = ?').run(name, yaml, now(), id);
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    return this.get(id)!;
  }

  remove(id: string): boolean {
    return Number(this.db.prepare('DELETE FROM companies WHERE id = ?').run(id).changes) > 0;
  }

  // ---------- versiones anteriores ----------

  revisions(id: string): RevisionSummary[] {
    return (this.db.prepare('SELECT id, company_id, version, name, saved_at, note, length(CAST(yaml AS BLOB)) AS n FROM revisions WHERE company_id = ? ORDER BY id DESC').all(id) as Raw[]).map((r) => ({
      id: Number(r.id),
      companyId: String(r.company_id),
      version: Number(r.version),
      name: String(r.name),
      savedAt: String(r.saved_at),
      note: r.note === null ? null : String(r.note),
      bytes: Number(r.n),
    }));
  }

  revision(companyId: string, revisionId: number): RevisionRow | undefined {
    const r = this.db.prepare('SELECT * FROM revisions WHERE company_id = ? AND id = ?').get(companyId, revisionId) as Raw | undefined;
    return r ? revision(r) : undefined;
  }

  // ---------- preferencias ----------

  getSetting(key: string): string | undefined {
    const r = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Raw | undefined;
    return r ? String(r.value) : undefined;
  }

  setSetting(key: string, value: string) {
    this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  stats() {
    return { companies: Number((this.db.prepare('SELECT count(*) AS n FROM companies').get() as Raw).n) };
  }
}
