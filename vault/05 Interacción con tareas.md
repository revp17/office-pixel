---
tags: [producto, interacción]
---
# Interacción con tareas

## Tecla `E`
Abre un **panel lateral** (no modal) para conservar el contexto espacial. En simulación muestra la **traza del caso**: por dónde pasó, cuánto esperó, qué regla lo desvió.

## Integraciones (Jira/Trello)
Jira normalmente **no** se deja embeber en iframe (`X-Frame-Options`, `frame-ancestors`). Opciones:
1. Panel propio que consume la API (recomendado).
2. URL con permiso de embed (Trello a veces).
3. Iframe a una vista propia con `postMessage`.

Fase posterior al prototipo.

## Notas adhesivas
- Rol `project_lead` con permiso `place_sticky`; tecla `N`.
- Texto ≤ 140 caracteres, color, autor, caducidad opcional.
- Ancladas a una tarea (se mueven con ella) o al suelo.
- Persistidas en servidor, last-write-wins con versión.
