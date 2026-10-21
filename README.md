# Office-Pixel

Simulador visual de procesos para Forward Deployed Engineers: define un proceso (etapas, reglas, excepciones, tiempos), simúlalo y obsérvalo avanzar en un mapa 2D pixel-art.

## Estructura

- `packages/sim` — motor de simulación de eventos discretos (TypeScript, sin dependencias de render): RNG con semilla, distribuciones, evaluador seguro de reglas, validación del YAML, motor DES, métricas y `Replayer`.
- `apps/web` — Studio (editor YAML) + mapa Phaser que reproduce el log de eventos, con controles de velocidad, línea de tiempo y métricas.
- `examples/aprobacion_credito.yaml` — proceso de ejemplo.
- `vault/` — vault de Obsidian con el diseño (empieza por `00 Inicio.md`).

## Empresa virtual

`examples/banco_pixel.yaml` define una empresa de 32 personas (Comercial, Operaciones, Riesgos, Legal y Atención) con calendario, turnos, reuniones y dos procesos que cruzan áreas. El motor está en `packages/sim/src/org/` (`parseCompany`, `simulateCompany`, `OrgReplayer`) y el modelo y sus reglas en `vault/14 Modelo organizacional.md`.

La web (`apps/web`) la muestra como un **edificio**:

- Una **planta por área**, una **sala por unidad**, un **escritorio por persona**, una sala común (pausas y reuniones) y una escalera con la entrada abajo.
- Las personas llegan por la entrada, suben por la escalera, caminan a su escritorio, se van a la sala común en pausas y reuniones, y se ven fantasma si están ausentes.
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

## Uso de la interfaz

- Edita el YAML en el panel izquierdo (☰ Studio lo oculta) y pulsa **Aplicar y simular**; los errores de validación salen en línea.
- Velocidad de 10 min/s a 12 h/s, línea de tiempo arrastrable, zoom con rueda y arrastre para mover; con zoom muy alejado se ven solo contadores por sala.
- Misma semilla → misma simulación (reproducible).

## Limitaciones conocidas

- El motor de proceso único del Hito 1 sigue en `packages/sim` (con sus tests), pero la web ya no lo usa.
- Las personas se mueven a velocidad proporcional a la velocidad de simulación; a 4 h/s o más llegan a su sitio con retraso visual.
- No hay picos de demanda, bajas ni contrataciones como escenarios; solo ausencias fijas en `scenario.absences`.
- No hay edición visual de la empresa: se edita el YAML.
- Phaser se renderiza en modo Canvas 2D.
