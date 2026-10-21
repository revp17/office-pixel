# Office-Pixel

Simulador visual de procesos para Forward Deployed Engineers: define un proceso (etapas, reglas, excepciones, tiempos), simúlalo y obsérvalo avanzar en un mapa 2D pixel-art.

## Estructura

- `packages/sim` — motor de simulación de eventos discretos (TypeScript, sin dependencias de render): RNG con semilla, distribuciones, evaluador seguro de reglas, validación del YAML, motor DES, métricas y `Replayer`.
- `apps/web` — Studio (editor YAML) + mapa Phaser que reproduce el log de eventos, con controles de velocidad, línea de tiempo y métricas.
- `examples/aprobacion_credito.yaml` — proceso de ejemplo.
- `vault/` — vault de Obsidian con el diseño (empieza por `00 Inicio.md`).

## Empresa virtual (motor listo, sin interfaz todavía)

`examples/banco_pixel.yaml` define una empresa de 32 personas (Comercial, Operaciones, Riesgos, Legal y Atención) con calendario, turnos, reuniones y dos procesos que cruzan áreas. El motor está en `packages/sim/src/org/` (`parseCompany`, `simulateCompany`, `OrgReplayer`). El modelo y sus reglas están en `vault/14 Modelo organizacional.md`. La web actual todavía usa el motor de proceso único.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del motor
npm run typecheck
npm run build
```

## Qué hace el prototipo (Hito 1)

- Edita el YAML en el panel izquierdo y pulsa **Aplicar y simular** (errores de validación en línea).
- El mapa se genera desde la definición: una sala por etapa, puertas, flechas de flujo y líneas rojas de excepciones.
- Cada caso es una caja: ámbar = en cola, azul = trabajando, morado = penalización por excepción, verde = completado, borde rojo parpadeante = SLA roto.
- Cuello de botella: barra de carga de 10 segmentos sobre cada sala y tinte ámbar/rojo según `tareas / wip.limit`.
- Zoom con rueda, arrastrar para mover; con zoom muy alejado se muestran contadores agregados.
- Misma semilla → misma simulación (reproducible).

## Limitaciones conocidas del Hito 1

- `calendar` y `shift` se aceptan pero **no se aplican** (las llegadas y los recursos funcionan 24/7).
- `wip.limit` solo afecta a la visualización; no bloquea el flujo.
- Una sola corrida por vez (sin Monte Carlo ni comparación A/B todavía).
- Phaser se renderiza en modo Canvas 2D.
