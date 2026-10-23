# Publicar con Nhost (base de datos) y Vercel (aplicación)

La aplicación puede guardar sus empresas en **Nhost** (Postgres + cuentas de usuario) y publicarse en **Vercel**. Se elige sola:

| Si hay… | Guarda en |
|---|---|
| `VITE_NHOST_SUBDOMAIN` y `VITE_NHOST_REGION` | **Nhost**, con acceso por correo y contraseña; cada cuenta ve solo sus empresas |
| nada de eso | la base SQLite local (`npm run dev` / `npm start`, ver [base-de-datos.md](base-de-datos.md)) |

Todo lo de las empresas (historial de versiones, varias empresas, copias, restaurar) funciona igual en las dos.

> **Qué está comprobado y qué no.** El esquema SQL se probó contra un Postgres real, y el cliente (cuentas, empresas, conflictos, renovación de sesión) contra un Nhost simulado. **No se probó contra un proyecto real de Nhost ni desplegado en Vercel**: no tengo tu proyecto. Sigue los pasos y, si algo falla, el mensaje del script o de la pantalla de acceso dice dónde.

---

## 1. Crear el proyecto en Nhost

1. En https://app.nhost.io crea un proyecto nuevo y elige la región más cercana.
2. Anota, en **Settings → General**, el **subdominio** (por ejemplo `abcdefgh`) y la **región** (por ejemplo `eu-central-1`).
3. En **Settings → Environment Variables** busca `HASURA_GRAPHQL_ADMIN_SECRET`. Es una **clave de administración**: solo la usarás una vez, en tu equipo, para el paso 3. **Nunca** la pongas en la aplicación, en Vercel ni en GitHub.

## 2. Configurar el acceso

En **Authentication → Sign-in methods** deja activado **Email and password**. Revisa:

- **Contraseña mínima:** 9 caracteres (lo que ya avisa la pantalla de acceso).
- **Verificación de correo:** por defecto Nhost pide verificar el correo antes de entrar. Déjalo así si quieres cuentas reales; para probar rápido puedes desactivarla.
- **Rol por defecto:** `user` (ya viene así). Los permisos del paso 3 son para ese rol.

## 3. Crear las tablas y los permisos

Desde la carpeta del proyecto, con tus datos (es un solo comando; la clave va por variable de entorno y no se guarda):

```bash
NHOST_SUBDOMAIN=abcdefgh NHOST_REGION=eu-central-1 NHOST_ADMIN_SECRET=tu-admin-secret node nhost/setup.mjs
```

En PowerShell:

```powershell
$env:NHOST_SUBDOMAIN="abcdefgh"; $env:NHOST_REGION="eu-central-1"; $env:NHOST_ADMIN_SECRET="tu-admin-secret"; node nhost/setup.mjs
```

Crea las tablas `companies`, `company_revisions` y `settings` (con el trigger que guarda las versiones anteriores), las hace visibles en GraphQL y fija los permisos: **cada usuario solo puede ver, crear, cambiar y borrar sus propias empresas**; el historial es de solo lectura. Se puede ejecutar de nuevo sin romper nada.

Alternativas: pegar `nhost/migrations/default/*/up.sql` en **Database → SQL** del panel (y luego dar los permisos a mano según `nhost/metadata/databases/default/tables/*.yaml`), o, si trabajas con la CLI de Nhost, usar la carpeta `nhost/` como migraciones y metadatos de tu proyecto.

## 4. Probarlo en tu equipo

Copia `apps/web/.env.example` a `apps/web/.env.local` y rellena los dos valores:

```
VITE_NHOST_SUBDOMAIN=abcdefgh
VITE_NHOST_REGION=eu-central-1
```

```bash
npm run dev
```

Aparece la pantalla de acceso. **Crear cuenta** y entra. En la barra superior el indicador dice «☁ Guardado en Nhost»; el menú **⋯** tiene **Cerrar sesión**. La primera vez, la empresa que tuvieras en el navegador se pasa a tu cuenta.

## 5. Publicar en Vercel

La configuración ya está en `vercel.json` (compila `apps/web` y sirve `apps/web/dist`). Solo hay que decirle dónde está tu proyecto de Nhost.

**Con el panel de Vercel**

1. **Add New → Project** e importa el repositorio de GitHub. Deja el directorio raíz (`./`); la compilación se toma de `vercel.json`.
2. En **Environment Variables** añade `VITE_NHOST_SUBDOMAIN` y `VITE_NHOST_REGION` (en Production y Preview). **Antes de desplegar**: Vite las incrusta al compilar.
3. **Deploy**. Cada `git push` a `main` vuelve a publicar.

**Con la CLI**

```bash
vercel link
vercel env add VITE_NHOST_SUBDOMAIN production
vercel env add VITE_NHOST_REGION production
vercel deploy --prod
```

**Después, en Nhost:** en **Authentication → URL configuration** pon la dirección de Vercel (`https://tu-app.vercel.app`) como **Client URL** y en las **Allowed redirect URLs**. Sin eso, los enlaces de los correos (verificar, cambiar contraseña) no llevan a tu aplicación.

## 6. Pasar las empresas que ya tienes

Las empresas de la base local (SQLite) no se mueven solas. Para llevarlas:

1. En la app local: abre la empresa → **⋯ → Descargar copia (.yaml)**.
2. En la app con Nhost: **Configurar empresa → YAML (avanzado) → Abrir archivo**, y **Aplicar y simular**. Se guarda en tu cuenta.

---

## Seguridad

- La aplicación **no lleva ninguna clave secreta**: solo el subdominio y la región, que son públicos. El acceso a los datos es con la sesión de cada usuario y los permisos de Hasura (`nhost/metadata`): un usuario no puede leer ni tocar las empresas de otro, ni cambiar a quién pertenece una.
- La sesión se guarda en el navegador. **Cerrar sesión** la cierra y borra la copia local de la empresa (importante en equipos compartidos).
- El `admin secret` solo se usa en el paso 3, desde tu equipo.

## Límites

- **La validación de la empresa es del cliente.** Nhost guarda lo que le llegue de un usuario con sesión (hasta 25 MB); la app solo guarda empresas válidas, pero un usuario técnico podría guardar otra cosa **en su propia cuenta** (no afecta a las demás).
- **Tamaño por guardado:** Nhost y Vercel pueden tener su propio límite de tamaño de petición; no lo he verificado. Si una empresa con muchas capturas no se guarda, reduce las imágenes.
- **Sin servidor propio:** todo lo hace el navegador contra Nhost; no hay tareas programadas ni copias automáticas más allá del historial de 40 versiones por empresa. Para copias de seguridad, usa **⋯ → Descargar copia (.yaml)** o las copias de tu plan de Nhost.
- **Dos formas de guardar a la vez no se mezclan:** una empresa en SQLite local y otra en Nhost son independientes.
