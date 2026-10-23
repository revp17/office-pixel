---
tags: [producto, procedimientos, metodología]
---
# Procedimientos asociados a los procesos

Un procedimiento detalla **una etapa** de un proceso (visión micro: cómo, quién y cuándo). Guía de uso: `docs/procedimientos.md`. Complementa a [[15 Gestión de procesos y optimización]].

| | Proceso | Procedimiento |
|---|---|---|
| Enfoque | Estratégico / macro | Táctico / micro |
| Responde a | ¿Qué se hace? ¿Para qué? | ¿Cómo? ¿Quién? |
| Formato | Diagrama de flujo | Documento narrativo + capturas |
| Se levanta con | Directores y dueños | Operadores directos |

## Los 5 pasos para levantarlo
1. **Entrevista de tarea a tarea y observación crítica**: ejecución en vivo, excepciones («¿qué pasa si…?») y trucos operativos.
2. **Estructurar el contenido (5 bloques)**: objetivo y alcance · responsabilidades (puestos, no nombres) · glosario · desarrollo paso a paso · anexos y control de cambios.
3. **Redactar en formato acción-resultado**: [Actor] + [Acción] + [Herramienta] + [Resultado esperado]; verbo de acción, una acción por paso.
4. **Ayudas visuales**: capturas anotadas (círculos, flechas, números), diagrama de flujo a nivel de tarea, señales de advertencia.
5. **Prueba de escritorio y validación cruzada**: prueba del novato (sin preguntas) y firma del ejecutor.

## Reglas que se hacen cumplir
- Pasos en orden; reabrir uno reabre los posteriores.
- Revisión automática de cada paso: verbo al inicio, actor = puesto (no nombre), resultado esperado, una sola acción.
- Cada excepción del levantamiento debe tener un camino alternativo en algún paso.
- Publicar exige los 5 pasos; una nueva versión exige describir el cambio (control de cambios).

## Modelo de datos
`OrgProcessDef.procedures: Procedure[]` con `stageId`, `fieldwork`, bloques de contenido, `steps` (con `alternatives`, `warning`, `image` y `marks` en fracciones 0–1), `attempts`, `signoffs`, `changes`, `version` y `done`. El simulador lo ignora; viaja en el YAML.

## Requisitos entre procedimientos

Un procedimiento puede exigir otros como requisito previo (paso 2). Ver [[15 Gestión de procesos y optimización]] para las dependencias entre procesos.
