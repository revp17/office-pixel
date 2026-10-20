---
tags: [producto, visual, métricas]
---
# Indicadores y cuellos de botella

## Carga por sala
`carga = tareas_en_sala / wip_limite`

| Carga | Efecto visual |
|---|---|
| < 0.7 | Iluminación normal |
| 0.7 – 1.0 | Tinte ámbar, cajas empiezan a apilarse |
| > 1.0 | Tinte rojo pulsante, cajas hasta el techo, pasillo se estrecha |
| > 1.5 | Humo/alarma, avatares se ralentizan al cruzar |

Además: **aging** — una caja que lleva N días en la misma sala acumula polvo/telarañas.

## Barras de progreso
- Sobre cada puerta: barra pixel-art de 8–16 bloques.
- **Zoom semántico**: zoom out oculta sprites y muestra tokens agregados (número, barra, semáforo); zoom in muestra cajas.
- HUD con barra global y throughput.

## Gamificación
Premiar el **flujo** (desatascar, cero bloqueos), no la cantidad de tareas movidas.

## Métricas en vivo (simulación)
Throughput, tiempo de ciclo y de espera, utilización por recurso, SLAs incumplidos, ruta más frecuente.
