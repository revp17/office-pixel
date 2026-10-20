---
tags: [producto, visual]
---
# Procesos como espacio físico

## Etapas = habitaciones
Pasillo continuo tipo línea de montaje; cada etapa es una sala con identidad propia.

| Etapa | Sala | Ambientación |
|---|---|---|
| Por hacer | Almacén | Estanterías, cajas selladas |
| En progreso | Taller | Mesas de trabajo |
| Revisión | Oficina de auditoría | Escritorios, sello |
| Completado | Sala de despacho | Muelle de carga |

- **Puertas/compuertas** entre salas: una tarea solo cruza si cumple las reglas del flujo.
- **Carriles (swimlanes)**: plantas o alas del edificio; escaleras = cambio de carril.
- El mapa se **genera** desde la definición del proceso ([[08 Definición de proceso]]); Tiled queda para personalización avanzada.

## Objeto-tarea
Sprite 32×32 (caja/carpeta). Color = prioridad; iniciales del responsable; mini-barra de subtareas.
Estados: normal, bloqueada (destellos rojos), vencida (vibra), recién movida (partículas).

## Mover tareas
- Empujar estilo Sokoban o agarrar con `Espacio`.
- Al cruzar el umbral se envía `task.move_requested`; **el servidor decide**. Si no es válido la caja rebota con mensaje.
- Lock optimista con lease de 5 s; log de auditoría inmutable.

En modo simulación las cajas las mueven NPCs (ver [[09 Motor de simulación]]).
