import './style.css';
import { askLogin } from '../ui/login';
import { bindCompanyMenu } from './companyMenu';
import { run, setEmpty } from './controller';
import { $ } from './dom';
import { bindEmptyState } from './emptyState';
import { bindHud } from './hud';
import { bindModes } from './modes';
import { bindSceneHost, scene } from './sceneHost';
import { backend, persist } from './services';
import { bindSimPrefs } from './simPrefs';
import { restoreView, saveViewPref } from './viewPrefs';
import { bindToolbar } from './toolbar';

/**
 * Arranque. Con Nhost primero se entra con la cuenta; luego se abre la base de datos y se muestra la última
 * empresa (o, si no hay ninguna, la pantalla «en cero»).
 */
async function startup() {
  const account = backend.account;
  if (account) {
    const out = $<HTMLButtonElement>('sign-out');
    out.hidden = false;
    out.addEventListener('click', async () => {
      if (!confirm('¿Cerrar la sesión? Tus empresas siguen guardadas en tu cuenta.')) return;
      await account.signOut();
      try {
        localStorage.removeItem('office-pixel.company.v1'); // no dejar una copia en un equipo compartido
      } catch {
        /* sin almacenamiento */
      }
      location.reload();
    });
    // si la sesión se cierra o caduca por otro lado, se vuelve a pedir el acceso
    account.onChange = () => {
      if (!account.signedIn) location.reload();
    };
    if (!account.signedIn) await askLogin(account);
    out.textContent = `🚪 Cerrar sesión (${account.user?.email ?? ''})`;
  }
  const first = await persist.boot();
  await restoreView(); // modo, disposición, días, semilla y velocidad guardados
  if (first) run(first, undefined, false);
  else setEmpty(true);
}

bindSceneHost((o) => saveViewPref('layout', o));
bindHud();
bindCompanyMenu();
bindEmptyState();
bindToolbar();
bindModes((m) => saveViewPref('mode', m));
bindSimPrefs();

if (import.meta.env.DEV) (window as unknown as { __op: unknown }).__op = { scene, persist };

void startup();
