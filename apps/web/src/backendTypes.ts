/** Lo común a las dos formas de guardar: la base de datos local (SQLite) y Nhost. */

export interface CompanyInfo {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  bytes: number;
}
export interface CompanyFull extends Omit<CompanyInfo, 'bytes'> {
  yaml: string;
}
export interface RevisionInfo {
  id: number;
  version: number;
  name: string;
  savedAt: string;
  note: string | null;
  bytes: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Resultado de guardar: bien, o conflicto si otra pestaña guardó antes. */
export type SaveResult = { ok: true; company: CompanyFull } | { ok: false; conflict: CompanyFull };

/** Cuenta de usuario (solo en Nhost). */
export interface AccountApi {
  readonly user: { id: string; email: string } | null;
  readonly signedIn: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsVerification: boolean }>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  onChange?: () => void;
}

export interface Backend {
  kind: 'sqlite' | 'nhost';
  /** cómo se llama en pantalla: «la base de datos», «Nhost» */
  label: string;
  /** solo con acceso por usuario (Nhost) */
  account?: AccountApi;
  /** ¿se puede guardar ahora? (hay servidor y, si hace falta, sesión) */
  ping(): Promise<boolean>;
  /** por qué falló la última comprobación (para mostrarlo al usuario) */
  lastError?: string;
  list(): Promise<CompanyInfo[]>;
  get(id: string): Promise<CompanyFull>;
  /** Crea la primera empresa si no hay ninguna; si ya hay (otra pestaña se adelantó), devuelve esa. */
  bootstrap(yaml: string): Promise<CompanyFull>;
  create(yaml: string, name?: string): Promise<CompanyFull>;
  save(id: string, yaml: string, version?: number, note?: string): Promise<SaveResult>;
  remove(id: string): Promise<void>;
  duplicate(id: string): Promise<CompanyFull>;
  revisions(id: string): Promise<RevisionInfo[]>;
  restore(id: string, revisionId: number): Promise<CompanyFull>;
  setting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<unknown>;
}
