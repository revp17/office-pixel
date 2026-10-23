import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCompany } from '@office-pixel/sim';
import { ConflictError, type Store } from './store';

/** Tamaño máximo de lo que se guarda de una vez (las ilustraciones e imágenes van dentro). */
export const MAX_BODY = 25 * 1024 * 1024;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function send(res: ServerResponse, status: number, body?: unknown) {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text), 'cache-control': 'no-store' }).end(text);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, 'Lo que se quiere guardar es demasiado grande (máximo 25 MB).');
    chunks.push(c as Buffer);
  }
  if (!chunks.length) return {};
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('no es un objeto');
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'El cuerpo debe ser un objeto JSON.');
  }
}

/** Solo se guardan empresas válidas: así la base de datos nunca contiene algo que la app no pueda abrir. */
function validated(yaml: unknown): { yaml: string; name: string } {
  if (typeof yaml !== 'string' || !yaml.trim()) throw new HttpError(400, 'Falta el contenido (yaml) de la empresa.');
  const r = parseCompany(yaml);
  if (!r.def) throw new HttpError(400, 'La empresa no es válida.', { errors: r.errors });
  return { yaml, name: r.def.company.trim() || 'Empresa sin nombre' };
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Formularios que guardan borrador: «config» (Configurar empresa) y «hub» (Procesos). */
export const DRAFT_KINDS = ['config', 'hub'];
const SETTING = /^[A-Za-z0-9_.-]{1,64}$/;

const notAllowed = () => new HttpError(405, 'Método no permitido.');

/** Rutas de la API (todas bajo /api). Devuelve true si la petición era de la API y ya se respondió. */
export function createApiHandler(store: Store) {
  async function route(parts: string[], method: string, req: IncomingMessage, res: ServerResponse) {
    const [a, id, b, rid, c] = parts;

    if (a === 'health' && !id) return send(res, 200, { ok: true, database: store.path, ...store.stats() });

    if (a === 'settings' && id) {
      if (!SETTING.test(id)) throw new HttpError(400, 'Nombre de preferencia no válido.');
      if (method === 'GET') {
        const value = store.getSetting(id);
        return value === undefined ? send(res, 404, { error: 'No existe.' }) : send(res, 200, { key: id, value });
      }
      if (method === 'PUT') {
        const body = await readJson(req);
        if (typeof body.value !== 'string' || body.value.length > 10_000) throw new HttpError(400, 'El valor debe ser un texto de hasta 10 000 caracteres.');
        store.setSetting(id, body.value);
        return send(res, 200, { key: id, value: body.value });
      }
      throw notAllowed();
    }

    if (a !== 'companies') throw new HttpError(404, 'No existe.');

    if (!id) {
      if (method === 'GET') return send(res, 200, store.list());
      if (method === 'POST') {
        const body = await readJson(req);
        const v = validated(body.yaml);
        const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : v.name;
        return send(res, 201, store.create(name, v.yaml));
      }
      throw notAllowed();
    }
    if (!ID.test(id)) throw new HttpError(400, 'Identificador no válido.');
    const cur = store.get(id);
    if (!cur) throw new HttpError(404, 'La empresa no existe.');

    if (!b) {
      if (method === 'GET') return send(res, 200, cur);
      if (method === 'DELETE') {
        store.remove(id);
        return send(res, 204);
      }
      if (method === 'PUT') {
        const body = await readJson(req);
        const v = validated(body.yaml);
        const expected = body.version === undefined ? undefined : Number(body.version);
        if (expected !== undefined && !Number.isInteger(expected)) throw new HttpError(400, 'version debe ser un entero.');
        return send(res, 200, store.save(id, v.name, v.yaml, expected, typeof body.note === 'string' ? body.note.slice(0, 200) : undefined));
      }
      throw notAllowed();
    }

    if (b === 'duplicate' && method === 'POST') {
      const name = `${cur.name} (copia)`;
      const yaml = cur.yaml.replace(/^company:.*$/m, () => `company: ${JSON.stringify(name)}`);
      return send(res, 201, store.create(name, yaml));
    }

    if (b === 'drafts') {
      if (!rid || !DRAFT_KINDS.includes(rid)) throw new HttpError(400, 'Tipo de borrador no válido.');
      if (method === 'GET') {
        const d = store.getDraft(id, rid);
        return d ? send(res, 200, d) : send(res, 404, { error: 'No hay borrador.' });
      }
      if (method === 'PUT') {
        const body = await readJson(req);
        if (typeof body.body !== 'string' || !body.body) throw new HttpError(400, 'Falta el contenido del borrador.');
        const base = Number(body.baseVersion);
        if (!Number.isInteger(base)) throw new HttpError(400, 'baseVersion debe ser un entero.');
        return send(res, 200, store.setDraft(id, rid, base, body.body));
      }
      if (method === 'DELETE') {
        store.deleteDraft(id, rid);
        return send(res, 204);
      }
      throw notAllowed();
    }

    if (b === 'revisions') {
      if (!rid) {
        if (method !== 'GET') throw notAllowed();
        return send(res, 200, store.revisions(id));
      }
      const n = Number(rid);
      if (!Number.isInteger(n)) throw new HttpError(400, 'Identificador de versión no válido.');
      const rev = store.revision(id, n);
      if (!rev) throw new HttpError(404, 'Esa versión no existe.');
      if (!c && method === 'GET') return send(res, 200, rev);
      if (c === 'restore' && method === 'POST') {
        const v = validated(rev.yaml);
        return send(res, 200, store.save(id, v.name, v.yaml, undefined, `Restaurada la versión ${rev.version}`));
      }
    }
    throw new HttpError(404, 'No existe.');
  }

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api')) return false;
    const parts = url.pathname.split('/').filter(Boolean).slice(1); // sin «api»
    try {
      await route(parts, req.method ?? 'GET', req, res);
    } catch (e) {
      if (e instanceof HttpError) send(res, e.status, { error: e.message, ...e.extra });
      else if (e instanceof ConflictError) send(res, 409, { error: e.message, current: e.current });
      else {
        console.error(e);
        send(res, 500, { error: 'Error interno del servidor.' });
      }
    }
    return true;
  };
}
