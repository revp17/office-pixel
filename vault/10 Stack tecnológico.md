---
tags: [técnico, stack]
---
# Stack tecnológico

| Capa | Opción | Motivo |
|---|---|---|
| Motor 2D | Phaser 3 (evaluar 4) | Tilemaps de Tiled, cámaras y zoom |
| Mapas | Tiled + generador desde YAML | Estándar y compatible |
| UI | Svelte o React sobre el canvas | Paneles y HUD |
| Simulación | TypeScript, DES propio, Web Worker | Determinista, testeable |
| Tiempo real | Colyseus o Socket.IO + Redis | Autoridad de servidor |
| Audio/video | LiveKit (SFU) | P2P no escala > ~6 |
| API | Node + TypeScript (Fastify/NestJS) | Tipos compartidos |
| Persistencia | PostgreSQL (JSONB) + Redis | Auditoría y presencia |
| Integraciones | Webhooks/REST Jira-Trello, BullMQ | Fase posterior |
| Auth | OIDC | SSO y roles |
| Observabilidad | OpenTelemetry, Sentry | |

## Prototipo
Vite + TypeScript + Phaser 3; monorepo con `packages/sim` y `apps/web`. Sin servidor ni auth en el primer hito. Ver [[13 Roadmap del prototipo]].
