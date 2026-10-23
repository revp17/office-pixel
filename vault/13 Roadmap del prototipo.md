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

## Hito 1.5 — Empresa virtual (ver [[14 Modelo organizacional]])
- [x] Modelo de empresa: unidades, personas, calendarios, turnos, reuniones, ausentismo
- [x] Motor: cola compartida con *pull*, trabajo que se pausa/reanuda, error humano, traspasos con traslado, tiempo hábil
- [x] Validación del YAML de empresa (elegibilidad, referencias, horas)
- [x] `examples/banco_pixel.yaml`: 32 personas, 5 áreas, 2 procesos cruzados
- [x] `OrgReplayer` y 16 tests nuevos
- [x] Plano generado desde el organigrama: planta → áreas → subáreas → escritorios, sala común por área, pasillos — `apps/web/src/building.ts`
- [x] Avatares que caminan por puertas y pasillos según su estado (`person.state`)
- [x] Casos como cajas: bandeja por sala, sobre el escritorio al trabajarse, viajan en los traspasos
- [x] Panel de persona (su día, carga, caso actual) y utilización por unidad
- [x] Web migrada del motor de proceso al de empresa (la vista de proceso único se eliminó)
- [x] Panel de configuración con formularios (Preact): empresa, áreas, personas, procesos con reglas y excepciones, horarios, YAML avanzado; validación en vivo; guardado en `localStorage`
- [ ] Panel de unidad con cola histórica y comparación entre corridas
- [x] Responsables y colaboradores por área y subárea (`kind`), con su aspecto propio, y formularios para gestionarlos
- [x] Gestión de procesos: ciclo de documentación en 5 fases, optimización de 5 pasos en orden estricto con impacto medido, ficha de proceso exportable ([[15 Gestión de procesos y optimización]])
- [ ] Varias plantas (sedes)
- [ ] Mensajes de validación con nombres en vez de ids; deshacer/rehacer en los formularios
- [ ] Editor visual del organigrama (arrastrar) y del flujo del proceso (diagrama)

Hallazgo con la semilla 1 (5 días): el cuello de botella no es Riesgos sino **Contratos (Legal)**, 87 % de utilización y ~2 h de espera media en revisión legal.

## Hito 2
- [ ] Calendarios/turnos y WIP que bloquea (excepciones y SLAs ya están en el Hito 1)
- [ ] NPCs como recursos; avatar del FDE interviene
- [ ] Comparación A/B y Monte Carlo

## Hito 3
- [ ] Importación de logs CSV y calibración
- [ ] Multijugador y proximidad (LiveKit)
- [ ] Integraciones Jira/Trello
