import type { AccountApi } from './backendTypes';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Pantalla de acceso (correo y contraseña). Se resuelve cuando hay sesión. */
export function askLogin(account: AccountApi): Promise<void> {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'modal-back login';
    back.innerHTML = `
      <form class="modal loginform" autocomplete="on" novalidate>
        <h3>🏢 Office-Pixel</h3>
        <p class="muted">Entra con tu cuenta para abrir tus empresas. Cada cuenta solo ve las suyas.</p>
        <label>Correo
          <input name="email" type="email" autocomplete="username" required placeholder="tu@correo.com" />
        </label>
        <label>Contraseña
          <input name="password" type="password" autocomplete="current-password" required minlength="9" placeholder="mínimo 9 caracteres" />
        </label>
        <p class="msg" role="alert" hidden></p>
        <div class="modal-actions">
          <button type="button" class="btn" data-a="reset" title="Te enviamos un enlace para elegir otra contraseña">Olvidé mi contraseña</button>
          <span style="flex:1"></span>
          <button type="button" class="btn" data-a="signup">Crear cuenta</button>
          <button type="submit" class="btn primary" data-a="signin">Entrar</button>
        </div>
      </form>`;
    document.body.append(back);
    const form = back.querySelector('form')!;
    const msg = back.querySelector<HTMLElement>('.msg')!;
    const email = form.elements.namedItem('email') as HTMLInputElement;
    const password = form.elements.namedItem('password') as HTMLInputElement;
    const buttons = Array.from(form.querySelectorAll("button"));

    const show = (text: string, kind: 'error' | 'ok' = 'error') => {
      msg.hidden = !text;
      msg.className = `msg ${kind}`;
      msg.innerHTML = esc(text);
    };
    const busy = (on: boolean) => buttons.forEach((b) => (b.disabled = on));
    const finish = () => {
      back.remove();
      resolve();
    };

    const run = async (action: () => Promise<void>) => {
      show('');
      busy(true);
      try {
        await action();
      } catch (e) {
        show((e as Error).message);
      } finally {
        busy(false);
      }
    };
    const needEmail = () => {
      if (!email.value.trim()) {
        show('Escribe tu correo.');
        email.focus();
        return false;
      }
      return true;
    };
    const needBoth = () => needEmail() && (password.value ? true : (show('Escribe tu contraseña.'), password.focus(), false));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!needBoth()) return;
      void run(async () => {
        await account.signIn(email.value, password.value);
        finish();
      });
    });
    form.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest('button')?.dataset.a;
      if (a === 'signup') {
        if (!needBoth()) return;
        void run(async () => {
          const r = await account.signUp(email.value, password.value);
          if (!r.needsVerification) return finish();
          show('Cuenta creada. Te enviamos un correo para verificarla; ábrelo y luego pulsa «Entrar».', 'ok');
        });
      }
      if (a === 'reset') {
        if (!needEmail()) return;
        void run(async () => {
          await account.resetPassword(email.value);
          show('Si ese correo tiene cuenta, te enviamos un enlace para cambiar la contraseña.', 'ok');
        });
      }
    });
    email.focus();
  });
}
