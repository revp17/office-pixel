---
tags: [técnico, modelo, empresa]
---
# Modelo organizacional (empresa virtual)

**Giro de producto:** la unidad base ya no es el proceso sino la **empresa**: áreas, subáreas y personas. Los procesos son el trabajo que fluye *entre* personas y áreas. Ver [[01 Visión y alcance]].

Decisiones tomadas con el usuario (2026-10-20):
- **Realismo:** rutina diaria (horarios, almuerzo, reuniones, ausencias, velocidad y errores propios). Estocástico y reproducible. IA por persona queda como extra posterior.
- **Empresa piloto:** inventada, ~30 personas, 5 áreas (`examples/banco_pixel.yaml`).
- **Escala visual:** decenas de personas con avatar individual.

## Entidades

| Entidad | Qué es |
|---|---|
| **Unidad** | Árbol recursivo Empresa › Área › Subárea. Los nodos de primer nivel son *áreas* |
| **Persona** | `unit`, `role`, `skills`, `reportsTo`, `speed`, `errorRate`, `absenteeism`, `schedule` |
| **Calendario** | Días hábiles, jornada, pausas (almuerzo), ausentismo base |
| **Turnos** | Horarios alternativos por persona (`schedules`) |
| **Reuniones** | Bloques recurrentes por unidad (incluye sus subunidades) |
| **Proceso** | Etapas que piden `unit` + `role`/`skill`; pueden cruzar áreas |
| **Escenario** | Ausencias puntuales (más adelante: picos de demanda, bajas, contrataciones) |

## Reglas de ejecución

- **Cola compartida por etapa, las personas *jalan* (pull).** Cuando alguien queda libre y está en jornada toma el caso que lleva más tiempo esperando entre las etapas que puede ejecutar. Evita que alguien esté ocioso mientras otro acumula cola.
- **Elegibilidad:** persona en la unidad de la etapa (o sus descendientes) y con el `role`/`skill` pedido. Si nadie es elegible, la validación falla.
- **Duración** de una etapa = minutos de trabajo a velocidad 1.0; real = `duración / speed`. El trabajo **se pausa** en pausas, reuniones y fin de jornada, y se reanuda en la siguiente ventana.
- **Error humano:** al terminar, con probabilidad `errorRate` de la persona el caso se rehace en la misma etapa.
- **Traspasos:** si la siguiente etapa es de otra unidad, el caso viaja `travel` minutos (`sameTeam` / `sameArea` / `crossArea`). El evento `handoff.started` permitirá animar a alguien caminando.
- **Tiempo hábil:** llegadas, SLAs y tiempos de ciclo se miden en **minutos hábiles** de la empresa (no cuentan noches ni fines de semana).
- **Ausentismo:** determinista por (semilla, persona, día): la misma semilla da las mismas ausencias, sin importar el horizonte.
- Día 0 = lunes; `workDays` usa 0=lun … 6=dom.

## Eventos que emite el motor
`case.created`, `stage.entered`, `handoff.started`, `work.started`, `work.paused`, `work.resumed`, `work.finished`, `exception`, `sla.breached`, `case.completed` y `person.state` (`off`, `idle`, `working`, `break`, `meeting`, `absent`). La vista solo reproduce este log ([[09 Motor de simulación]]).

## Métricas
Por proceso (ciclo medio/P90 hábil, SLA), por etapa (espera, cola final), por persona (utilización = trabajado / disponible, tareas) y por unidad (utilización agregada).

## Pendiente / siguientes fases
Edificio generado desde el árbol (planta → áreas → subáreas → escritorios) y avatares que caminan; bandejas por persona; políticas de asignación *push*; picos de demanda y bajas como escenarios; costo por persona; editores visuales de organigrama. Ver [[13 Roadmap del prototipo]].

## Estructura vigente (2026-10-23)

```
Planta (o empresa)          ← una sola; el contorno que lo contiene todo
 └─ Área                    ← 1 o varias; cada una con su nombre
     ├─ responsables y colaboradores del área
     └─ Subárea             ← 0 o varias; cada una con su nombre
         └─ responsables y colaboradores de la subárea
```

- En el modelo, `units` son las áreas (primer nivel) y sus hijos son subáreas; el nombre de la planta es `company`.
- Cada persona pertenece a **una** unidad y tiene `kind: responsable | colaborador` (por defecto, colaborador). Una unidad puede tener varios de cada tipo.
- `kind` **no afecta** a la asignación de trabajo (sigue siendo unidad + rol); solo organiza y se muestra (los responsables se sientan primero, con placa dorada y ★).
- El campo antiguo `head` de una unidad se migra al leer el YAML: esa persona pasa a `kind: responsable`.
- Visual: las áreas son zonas coloreadas dentro de la planta (apiladas o en fila según el selector); el área tiene sala propia si tiene gente directa, y las subáreas y áreas vacías también se dibujan.
- Pendiente: varias plantas (sedes).