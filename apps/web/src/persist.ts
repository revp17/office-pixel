import { companyToYaml, parseCompany, type CompanyDef } from '@office-pixel/sim';
import { ApiError, db, type CompanyFull, type CompanyInfo } from './db';

export type DbStatus = 'checking' | 'db' | 'saving' | 'local' | 'error';

const CACHE = 'office-pixel.company.v1';
const CURRENT = 'current_company';

/** Copia local de la última empresa (por si no hay servidor). */
function readCache(): CompanyDef | undefined {
  try {
    const text = localStorage.getItem(CACHE);
    const r = text ? parseCompany(text) : undefined;
    return r?.def;
  } catch {
    return undefined;
  }
}
function writeCache(yaml: string) {
  try {
    localStorage.setItem(CACHE, yaml);
  } catch {
    /* sin espacio o sin almacenamiento: la base de datos es la que manda */
  }
}

/**
 * Dónde viven las empresas: en la base de datos del servidor (SQLite). Si no hay servidor de API,
 * la app sigue funcionando guardando solo en este navegador, y lo avisa.
 */
export class Persistence {
  status: DbStatus = 'checking';
  detail = '';
  list: CompanyInfo[] = [];
  currentId?: string;
  private version?: number;
  private chain: Promise<void> = Promise.resolve();

  onStatus?: () => void;
  onList?: () => void;
  /** otra pestaña guardó antes: devuelve qué hacer con lo que ve el usuario */
  onConflict?: (current: CompanyFull) => Promise<'overwrite' | 'reload'>;
  /** se cargó otra versión desde la base de datos (tras un conflicto) */
  onReloaded?: (def: CompanyDef) => void;

  get online() {
    return this.status !== 'local' && this.status !== 'checking';
  }

  private set(status: DbStatus, detail = '') {
    this.status = status;
    this.detail = detail;
    this.onStatus?.();
  }

  /** Abre la empresa en uso: la última de la base de datos, o la copia local / el ejemplo si es la primera vez. */
  async boot(example: () => CompanyDef): Promise<{ def: CompanyDef; migrated: boolean }> {
    this.set('checking');
    if (!(await db.ping())) {
      this.set(
        'local',
        db.kind === 'nhost'
          ? `No se pudo usar Nhost${db.lastError ? `: ${db.lastError}` : ''}. Mientras tanto se guarda solo en este navegador.`
          : 'Sin servidor de base de datos: se guarda solo en este navegador.',
      );
      return { def: readCache() ?? example(), migrated: false };
    }
    try {
      let list = await db.list();
      let migrated = false;
      if (!list.length) {
        // primera vez con base de datos: se pasa a ella lo que hubiera en el navegador (o el ejemplo)
        const cached = readCache();
        migrated = !!cached;
        const created = await db.bootstrap(companyToYaml(cached ?? example()));
        list = [{ ...created, bytes: created.yaml.length }];
      }
      this.list = list;
      const wanted = await db.setting(CURRENT).catch(() => undefined);
      const pick = list.find((c) => c.id === wanted) ?? list[0];
      const def = await this.load(pick.id);
      this.set('db');
      this.onList?.();
      return { def, migrated };
    } catch (e) {
      this.set('error', (e as Error).message);
      return { def: readCache() ?? example(), migrated: false };
    }
  }

  private async load(id: string): Promise<CompanyDef> {
    const c = await db.get(id);
    const r = parseCompany(c.yaml);
    if (!r.def) throw new Error(`La empresa «${c.name}» guardada no se puede abrir: ${r.errors[0] ?? 'formato no válido'}`);
    this.currentId = c.id;
    this.version = c.version;
    db.setSetting(CURRENT, c.id).catch(() => undefined);
    return r.def;
  }

  private async refresh() {
    this.list = await db.list();
    this.onList?.();
  }

  /** Guarda la empresa actual (siempre deja una copia local; en la base de datos, en cola y sin pisar otros cambios). */
  save(def: CompanyDef, note?: string) {
    const yaml = companyToYaml(def);
    writeCache(yaml);
    if (!this.currentId || this.status === 'local') return;
    this.set('saving');
    this.chain = this.chain
      .then(async () => {
        const id = this.currentId!;
        let r = await db.save(id, yaml, this.version, note);
        if (!r.ok) {
          const choice = (await this.onConflict?.(r.conflict)) ?? 'overwrite';
          if (choice === 'reload') {
            const loaded = parseCompany(r.conflict.yaml).def;
            this.version = r.conflict.version;
            await this.refresh();
            if (loaded) this.onReloaded?.(loaded);
            this.set('db');
            return;
          }
          r = await db.save(id, yaml, undefined, 'Sobrescrito tras un conflicto');
        }
        if (r.ok) this.version = r.company.version;
        await this.refresh();
        this.set('db');
      })
      .catch((e: unknown) => this.set('error', e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo guardar.'));
  }

  /** Espera a que terminen los guardados pendientes. */
  settled() {
    return this.chain;
  }

  async open(id: string): Promise<CompanyDef> {
    await this.chain;
    const def = await this.load(id);
    writeCache(companyToYaml(def));
    this.onList?.(); // el selector muestra la empresa abierta
    this.set('db');
    return def;
  }

  async create(def: CompanyDef): Promise<CompanyDef> {
    await this.chain;
    const c = await db.create(companyToYaml(def));
    await this.refresh();
    return this.open(c.id);
  }

  async duplicate(): Promise<CompanyDef> {
    await this.chain;
    const c = await db.duplicate(this.currentId!);
    await this.refresh();
    return this.open(c.id);
  }

  /** Borra la empresa actual y abre otra; devuelve undefined si no queda ninguna. */
  async removeCurrent(): Promise<CompanyDef | undefined> {
    await this.chain;
    await db.remove(this.currentId!);
    await this.refresh();
    if (!this.list.length) {
      this.currentId = undefined;
      return undefined;
    }
    return this.open(this.list[0].id);
  }

  revisions() {
    return db.revisions(this.currentId!);
  }

  async restore(revisionId: number): Promise<CompanyDef> {
    await this.chain;
    await db.restore(this.currentId!, revisionId);
    await this.refresh();
    return this.open(this.currentId!);
  }
}
