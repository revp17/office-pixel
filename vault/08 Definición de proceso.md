---
tags: [técnico, studio]
---
# Definición de proceso (Studio)

Dos vistas sincronizadas sobre el mismo modelo: **editor YAML/JSON** (validado por esquema, versionable en git) y **editor visual** sobre el mapa.

## Qué se define
- **Etapas y transiciones**, incluidos ciclos de retrabajo.
- **Reglas**: condiciones de paso, asignación (round-robin, por skill), prioridad y política de cola.
- **Excepciones**: probabilidad de fallo, reintentos, timeouts, escalamiento, rechazo, dato faltante, recurso caído, intervención manual.
- **Tiempos**: distribución por etapa (fija, normal, lognormal, exponencial), calendarios, SLAs.
- **Recursos**: trabajadores/agentes con capacidad, turnos y skills.
- **Llegadas**: constante, ráfagas, estacional.

## Ejemplo
> Nota: este es el formato del primer prototipo, de un solo proceso. Ese motor se eliminó y su ejemplo (`aprobacion_credito.yaml`) ya no está en el repo. Hoy se define una empresa completa; el formato vigente está en `examples/banco_pixel.yaml` y en `docs/guia-de-uso.md`. Lo de abajo se conserva como historia del diseño.

```yaml
process: aprobacion_credito
arrivals: { type: poisson, ratePerHour: 12, calendar: lun-vie_9-18 }
resources:
  - { id: analistas, count: 3, skills: [riesgo] }
stages:
  - id: revision
    resource: analistas
    duration: { dist: normal, meanMinutes: 25, sdMinutes: 8 }
    sla: { maxMinutes: 120, onBreach: escalate }
    exceptions:
      - { id: rechazo, probability: 0.12, action: goto, target: cerrado_rechazado }
    next: despacho
```

Expresiones de reglas: JSON Logic o CEL (seguras, sin ejecutar código arbitrario).

## Importación (alto valor)
- Log de eventos CSV (`case_id, etapa, timestamp`) → calibrar distribuciones, probabilidades y llegadas.
- BPMN 2.0.
