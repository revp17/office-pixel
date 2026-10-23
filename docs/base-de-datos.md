# Base de datos

> Esta guía es de la base **local** (SQLite). Para guardar en la nube con cuentas de usuario y publicar la app, mira [publicar.md](publicar.md) (Nhost + Vercel).

Las empresas se guardan en una base de datos **SQLite** (un solo archivo), no en el navegador. Así no se pierden al limpiar el navegador, puedes tener **varias empresas** y cada cambio deja una **versión anterior** a la que volver.

## Requisitos

- **Node.js 22.13 o superior** (se usa el SQLite que ya trae Node, `node:sqlite`; no hay que instalar ni compilar nada más). Avisa «ExperimentalWarning: SQLite» al arrancar: es normal.

## Cómo se ejecuta

| Para | Comando | Dónde |
|---|---|---|
| Desarrollar | `npm run dev` | http://localhost:5173 (la API y la base de datos van dentro del mismo servidor) |
| Usarla «en producción» | `npm run build` y luego `npm start` | http://localhost:3001 (`PORT` cambia el puerto) |

El archivo de la base de datos es **`data/office-pixel.db`** (en la carpeta del proyecto; no se sube a GitHub). Con `OFFICE_PIXEL_DB=/ruta/archivo.db` se usa otro. **Para hacer una copia de seguridad basta copiar ese archivo** (con la app cerrada; también existen `office-pixel.db-wal` y `-shm`, que son parte de lo mismo mientras la app está abierta) o usar **⋯ → Descargar copia (.yaml)** en cada empresa.

## Qué se guarda

Todo lo de cada empresa, en un solo bloque (su YAML): áreas, subáreas, personas, procesos, dependencias, procedimientos con sus capturas, fichas, optimización, tipos de instalación propios con sus ilustraciones y objetos de las salas. Además, las **versiones anteriores** (las últimas 40 por empresa) y un par de preferencias.

No se guarda en la base de datos (queda en el navegador): el **modo** (cómo funciona / semana completa) y la disposición vertical/horizontal.

## En la aplicación

En la barra superior:

- **Empresa**: lista de las empresas guardadas; al elegir una se abre y se simula.
- **⋯**: **Nueva empresa en blanco**, **Duplicar**, **Versiones anteriores…** (con **Restaurar**), **Descargar copia (.yaml)** y **Borrar** (con todo su historial).
- **Indicador de guardado**: «💾 Guardado en la base de datos», «⏳ Guardando…», o un aviso naranja si no se pudo.

Se guarda cada vez que **aplicas** un cambio (**Aplicar y simular** en la configuración, **Guardar y cerrar** en Gestión de procesos). Antes de sobrescribir, la versión anterior pasa al historial. Si no hay cambios, no se crea una versión nueva.

**🧹 Limpiar todo** ahora crea una empresa **nueva en blanco**; las que ya tienes siguen guardadas.

### Empezar en cero

La aplicación **no crea nada por sí sola**. Si la base de datos no tiene empresas (la primera vez, o después de borrar la última), se muestra la pantalla **«Todavía no tienes ninguna empresa»** con tres formas de empezar: **Empezar en blanco**, **cargar una plantilla de ejemplo** o **importar un archivo .yaml**. Lo que hubiera en el navegador de antes no se pasa a la base de datos. El navegador conserva una copia local de la última empresa abierta, solo como respaldo, y la borra cuando no queda ninguna.

### Dos pestañas a la vez

Cada empresa tiene un **número de versión**. Si guardas desde una pestaña vieja y otra ya guardó antes, la app **no pisa** el cambio sin avisarte: te pregunta si **reemplazar** lo guardado por lo que ves (la versión anterior queda en el historial) o **descartar** lo tuyo y abrir lo guardado.

### Sin servidor

Si abres la app sin el servidor de base de datos (por ejemplo, solo la carpeta compilada), sigue funcionando y guarda **solo en este navegador**, con el aviso «⚠ Solo en este navegador». Las empresas del selector no están disponibles en ese modo.

## Reglas

- Solo se guardan empresas **válidas**: la API rechaza un YAML que la app no podría abrir y dice por qué.
- Máximo **25 MB** por guardado (las imágenes van dentro).
- Los identificadores de empresa son del tipo `emp_1a2b3c4d`.

## API (por si quieres automatizar)

Todo bajo `/api`, en JSON:

| Método y ruta | Qué hace |
|---|---|
| `GET /api/health` | Comprueba que está viva y dónde está el archivo |
| `GET /api/companies` | Lista (sin el contenido) |
| `POST /api/companies` | Crea una (`{ "yaml": "…" }`) |
| `GET /api/companies/:id` | Lee una con todo su contenido |
| `PUT /api/companies/:id` | Guarda (`{ "yaml", "version", "note" }`); `409` si la versión no coincide |
| `DELETE /api/companies/:id` | Borra la empresa y su historial |
| `POST /api/companies/:id/duplicate` | Copia con «(copia)» en el nombre |
| `GET /api/companies/:id/revisions` | Versiones anteriores |
| `POST /api/companies/:id/revisions/:rid/restore` | Restaura una |
| `GET/PUT /api/settings/:clave` | Preferencias |

## Límites

- **Un solo servidor y un solo archivo**: pensado para uso personal o de un equipo pequeño en una máquina. No hay usuarios ni permisos: quien llegue a la API puede ver y cambiar todo. **No la expongas a internet** sin ponerle delante algo que autentique.
- El contenido de cada empresa se guarda como **un bloque**: no se puede consultar con SQL «todas las personas de todas las empresas». Es una decisión para mantenerlo simple y que ninguna parte quede desfasada.
- Las versiones anteriores ocupan espacio (cada una es una copia completa); por eso solo se guardan las últimas 40.

## Preferencias de simulación

Los **días**, la **semilla** y la **velocidad** de la barra superior se guardan en la base de datos (tabla `settings`, clave `sim.<empresa>.<modo>`), por empresa y por modo («Cómo funciona» y «Semana completa» recuerdan cada uno lo suyo). Se guardan al cambiar el campo y se recuperan al abrir la empresa, en otro navegador o en otro equipo. Sin base de datos (modo «solo navegador») no se guardan.

## Preferencias de vista

El **modo** (Cómo funciona / Semana completa) y la **disposición** del plano (vertical / horizontal) son de la cuenta: se guardan en `settings` (claves `view.mode` y `view.layout`) y te siguen a otro navegador o equipo. Solo sin base de datos se recuerdan en el navegador.

## Borradores (cambios sin aplicar)

Mientras escribes en **Configurar empresa** o en **Procesos**, lo que llevas se guarda solo como **borrador** en la base de datos (tabla `company_drafts`, uno por empresa y formulario), un instante después de cada cambio y al cerrar. Si cierras sin aplicar, recargas o se cae la conexión, al volver a abrir ese formulario se te pregunta si recuperas el borrador o lo descartas.

- **Aplicar** (Configurar) y **Guardar** (Procesos) borran el borrador: lo escrito ya es la empresa.
- Si la empresa se guardó de nuevo después del borrador, el aviso lo dice, porque al aplicarlo se pisarían esos cambios.
- El borrador no es una versión de la empresa: no aparece en «Versiones anteriores» ni cambia lo que se simula.
- Sin base de datos («solo navegador») no se guardan borradores.
- **En Nhost hay que crear la tabla una vez:** vuelve a ejecutar `node nhost/setup.mjs` (ver [publicar.md](publicar.md)). Es seguro repetirlo: solo crea lo que falta. Hasta entonces la app funciona igual, pero sin borradores.
