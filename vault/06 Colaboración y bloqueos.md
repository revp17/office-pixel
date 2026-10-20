---
tags: [producto, colaboración]
---
# Colaboración por proximidad y bloqueos

- Tarea `blocked` → destellos rojos, visible en minimapa y HUD.
- Disparador: ≥ 2 avatares dentro de ~2 casillas durante 2 s → sala efímera `war-room:<task_id>` (WebRTC vía SFU/LiveKit).

## Reglas de diseño
- **Consentimiento**: aviso con cuenta atrás de 3 s y opción de rechazar (privacidad / legislación laboral).
- Botón "llamar al responsable" para watchers lejanos.
- La sala se cierra al quedar vacía; al terminar se pregunta "¿Desbloqueada?" con motivo.
- Cooldown para evitar disparos al pasar caminando.

En el enfoque FDE esto sirve para **sesiones de revisión con el cliente**: varios participantes recorren juntos la simulación. Es secundario frente a [[09 Motor de simulación]].
