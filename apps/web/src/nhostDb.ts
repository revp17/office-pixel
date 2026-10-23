import { parseCompany } from '@office-pixel/sim';
import { ApiError, type Backend, type CompanyFull, type CompanyInfo, type RevisionInfo, type SaveResult } from './backendTypes';
import { NhostAuth, type NhostEndpoints } from './nhostAuth';

/**
 * Guarda las empresas en Nhost (Postgres + Hasura) con la sesión del usuario. Cada usuario ve solo lo suyo:
 * lo garantizan los permisos de `nhost/metadata`, no esta aplicación.
 */

interface Row {
  id: string;
  name: string;
  yaml?: string;
  version: number;
  created_at: string;
  updated_at: string;
  yaml_bytes?: number;
}
const FIELDS = 'id name yaml version created_at updated_at';

const full = (r: Row): CompanyFull => ({ id: r.id, name: r.name, yaml: r.yaml ?? '', version: r.version, createdAt: r.created_at, updatedAt: r.updated_at });
const info = (r: Row): CompanyInfo => ({ id: r.id, name: r.name, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at, bytes: r.yaml_bytes ?? 0 });
/** El nombre de la empresa es el que dice su YAML. */
const nameOf = (yaml: string) => parseCompany(yaml).def?.company.trim() || 'Empresa sin nombre';

function validated(yaml: string) {
  const r = parseCompany(yaml);
  if (!r.def) throw new ApiError(400, 'La empresa no es válida.', { errors: r.errors });
  return { name: r.def.company.trim() || 'Empresa sin nombre' };
}

export function createNhostBackend(endpoints: NhostEndpoints, fetcher: typeof fetch = (...a) => fetch(...a)): Backend & { account: NhostAuth } {
  const auth = new NhostAuth(endpoints.auth, fetcher);

  async function gql<T>(query: string, variables: Record<string, unknown> = {}, retried = false): Promise<T> {
    const token = await auth.accessToken();
    if (!token) throw new ApiError(401, 'Hay que entrar con tu cuenta.');
    let res: Response;
    try {
      res = await fetcher(endpoints.graphql, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new ApiError(0, 'No se pudo conectar con Nhost. Revisa tu conexión.');
    }
    const json = (await res.json().catch(() => ({}))) as { data?: T; errors?: Array<{ message: string; extensions?: { code?: string } }>; message?: string };
    const first = json.errors?.[0];
    const expired = res.status === 401 || first?.extensions?.code === 'invalid-jwt' || /JWTExpired|jwt/i.test(first?.message ?? '');
    if (expired && !retried) {
      // el token caducó entre medias: se renueva una vez y se repite
      if (await auth.accessToken(true)) return gql<T>(query, variables, true);
    }
    if (first) {
      const code = first.extensions?.code;
      throw new ApiError(code === 'constraint-violation' ? 409 : res.status || 400, first.message, { code });
    }
    if (!res.ok || !json.data) throw new ApiError(res.status, json.message ?? `Error ${res.status} al contactar con Nhost.`);
    return json.data;
  }

  const getRow = async (id: string): Promise<CompanyFull> => {
    const d = await gql<{ companies_by_pk: Row | null }>(`query ($id: uuid!) { companies_by_pk(id: $id) { ${FIELDS} } }`, { id });
    if (!d.companies_by_pk) throw new ApiError(404, 'La empresa no existe.');
    return full(d.companies_by_pk);
  };

  const insert = async (yaml: string, name: string, bootstrap: boolean): Promise<CompanyFull> => {
    const d = await gql<{ insert_companies_one: Row }>(
      `mutation ($o: companies_insert_input!) { insert_companies_one(object: $o) { ${FIELDS} } }`,
      { o: { name, yaml, ...(bootstrap ? { bootstrap: true } : {}) } },
    );
    return full(d.insert_companies_one);
  };

  const list = async (): Promise<CompanyInfo[]> =>
    (await gql<{ companies: Row[] }>('query { companies(order_by: [{ updated_at: desc }]) { id name version created_at updated_at yaml_bytes } }')).companies.map(info);

  const save = async (id: string, yaml: string, version?: number, note?: string): Promise<SaveResult> => {
    const { name } = validated(yaml);
    const set = { name, yaml, change_note: note ?? null };
    if (version === undefined) {
      const d = await gql<{ update_companies_by_pk: Row | null }>(
        `mutation ($id: uuid!, $set: companies_set_input!) { update_companies_by_pk(pk_columns: { id: $id }, _set: $set) { ${FIELDS} } }`,
        { id, set },
      );
      if (!d.update_companies_by_pk) throw new ApiError(404, 'La empresa no existe.');
      return { ok: true, company: full(d.update_companies_by_pk) };
    }
    const d = await gql<{ update_companies: { affected_rows: number; returning: Row[] } }>(
      `mutation ($id: uuid!, $v: Int!, $set: companies_set_input!) {
         update_companies(where: { id: { _eq: $id }, version: { _eq: $v } }, _set: $set) { affected_rows returning { ${FIELDS} } }
       }`,
      { id, v: version, set },
    );
    if (d.update_companies.affected_rows > 0) return { ok: true, company: full(d.update_companies.returning[0]) };
    // ninguna fila: o la versión cambió (conflicto) o la empresa ya no existe
    return { ok: false, conflict: await getRow(id) };
  };

  return {
    kind: 'nhost',
    label: 'Nhost',
    account: auth,

    lastError: undefined as string | undefined,

    async ping() {
      if (!auth.signedIn) {
        this.lastError = 'No hay sesión iniciada.';
        return false;
      }
      try {
        // una consulta mínima que los permisos del usuario sí permiten (los conteos «aggregate» no están habilitados)
        await gql<unknown>('query { companies(limit: 1) { id } }');
        this.lastError = undefined;
        return true;
      } catch (e) {
        this.lastError = (e as Error).message;
        return false;
      }
    },

    list,
    get: getRow,

    async bootstrap(yaml) {
      const rows = await list();
      if (rows.length) return getRow(rows[0].id);
      try {
        return await insert(yaml, validated(yaml).name, true);
      } catch (e) {
        // otra pestaña creó la inicial a la vez: se abre esa
        if (e instanceof ApiError && e.status === 409) {
          const again = await list();
          if (again.length) return getRow(again[0].id);
        }
        throw e;
      }
    },

    async create(yaml, name) {
      return insert(yaml, name?.trim() || validated(yaml).name, false);
    },
    save,

    async remove(id) {
      await gql<unknown>('mutation ($id: uuid!) { delete_companies_by_pk(id: $id) { id } }', { id });
    },

    async duplicate(id) {
      const cur = await getRow(id);
      const name = `${cur.name} (copia)`;
      return insert(
        cur.yaml.replace(/^company:.*$/m, () => `company: ${JSON.stringify(name)}`),
        name,
        false,
      );
    },

    async revisions(id): Promise<RevisionInfo[]> {
      const d = await gql<{ company_revisions: Array<{ id: number | string; version: number; name: string; saved_at: string; note: string | null; yaml_bytes: number }> }>(
        'query ($id: uuid!) { company_revisions(where: { company_id: { _eq: $id } }, order_by: [{ id: desc }]) { id version name saved_at note yaml_bytes } }',
        { id },
      );
      return d.company_revisions.map((r) => ({ id: Number(r.id), version: r.version, name: r.name, savedAt: r.saved_at, note: r.note, bytes: r.yaml_bytes }));
    },

    async restore(id, revisionId) {
      const d = await gql<{ company_revisions_by_pk: { yaml: string; version: number } | null }>('query ($rid: bigint!) { company_revisions_by_pk(id: $rid) { yaml version } }', { rid: revisionId });
      const rev = d.company_revisions_by_pk;
      if (!rev) throw new ApiError(404, 'Esa versión no existe.');
      const r = await save(id, rev.yaml, undefined, `Restaurada la versión ${rev.version}`);
      if (!r.ok) throw new ApiError(409, 'La empresa cambió mientras se restauraba.');
      return r.company;
    },

    async setting(key) {
      const d = await gql<{ settings: Array<{ value: string }> }>('query ($k: String!) { settings(where: { key: { _eq: $k } }) { value } }', { k: key });
      return d.settings[0]?.value;
    },

    setSetting: (key, value) =>
      gql<unknown>(
        'mutation ($o: settings_insert_input!) { insert_settings_one(object: $o, on_conflict: { constraint: settings_pkey, update_columns: [value] }) { key } }',
        { o: { key, value } },
      ),
  };
}

export { nameOf };
