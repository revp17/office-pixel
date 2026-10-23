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

### Primera vez

Si la base de datos está vacía, se crea en ella la empresa que tuvieras en el navegador (o el ejemplo Banco Pixel) y se avisa. El navegador conserva una copia local de la última empresa abierta, solo como respaldo.

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
| `POST /api/bootstrap` | Crea la primera empresa solo si la base está vacía |
| `GET/PUT /api/settings/:clave` | Preferencias |

## Límites

- **Un solo servidor y un solo archivo**: pensado para uso personal o de un equipo pequeño en una máquina. No hay usuarios ni permisos: quien llegue a la API puede ver y cambiar todo. **No la expongas a internet** sin ponerle delante algo que autentique.
- El contenido de cada empresa se guarda como **un bloque**: no se puede consultar con SQL «todas las personas de todas las empresas». Es una decisión para mantenerlo simple y que ninguna parte quede desfasada.
- Las versiones anteriores ocupan espacio (cada una es una copia completa); por eso solo se guardan las últimas 40.
