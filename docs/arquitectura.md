# Arquitectura

Office-Pixel es un **monolito modular**: un solo repositorio y una sola aplicación desplegable, dividida en piezas con fronteras claras y comprobadas por tests. No son microservicios (ver [por qué](#por-qué-no-microservicios)).

## Vista general

```
┌────────────────────────── apps/web (Vite + Phaser + Preact) ──────────────────────────┐
│  app  ──►  ui, scene, application, infrastructure, shared                              │
│  ui   ──►  application, scene, shared        scene ──► shared                          │
│  infrastructure ──► application (puertos), shared                                      │
│  application ──► shared            (sin navegador, sin red)                            │
└───────────────┬───────────────────────────────────────────────┬────────────────────────┘
                │ usa                                           │ guarda en
                ▼                                               ▼
     packages/sim  (dominio puro)                  Nhost (GraphQL)  ó  apps/server (SQLite, local)
```

## packages/sim — el dominio

Sin navegador, sin Node, sin base de datos. Solo depende de la librería `yaml`. Cada capa solo mira hacia abajo:

| Capa | Contenido |
|---|---|
| `kernel` | azar con semilla, distribuciones, expresiones, calendario laboral |
| `model` | tipos de la empresa, procesos, procedimientos, eventos (sin lógica) |
| `company` | validación, YAML, instalaciones y objetos de las salas |
| `simulation` | motor de eventos discretos y reproductor |
| `process` | gestión de procesos: dependencias, fichas, procedimientos |
| `legacy` | motor original de un solo proceso (sin uso en la aplicación) |

Se importa siempre desde la raíz del paquete (`@office-pixel/sim`), que es su interfaz pública.

## apps/web — la aplicación

| Capa | Responsabilidad |
|---|---|
| `shared` | formato de tiempos, porcentajes, HTML seguro |
| `application` | casos de uso (`Persistence`), edición del modelo, narración, y los **puertos** (`Backend`, `LocalCache`) |
| `infrastructure` | **adaptadores** de los puertos: Nhost, SQLite local, almacenamiento del navegador |
| `scene` | el plano en Phaser |
| `ui` | formularios y pantallas en Preact |
| `app` | raíz de composición: elige adaptadores, enlaza todo y arranca (`main.ts` solo importa `app/bootstrap`) |

La **inversión de dependencias** está en `application/ports.ts`: la lógica de guardado no sabe si habla con Nhost o con SQLite; `infrastructure/backend/db.ts` elige según `VITE_NHOST_SUBDOMAIN`. Por eso los tests de `Persistence` usan un backend falso en memoria.

## apps/server

API REST sobre SQLite para trabajar sin cuenta. Solo depende de Node y de `sim`; el almacén (`store.ts`) no conoce HTTP.

## Reglas comprobadas

Cada paquete tiene `test/architecture.test.ts`. Si un import rompe una regla, el test falla y dice cuál. Reglas principales:

- cada capa solo importa de las permitidas (tablas de arriba);
- `sim` no usa `document`, `window`, `localStorage` ni paquetes distintos de `yaml`;
- `application` y `shared` no tocan el navegador ni la red;
- `ui`, `scene` y `application` no llaman a `fetch` ni `localStorage`;
- `main.ts` es solo el punto de entrada;
- el servidor no importa nada de la web.

Para añadir una carpeta nueva hay que darle una regla en el test correspondiente.

## Por qué no microservicios

Hoy no hay un problema que resuelvan: un solo equipo, una sola base de datos, y la simulación corre en el navegador. Separar en servicios añadiría red, despliegues y versionado de contratos sin beneficio.

Las costuras para extraer más adelante, si hiciera falta, ya existen:

- **Simulación** (`packages/sim`): es pura y determinista; puede ejecutarse como servicio (simulaciones largas o muchas semillas) sin cambiar su código.
- **Persistencia**: ya está detrás del puerto `Backend`; añadir otro adaptador no toca la aplicación.
- **Documentos/fichas** (`process/ficha`): generación de Markdown independiente del resto.

## Decisión

Se eligió «estructural modular» sobre microservicios: fronteras por capas y dominios, reglas verificadas por tests, un solo despliegue (Vercel para la web, Nhost para los datos).
