/**
 * Acceso con Nhost Auth (correo y contraseña) usando su API HTTP, sin librerías.
 * La sesión se guarda en este navegador; el token de acceso se renueva solo con el de refresco.
 */

export interface NhostUser {
  id: string;
  email: string;
}
interface Session {
  accessToken: string;
  /** milisegundos (marca de tiempo) en que caduca el token de acceso */
  expiresAt: number;
  refreshToken: string;
  user: NhostUser;
}

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const KEY = 'office-pixel.nhost.session.v1';

/** Mensajes en español para los errores habituales de Nhost Auth. */
const MESSAGES: Record<string, string> = {
  'invalid-email-password': 'El correo o la contraseña no son correctos.',
  'unverified-user': 'Falta verificar tu correo: abre el enlace que te enviamos y vuelve a entrar.',
  'email-already-in-use': 'Ya existe una cuenta con ese correo. Prueba a entrar.',
  'weak-password': 'La contraseña es demasiado débil o corta (mínimo 9 caracteres).',
  'invalid-request': 'Revisa el correo y la contraseña.',
  'signup-disabled': 'El registro de cuentas nuevas está desactivado en este proyecto.',
  'user-not-found': 'No hay ninguna cuenta con ese correo.',
  'disabled-user': 'Esta cuenta está desactivada.',
  'too-many-requests': 'Demasiados intentos. Espera un momento y vuelve a probar.',
};

export interface NhostEndpoints {
  auth: string;
  graphql: string;
}

/** Endpoints del proyecto, a partir de VITE_NHOST_SUBDOMAIN y VITE_NHOST_REGION (o de las URL completas). */
export function nhostEndpoints(env: Record<string, string | undefined>): NhostEndpoints | undefined {
  const sub = env.VITE_NHOST_SUBDOMAIN?.trim();
  const region = env.VITE_NHOST_REGION?.trim();
  const auth = env.VITE_NHOST_AUTH_URL?.trim() || (sub && region ? `https://${sub}.auth.${region}.nhost.run/v1` : undefined);
  const graphql = env.VITE_NHOST_GRAPHQL_URL?.trim() || (sub && region ? `https://${sub}.graphql.${region}.nhost.run/v1` : undefined);
  return auth && graphql ? { auth: auth.replace(/\/$/, ''), graphql: graphql.replace(/\/$/, '') } : undefined;
}

function read(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
    return s && s.refreshToken && s.user?.id ? s : null;
  } catch {
    return null;
  }
}
function write(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: la sesión dura lo que dure la pestaña */
  }
}

interface ApiSession {
  accessToken: string;
  accessTokenExpiresIn: number; // segundos
  refreshToken: string;
  user: { id: string; email: string };
}
const toSession = (s: ApiSession): Session => ({
  accessToken: s.accessToken,
  expiresAt: Date.now() + s.accessTokenExpiresIn * 1000,
  refreshToken: s.refreshToken,
  user: { id: s.user.id, email: s.user.email },
});

export class NhostAuth {
  private session: Session | null = read();
  private refreshing: Promise<Session | null> | null = null;
  onChange?: () => void;

  constructor(
    private readonly url: string,
    private readonly fetcher: typeof fetch = (...a) => fetch(...a),
  ) {}

  get user(): NhostUser | null {
    return this.session?.user ?? null;
  }
  get signedIn() {
    return !!this.session;
  }

  private async post<T>(path: string, body: unknown): Promise<T | undefined> {
    let res: Response;
    try {
      res = await this.fetcher(`${this.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new AuthError('network', 'No se pudo conectar con Nhost. Revisa tu conexión.');
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      /* respuesta sin JSON */
    }
    if (!res.ok) {
      const code = String(json.error ?? `http-${res.status}`);
      throw new AuthError(code, MESSAGES[code] ?? String(json.message ?? `Error ${res.status} al contactar con Nhost.`));
    }
    return json as T;
  }

  private set(s: Session | null) {
    this.session = s;
    write(s);
    this.onChange?.();
  }

  async signIn(email: string, password: string): Promise<void> {
    const r = await this.post<{ session: ApiSession | null }>('/signin/email-password', { email: email.trim(), password });
    if (!r?.session) throw new AuthError('no-session', 'Nhost no devolvió una sesión. ¿Falta verificar el correo o activar la autenticación por contraseña?');
    this.set(toSession(r.session));
  }

  /** Crea la cuenta. Si el proyecto exige verificar el correo, no hay sesión todavía: `needsVerification`. */
  async signUp(email: string, password: string): Promise<{ needsVerification: boolean }> {
    const r = await this.post<{ session: ApiSession | null }>('/signup/email-password', { email: email.trim(), password });
    if (r?.session) {
      this.set(toSession(r.session));
      return { needsVerification: false };
    }
    return { needsVerification: true };
  }

  async resetPassword(email: string): Promise<void> {
    await this.post('/user/password/reset', { email: email.trim() });
  }

  async signOut(): Promise<void> {
    const s = this.session;
    this.set(null);
    if (s) await this.post('/signout', { refreshToken: s.refreshToken }).catch(() => undefined);
  }

  /** Token de acceso vigente (lo renueva si caduca en menos de un minuto); null si no hay sesión. */
  async accessToken(force = false): Promise<string | null> {
    const s = this.session;
    if (!s) return null;
    if (!force && s.expiresAt - Date.now() > 60_000) return s.accessToken;
    this.refreshing ??= this.refresh(s).finally(() => (this.refreshing = null));
    return (await this.refreshing)?.accessToken ?? null;
  }

  private async refresh(old: Session): Promise<Session | null> {
    try {
      const r = await this.post<ApiSession>('/token', { refreshToken: old.refreshToken });
      if (!r?.accessToken) throw new AuthError('no-session', 'Sesión caducada.');
      const s = toSession(r);
      this.set(s);
      return s;
    } catch (e) {
      // sin red se conserva la sesión; si Nhost la rechaza (caducó o se cerró en otro sitio), se pide entrar de nuevo
      if (e instanceof AuthError && e.code !== 'network') this.set(null);
      return null;
    }
  }
}
