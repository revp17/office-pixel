---
tags: [producto]
---
# Visión y alcance

## Concepto
Base técnica inspirada en WorkAdventure/Gather (mapa 2D, avatares pixel-art) con otro enfoque: **gestión visual de procesos**. El mapa es un tablero Kanban / diagrama de flujo gigante y transitable.

## Giro de producto (decisión)
La herramienta será usada por **Forward Deployed Engineers**. Ya no es un tracker de tareas reales sino un **laboratorio de simulación**:

| Modo | Qué hace el FDE | Qué ve |
|---|---|---|
| Studio | Define etapas, reglas, excepciones, tiempos | Mapa regenerado en vivo |
| Simulación | Corre un escenario, controla velocidad | Cajas fluyendo, cuellos de botella |
| Análisis | Compara corridas | Gráficas y replay |

El mapa es la **visualización** de la simulación. Ver [[09 Motor de simulación]].

## Requisitos clave
1. Espacio para definir procesos, reglas, excepciones, tiempos → [[08 Definición de proceso]]
2. Procesos como habitaciones → [[03 Procesos como espacio físico]]
3. Indicadores visuales → [[04 Indicadores y cuellos de botella]]
4. Interacción con tareas → [[05 Interacción con tareas]]
5. Colaboración por proximidad → [[06 Colaboración y bloqueos]]

## Fuera de alcance (por ahora)
- Sincronización bidireccional con Jira/Trello (primero datos propios).
- Edición visual completa del mapa (primero editor YAML).
