/** Cliente de la API de Office-Pixel (la base de datos SQLite del servidor). */

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

async function request<T>(method: string, path: string, body?: unknown, timeoutMs = 20_000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // una página HTML (por ejemplo, sin servidor de API) no es una respuesta de la API
      throw new ApiError(res.status, 'El servidor no respondió como la API.');
    }
    if (!res.ok) {
      const b = (json ?? {}) as Record<string, unknown>;
      throw new ApiError(res.status, String(b.error ?? `Error ${res.status}`), b);
    }
    return json as T;
  } finally {
    clearTimeout(timer);
  }
}

export const db = {
  /** ¿Hay servidor de API con base de datos? */
  async ping(): Promise<boolean> {
    try {
      const r = await request<{ ok?: boolean }>('GET', '/health', undefined, 2500);
      return r.ok === true;
    } catch {
      return false;
    }
  },
  list: () => request<CompanyInfo[]>('GET', '/companies'),
  get: (id: string) => request<CompanyFull>('GET', `/companies/${id}`),
  /** Crea la primera empresa si la base de datos está vacía; si ya hay una (otra pestaña se adelantó), devuelve esa. */
  bootstrap: (yaml: string) => request<CompanyFull>('POST', '/bootstrap', { yaml }),
  create: (yaml: string, name?: string) => request<CompanyFull>('POST', '/companies', { yaml, ...(name ? { name } : {}) }),
  async save(id: string, yaml: string, version?: number, note?: string): Promise<SaveResult> {
    try {
      return { ok: true, company: await request<CompanyFull>('PUT', `/companies/${id}`, { yaml, ...(version === undefined ? {} : { version }), ...(note ? { note } : {}) }) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return { ok: false, conflict: e.body.current as CompanyFull };
      throw e;
    }
  },
  remove: (id: string) => request<void>('DELETE', `/companies/${id}`),
  duplicate: (id: string) => request<CompanyFull>('POST', `/companies/${id}/duplicate`),
  revisions: (id: string) => request<RevisionInfo[]>('GET', `/companies/${id}/revisions`),
  restore: (id: string, revisionId: number) => request<CompanyFull>('POST', `/companies/${id}/revisions/${revisionId}/restore`),
  async setting(key: string): Promise<string | undefined> {
    try {
      return (await request<{ value: string }>('GET', `/settings/${key}`)).value;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  },
  setSetting: (key: string, value: string) => request<unknown>('PUT', `/settings/${key}`, { value }),
};
