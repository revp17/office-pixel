---
tags: [técnico, datos]
---
# Modelo de datos de tarea (caso)

```json
{
  "id": "task_01HZX9K3",
  "externalRef": { "provider": "jira", "key": "PROJ-142", "url": "https://acme.atlassian.net/browse/PROJ-142", "syncedAt": "2026-10-20T09:12:44Z" },
  "title": "Migrar facturación a nuevo gateway",
  "workflowId": "wf_delivery_v2",
  "stage": { "id": "review", "enteredAt": "2026-10-17T15:30:00Z", "ageHours": 65 },
  "lane": "equipo-pagos",
  "priority": "high",
  "estimate": { "unit": "points", "value": 8, "done": 6 },
  "progress": 0.75,
  "assignees": [{ "userId": "u_ana", "role": "owner" }],
  "dueDate": "2026-10-24",
  "sla": { "breached": false, "hoursRemaining": 76 },
  "blocked": { "isBlocked": true, "reason": "Esperando credenciales", "since": "2026-10-19T08:00:00Z", "warRoomId": "war_PROJ-142" },
  "map": { "mapId": "floor1", "tile": { "x": 42, "y": 17 }, "roomId": "room_review", "stackIndex": 3, "lockedBy": null },
  "visual": { "sprite": "crate_blue", "label": "PROJ-142", "tint": "#E4572E", "effects": ["blink_red"] },
  "stickies": [{ "id": "st_88", "authorId": "u_pm", "text": "Prioridad máxima", "color": "yellow" }],
  "audit": [{ "at": "2026-10-17T15:30:00Z", "by": "u_ana", "action": "move", "from": "in_progress", "to": "review" }],
  "version": 14
}
```

## Notas
- `map` guarda solo estado espacial; el dominio va aparte (Jira puede ser fuente de verdad).
- `version` = control de concurrencia optimista.
- `visual` se **deriva** del dominio; idealmente no se persiste.
- Posiciones en coordenadas de tile.
