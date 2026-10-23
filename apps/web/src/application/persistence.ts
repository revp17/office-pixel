import { companyToYaml, parseCompany, type CompanyDef } from '@office-pixel/sim';
import { ApiError, type Backend, type CompanyFull, type CompanyInfo, type LocalCache } from './ports';

export type DbStatus = 'checking' | 'db' | 'saving' | 'local' | 'error';

const CURRENT = 'current_company';

/** Lo que el usuario ajusta en la barra para simular. */
export interface SimPrefs {
  days: number;
  seed: number;
  /** minutos simulados por segundo */
  speed: number;
}

const simKey = (companyId: string, mode: string) => `sim.${companyId}.${mode}`;

/** Lee las preferencias guardadas; descarta lo que no sea válido en vez de fallar. */
export function readSimPrefs(text: string): SimPrefs | undefined {
  try {
    const o = JSON.parse(text) as Record<string, unknown>;
    const days = Math.trunc(Number(o.days));
    const seed = Math.trunc(Number(o.seed));
    const speed = Number(o.speed);
    if (!Number.isFinite(days) || !Number.isFinite(seed) || !Number.isFinite(speed) || speed <= 0) return undefined;
    return { days: Math.min(30, Math.max(1, days)), seed, speed };
  } catch {
    return undefined;
  }
}

/**
 * Dónde viven las empresas: en la base de datos (SQLite local o Nhost). Si no hay servidor o sesión,
 * la app sigue funcionando guardando solo en este navegador, y lo avisa.
 *
 * No se crea nada por sí sola: una cuenta nueva empieza **sin empresas** y el usuario decide cómo empezar.
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

  constructor(
    private readonly backend: Backend,
    private readonly cache: LocalCache,
  ) {}

  get online() {
    return this.status !== 'local' && this.status !== 'checking';
  }

  private set(status: DbStatus, detail = '') {
    this.status = status;
    this.detail = detail;
    this.onStatus?.();
  }

  /** La copia local de la última empresa abierta, si la hay y es válida. */
  private cached(): CompanyDef | undefined {
    const text = this.cache.read();
    return text ? parseCompany(text).def : undefined;
  }

  /** Abre la empresa en uso (la última). Devuelve undefined si todavía no hay ninguna. */
  async boot(): Promise<CompanyDef | undefined> {
    this.set('checking');
    const b = this.backend;
    if (!(await b.ping())) {
      this.set(
        'local',
        b.kind === 'nhost'
          ? `No se pudo usar Nhost${b.lastError ? `: ${b.lastError}` : ''}. Mientras tanto se guarda solo en este navegador.`
          : 'Sin servidor de base de datos: se guarda solo en este navegador.',
      );
      return this.cached();
    }
    try {
      this.list = await b.list();
      if (!this.list.length) {
        // sin empresas en la base de datos: lo que quedara en el navegador no es de esta cuenta y no se mezcla
        this.cache.clear();
        this.currentId = undefined;
        this.set('db');
        this.onList?.();
        return undefined;
      }
      const wanted = await b.setting(CURRENT).catch(() => undefined);
      const pick = this.list.find((c) => c.id === wanted) ?? this.list[0];
      const def = await this.load(pick.id);
      this.set('db');
      this.onList?.();
      return def;
    } catch (e) {
      this.set('error', (e as Error).message);
      return this.cached();
    }
  }

  private async load(id: string): Promise<CompanyDef> {
    const c = await this.backend.get(id);
    const r = parseCompany(c.yaml);
    if (!r.def) throw new Error(`La empresa «${c.name}» guardada no se puede abrir: ${r.errors[0] ?? 'formato no válido'}`);
    this.currentId = c.id;
    this.version = c.version;
    this.backend.setSetting(CURRENT, c.id).catch(() => undefined);
    return r.def;
  }

  private async refresh() {
    this.list = await this.backend.list();
    this.onList?.();
  }

  /** Guarda la empresa actual (siempre deja una copia local; en la base de datos, en cola y sin pisar otros cambios). */
  save(def: CompanyDef, note?: string) {
    const yaml = companyToYaml(def);
    this.cache.write(yaml);
    if (!this.currentId || this.status === 'local') return;
    this.set('saving');
    this.chain = this.chain
      .then(async () => {
        const id = this.currentId!;
        let r = await this.backend.save(id, yaml, this.version, note);
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
          r = await this.backend.save(id, yaml, undefined, 'Sobrescrito tras un conflicto');
        }
        if (r.ok) this.version = r.company.version;
        await this.refresh();
        this.set('db');
      })
      .catch((e: unknown) => this.set('error', e instanceof ApiError || e instanceof Error ? e.message : 'No se pudo guardar.'));
  }

  /** Días, semilla y velocidad de la última simulación de esta empresa en este modo (guardados en la base de datos). */
  async simPrefs(mode: string): Promise<SimPrefs | undefined> {
    if (!this.currentId || this.status === 'local') return undefined;
    try {
      const text = await this.backend.setting(simKey(this.currentId, mode));
      return text ? readSimPrefs(text) : undefined;
    } catch {
      return undefined;
    }
  }

  saveSimPrefs(mode: string, prefs: SimPrefs) {
    if (!this.currentId || this.status === 'local') return;
    this.backend.setSetting(simKey(this.currentId, mode), JSON.stringify(prefs)).catch(() => undefined);
  }

  /** Espera a que terminen los guardados pendientes. */
  settled() {
    return this.chain;
  }

  async open(id: string): Promise<CompanyDef> {
    await this.chain;
    const def = await this.load(id);
    this.cache.write(companyToYaml(def));
    this.onList?.(); // el selector muestra la empresa abierta
    this.set('db');
    return def;
  }

  /** Crea una empresa nueva con este contenido y la abre. Sin conexión, solo queda en este navegador. */
  async create(def: CompanyDef): Promise<CompanyDef> {
    await this.chain;
    if (this.status === 'local') {
      this.cache.write(companyToYaml(def));
      return def;
    }
    const c = await this.backend.create(companyToYaml(def));
    await this.refresh();
    return this.open(c.id);
  }

  async duplicate(): Promise<CompanyDef> {
    await this.chain;
    const c = await this.backend.duplicate(this.currentId!);
    await this.refresh();
    return this.open(c.id);
  }

  /** Borra la empresa actual y abre otra; devuelve undefined si no queda ninguna. */
  async removeCurrent(): Promise<CompanyDef | undefined> {
    await this.chain;
    await this.backend.remove(this.currentId!);
    await this.refresh();
    if (!this.list.length) {
      this.currentId = undefined;
      this.cache.clear();
      this.onList?.();
      return undefined;
    }
    return this.open(this.list[0].id);
  }

  revisions() {
    return this.backend.revisions(this.currentId!);
  }

  async restore(revisionId: number): Promise<CompanyDef> {
    await this.chain;
    await this.backend.restore(this.currentId!, revisionId);
    await this.refresh();
    return this.open(this.currentId!);
  }
}
