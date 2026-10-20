---
tags: [técnico, simulación]
---
# Motor de simulación

**Principio: separar el motor del render.** El motor no sabe nada de Phaser.

- **DES** (eventos discretos) en TypeScript, determinista con **semilla**: misma semilla → mismo resultado.
- Emite un **flujo de eventos** (`case.created`, `case.moved`, `case.failed`, `sla.breached`…) guardado como log.
- **Phaser reproduce el log** → replay, pausa, rebobinado y velocidad 1×–1000× gratis.
- Corre en Web Worker o en servidor para corridas pesadas.
- **Monte Carlo**: N corridas con semillas distintas, reportar rangos (p. ej. P90), no un solo número.

## Avatares
- **NPC** = recursos simulados; un NPC siempre ocupado señala un cuello de botella.
- **Avatar del FDE** = observador e interventor: empuja cajas, inyecta excepciones, cierra puertas, quita recursos, cambia reglas en caliente.

## Comparación
Misma semilla, variantes de proceso (A/B) → gráficas lado a lado y replay.

Ver [[08 Definición de proceso]] y [[04 Indicadores y cuellos de botella]].
