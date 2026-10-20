---
tags: [gestión, roadmap]
---
# Roadmap del prototipo

## Hito 1 (prototipo)
- [x] Monorepo Vite + TS (`packages/sim`, `apps/web`)
- [x] Esquema + validación de la definición YAML ([[08 Definición de proceso]])
- [x] Motor DES con semilla y flujo de eventos ([[09 Motor de simulación]])
- [x] Mapa generado desde el YAML (una sala por etapa; el ejemplo tiene 6)
- [x] Cajas animadas desde el log, controles de velocidad y línea de tiempo
- [x] Métricas: throughput, ciclo medio/P90, espera por etapa, utilización, SLA, excepciones
- [x] Efecto visual de cuello de botella ([[04 Indicadores y cuellos de botella]])
- Pendiente de validar: la prueba de los 10 segundos con supervisores reales ([[11 User Journey FDE]])

### Notas del Hito 1
- `calendar`/`shift` se aceptan pero no se aplican (24/7).
- `wip.limit` es solo visual; no bloquea el flujo.
- Render en Canvas 2D (WebGL falló en el navegador embebido con "Framebuffer incomplete").

## Hito 2
- [ ] Calendarios/turnos y WIP que bloquea (excepciones y SLAs ya están en el Hito 1)
- [ ] NPCs como recursos; avatar del FDE interviene
- [ ] Comparación A/B y Monte Carlo

## Hito 3
- [ ] Importación de logs CSV y calibración
- [ ] Multijugador y proximidad (LiveKit)
- [ ] Integraciones Jira/Trello
