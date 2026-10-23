import { ApiError, type Backend, type CompanyFull, type CompanyInfo, type RevisionInfo, type SaveResult } from '../../application/ports';

/** Cliente de la API local de Office-Pixel (la base de datos SQLite del servidor). */

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

export const sqliteBackend: Backend = {
  kind: 'sqlite',
  label: 'la base de datos',
  async ping(): Promise<boolean> {
    try {
      const r = await request<{ ok?: boolean }>('GET', '/health', undefined, 2500);
      return r.ok === true;
    } catch {
      return false;
    }
  },
  list: () => request<CompanyInfo[]>('GET', '/companies'),
  get: (id) => request<CompanyFull>('GET', `/companies/${id}`),
  create: (yaml, name) => request<CompanyFull>('POST', '/companies', { yaml, ...(name ? { name } : {}) }),
  async save(id, yaml, version, note): Promise<SaveResult> {
    try {
      return { ok: true, company: await request<CompanyFull>('PUT', `/companies/${id}`, { yaml, ...(version === undefined ? {} : { version }), ...(note ? { note } : {}) }) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return { ok: false, conflict: e.body.current as CompanyFull };
      throw e;
    }
  },
  remove: (id) => request<void>('DELETE', `/companies/${id}`),
  duplicate: (id) => request<CompanyFull>('POST', `/companies/${id}/duplicate`),
  revisions: (id) => request<RevisionInfo[]>('GET', `/companies/${id}/revisions`),
  restore: (id, revisionId) => request<CompanyFull>('POST', `/companies/${id}/revisions/${revisionId}/restore`),
  async getDraft(id, kind) {
    try {
      const d = await request<{ baseVersion: number; savedAt: string; body: string }>('GET', `/companies/${id}/drafts/${kind}`);
      return { baseVersion: d.baseVersion, savedAt: d.savedAt, body: d.body };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  },
  async saveDraft(id, kind, baseVersion, body) {
    await request<unknown>('PUT', `/companies/${id}/drafts/${kind}`, { baseVersion, body });
  },
  async deleteDraft(id, kind) {
    await request<void>('DELETE', `/companies/${id}/drafts/${kind}`);
  },
  async setting(key) {
    try {
      return (await request<{ value: string }>('GET', `/settings/${key}`)).value;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return undefined;
      throw e;
    }
  },
  setSetting: (key, value) => request<unknown>('PUT', `/settings/${key}`, { value }),
};
