# Office-Pixel

Simulador visual de procesos para Forward Deployed Engineers: define un proceso (etapas, reglas, excepciones, tiempos), simúlalo y obsérvalo avanzar en un mapa 2D pixel-art.

## Estructura

- `packages/sim` — motor de simulación de eventos discretos (TypeScript, sin dependencias de render): RNG con semilla, distribuciones, evaluador seguro de reglas, validación del YAML, motor DES, métricas y `Replayer`.
- `apps/web` — Studio (editor YAML) + mapa Phaser que reproduce el log de eventos, con controles de velocidad, línea de tiempo y métricas.
- `examples/aprobacion_credito.yaml` — proceso de ejemplo.
- `vault/` — vault de Obsidian con el diseño (empieza por `00 Inicio.md`).

> **Guía de uso:** [docs/guia-de-uso.md](docs/guia-de-uso.md) — cómo se dibujan áreas y empleados, y cómo se configura todo paso a paso.
> **Procedimientos:** [docs/procedimientos.md](docs/procedimientos.md) — cómo levantar el cómo, quién y cuándo de cada etapa (5 pasos, acción-resultado, capturas anotadas, prueba del novato y firma del ejecutor).
> **Instalaciones y plantillas:** [docs/instalaciones-y-plantillas.md](docs/instalaciones-y-plantillas.md) — bodegas, ingreso y despacho, seguridad y mantenimiento en el plano, y plantillas de empresa pequeña, mediana y grande.
> **Gestión de procesos:** [docs/gestion-de-procesos.md](docs/gestion-de-procesos.md) — documentar (5 fases), optimizar (5 pasos de Musk, en orden estricto) y la ficha de proceso.

## Empresa virtual

`examples/banco_pixel.yaml` define una empresa de 32 personas (Comercial, Operaciones, Riesgos, Legal y Atención) con calendario, turnos, reuniones y dos procesos que cruzan áreas. El motor está en `packages/sim/src/org/` (`parseCompany`, `simulateCompany`, `OrgReplayer`) y el modelo y sus reglas en `vault/14 Modelo organizacional.md`.

La web (`apps/web`) la muestra como un **edificio**:

- Una **planta** (la empresa) que contiene **áreas**; cada área puede tener **subáreas**. Cada área y subárea tiene su nombre y sus **responsables** y **colaboradores** (los responsables se sientan primero, con placa dorada y ★).
- Las personas llegan por la entrada, recorren los pasillos, caminan a su escritorio, se van a la sala común en pausas y reuniones, y se ven fantasma si están ausentes.
- Los casos son cajas: llegan por la entrada, esperan en la **bandeja** de la sala, se posan en el escritorio de quien los trabaja y viajan entre salas en los traspasos.
- Cuello de botella: cada sala muestra `presentes/total · c<cola>`, una barra de carga y un tinte ámbar/rojo.
- Clic en una persona (o en la lista) para ver su día, su carga y su caso actual. Con la noche el edificio se oscurece.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del motor
npm run typecheck
npm run build
```

## Configurar la empresa (formularios)

El botón **⚙ Configurar empresa** abre un panel de formularios, sin tocar YAML:

| Pestaña | Qué se configura |
|---|---|
| Empresa | nombre, jornada, días laborables, pausas, ausentismo, tiempos de traslado |
| &nbsp;&nbsp;↳ Instalaciones | catálogo de tipos de instalación (bodega, ingreso, despacho, seguridad…): ver, aplicar o crear áreas de ese tipo |
| &nbsp;&nbsp;↳ Áreas y subáreas | la planta, sus áreas y subáreas, y los responsables y colaboradores de cada una |
| Personas | una fila por persona: equipo, rol, jefe, velocidad, errores, ausentismo, horario, habilidades |
| Procesos | llegadas, datos de cada caso, etapas (equipo, rol, duración, plazo), camino siguiente o por condiciones, excepciones |
| YAML (avanzado) | el mismo contenido como texto: copiar, descargar, abrir archivo, pegar |

Los problemas se validan en vivo (el botón **Aplicar y simular** se bloquea hasta resolverlos). «Cargar ejemplo» y «Empezar en blanco» reemplazan el borrador. La empresa aplicada se guarda en el navegador (`localStorage`); si no hay nada guardado se carga Banco Pixel. Los identificadores internos se generan solos a partir de los nombres.

## Uso de la interfaz

- **▤ Vertical / ▥ Horizontal** (barra superior) cambia la disposición de las áreas dentro de la planta: apiladas de arriba abajo, o en fila de izquierda a derecha. Se recuerda al recargar.
- Los días y la semilla de la simulación están en la barra superior (**↻ Simular** repite con otros valores).
- Velocidad de 10 min/s a 12 h/s, línea de tiempo arrastrable, zoom con la rueda (hacia el cursor) y arrastre para mover. Los botones con el nombre de cada área acercan la cámara a ella; **Planta completa** y **Vista general** encuadran todo. Con zoom muy alejado se ven solo contadores por sala.
- Aspecto: formas suavizadas (sin `pixelArt`), render a la resolución real de la pantalla (`devicePixelRatio`), texto nítido y avatares/cajas que crecen al alejar la cámara para seguir siendo legibles.
- Misma semilla → misma simulación (reproducible).

## Limitaciones conocidas

- El motor de proceso único del Hito 1 sigue en `packages/sim` (con sus tests), pero la web ya no lo usa.
- Las personas se mueven a velocidad proporcional a la velocidad de simulación; a 4 h/s o más llegan a su sitio con retraso visual.
- No hay picos de demanda, bajas ni contrataciones como escenarios; solo ausencias fijas en `scenario.absences`.
- Los mensajes de validación muestran identificadores internos (p. ej. `equipo_1`) en vez de los nombres.
- No hay deshacer en los formularios; «Cancelar» descarta todo el borrador.
- Phaser se renderiza en modo Canvas 2D.
