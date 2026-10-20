---
tags: [decisión, técnico]
---
# Fork de WorkAdventure vs cliente propio

WorkAdventure usa Phaser, mapas de Tiled, un Scripting API y WebRTC. Licencia **AGPL-3.0**: si se bifurca y se ofrece como servicio hay que publicar el código.

| Opción | A favor | En contra |
|---|---|---|
| Fork | Movimiento, salas, proximidad y presencia ya hechos | AGPL, base de código grande que no controlamos |
| Cliente propio ligero | Control total, sin AGPL | Hay que escribir movimiento y presencia |

## Decisión
**Cliente propio ligero** para el prototipo: Phaser + Tiled + servidor Colyseus/Socket.IO; audio/video por proximidad con LiveKit más adelante. Lo distintivo (tareas, zonas, simulación) hay que escribirlo en cualquiera de los dos caminos.

Ver [[10 Stack tecnológico]].
