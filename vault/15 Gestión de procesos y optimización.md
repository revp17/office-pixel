---
tags: [producto, procesos, metodología]
---
# Gestión de procesos y optimización

Los procesos son la base de la empresa. El sistema tiene un espacio (**📋 Procesos**) para documentarlos, optimizarlos y generar su ficha. Guía de uso: `docs/gestion-de-procesos.md`.

## Ciclo de documentación (5 fases)
1. **Planificación y definición del alcance**: objetivo, entradas/salidas, alcance, criterios de éxito, dueño, involucrados.
2. **Recopilación de información (trabajo de campo)**: entrevistas, observación en sitio, documentos y datos, con hallazgos.
3. **Modelado y diagramación (As-Is)**: el proceso de [[08 Definición de proceso]] dibujado como diagrama y medido con el [[09 Motor de simulación]] (línea base).
4. **Validación con los involucrados**: cada uno aprueba u observa.
5. **Documentación final y fichas de proceso**: aprobación y versionado (1.0, 1.1…) y ficha en Markdown / PDF.

## Optimización: The 5-Step Process (orden estricto)
1. Hacer el requerimiento menos tonto: cuestionar y simplificar cada especificación.
2. Eliminar cualquier parte o proceso innecesario.
3. Simplificar u optimizar el diseño (solo tras reducir).
4. Acelerar el tiempo de ciclo (solo lo ya depurado).
5. Automatizar (solo al final).

### Cómo se hace cumplir el orden
- Un paso solo se abre si el anterior está completado; reabrir uno reabre los posteriores.
- Cerrar un paso exige haber hecho algo **o** haber justificado por escrito por qué no.
- Paso 2: la primera etapa y las de cierre no se eliminan; lo marcado «no necesario» en el paso 1 obliga a eliminarlo o justificarlo.
- Paso 3: los tiempos están bloqueados (se tocan en el 4). Paso 5: la automatización solo se ofrece aquí.

### Modelo de datos
`OrgProcessDef.doc` (ficha y fases) y `OrgProcessDef.optimization` (revisión de requerimientos, etapas eliminadas, diseño To-Be, factores de velocidad y de automatización, pasos completados). El simulador los ignora; viajan en el YAML. Una etapa `automated: true` la hace un sistema: sin personas ni cola, capacidad ilimitada.

### Impacto
Se simula cada variante acumulada (As-Is, paso 2, 3, 4 y 5) con las mismas semillas y se compara ciclo medio, espera, casos cerrados y plazos. Automatizar antes de arreglar el cuello de botella puede **empeorar** el ciclo: es el argumento para el orden.