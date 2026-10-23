# Gestión de procesos: documentar, optimizar y ficha

Para una empresa, **la base son los procesos**. Esta guía explica el espacio donde se **documentan** (5 fases), se **optimizan** (5 pasos, en orden estricto) y se obtiene la **ficha de proceso**.

Se abre con el botón **📋 Procesos**, en la barra superior. A la izquierda están los procesos de la empresa (cada uno con su avance: `Doc 2/5`, `Opt 1/5` y la versión de su ficha). Arriba, tres pestañas:

| Pestaña | Para qué |
|---|---|
| **1 · Documentar (5 fases)** | Levantar y validar el proceso tal como funciona hoy (As-Is) |
| **2 · Optimizar (5 pasos)** | Mejorarlo con la metodología de 5 pasos, midiendo el efecto de cada uno |
| **3 · Procedimientos** | El cómo, quién y cuándo de cada etapa ([guía](procedimientos.md)) |
| **🔗 Dependencias** | Cómo se conectan los procesos y los procedimientos |
| **Ficha de proceso** | El documento final: ver, descargar, imprimir |

> Los cambios se guardan con **Guardar y cerrar**. La ficha y la optimización viajan con la empresa (también en el YAML), pero **no cambian lo que se simula**: el proceso real sigue siendo el de «Configurar empresa → Procesos».

---

## 1. Documentar el proceso: 5 fases

Cada fase tiene una **lista de comprobación** (✔ / ○) y el botón **Marcar fase como completada**, que se activa cuando la lista está completa. Puedes reabrir una fase cuando haga falta.

### Fase 1 · Planificación y definición del alcance

Qué proceso es y hasta dónde llega:

- **Objetivo** del proceso.
- **Entradas** (qué lo dispara) y **salidas** (qué entrega).
- **Dentro** y **fuera del alcance**.
- **Criterios de éxito** (mejor con números).
- **Dueño del proceso** (una persona de la empresa) y fechas de inicio y fin previstas.
- **Involucrados**: quienes conocen, usan o se ven afectados. Cada uno puede enlazarse con una persona de la empresa o ser externo. Ellos validarán el modelo en la fase 4.

### Fase 2 · Recopilación de información (trabajo de campo)

Registros de lo que viste y escuchaste: **entrevista**, **observación en sitio**, **documento revisado** o **datos recogidos**. Cada uno lleva fecha, fuente, notas y **hallazgos** (problemas, repeticiones, esperas, excepciones). Para completar la fase hace falta al menos un registro con hallazgos y una entrevista u observación.

### Fase 3 · Modelado y diagramación (As-Is)

- El **diagrama** se dibuja solo a partir de las etapas, reglas y excepciones del proceso: cada caja muestra la etapa, su área › subárea, el rol, la duración típica y el plazo; las flechas grises son el camino, con la condición escrita sobre las bifurcaciones; las rojas discontinuas son excepciones, con su probabilidad.
- Si algo no coincide con lo que viste en campo, usa **Editar el proceso…**: te lleva a «Configurar empresa → Procesos».
- **Línea base**: mide el proceso actual con el simulador (promedio de 3 semillas) y guarda casos cerrados, tiempo de ciclo medio y P90, espera por caso y plazos incumplidos. Después sirve para comparar.

### Fase 4 · Validación con los involucrados

Para cada involucrado, su respuesta (**Pendiente**, **Aprobado**, **Con observaciones**), un comentario y la fecha. La fase se completa cuando **todos aprobaron**. Con observaciones: corrige el modelo, muéstraselo de nuevo y cambia la respuesta.

### Fase 5 · Documentación final y fichas de proceso

Requiere las 4 fases anteriores. **Aprobar versión 1.0** fija el número de versión y la fecha de hoy. Si después el proceso cambia, reabre la fase y vuelve a aprobar: sale la **1.1**, la **1.2**… El botón **Ver la ficha de proceso** abre la ficha.

---

## 2. Optimizar el proceso: los 5 pasos (orden estricto)

La metodología es **The 5-Step Process**. Su regla es aplicarlos **estrictamente en este orden**: **no se puede saltar un paso** ni empezar uno sin haber completado el anterior (los pasos futuros aparecen con 🔒). Si reabres un paso, **también se reabren todos los posteriores**.

El trabajo parte del As-Is y se hace sobre una **copia To-Be**: el proceso real no se toca.

| # | Paso | Regla | Qué haces aquí |
|---|---|---|---|
| 1 | **Hacer el requerimiento menos tonto** | Cuestionar y simplificar cada especificación inicial | Para cada etapa: **quién** la pidió (una persona, no un departamento), **por qué** existe, si es **necesaria** (sí / no / no sé) y una versión más simple |
| 2 | **Eliminar cualquier parte o proceso innecesario** | Borrar todo lo que no afecte críticamente el resultado | Marcas las etapas a **eliminar** (las «no necesarias» vienen sugeridas). El flujo se reconecta solo. Si no eliminas nada, debes justificarlo |
| 3 | **Simplificar u optimizar el diseño** | Mejorar solo después de haber reducido | **Rediseñas** lo que quedó con las mismas tarjetas de etapa (fusionar, reducir traspasos, simplificar reglas). Aquí **no se tocan tiempos** |
| 4 | **Acelerar el tiempo de ciclo** | Acelerar solo lo que ya fue depurado | Un deslizador por etapa: qué porcentaje de su duración actual (100 % = igual; 70 % = 30 % más rápida) |
| 5 | **Automatizar** | Robots y sistemas únicamente al final | Marcas qué etapas pasa a hacer un **sistema** (sin personas, sin cola) y cuánto dura entonces |

Cada paso tiene su lista de comprobación y se cierra con **Completar el paso N y pasar al N+1**. Para cerrar un paso hay que **haber hecho algo o haber explicado por qué no** (nota con un mínimo de caracteres): la metodología es estricta con la reducción antes que con la velocidad.

Reglas de protección: la **primera etapa** y las de **cierre** no se eliminan; en el paso 3 los campos de tiempo están bloqueados; la casilla «la hace un sistema» solo existe en el paso 5 (y en el editor normal, para registrar automatizaciones que ya existen hoy).

### Impacto medido

Al pie de la pestaña, **Calcular impacto** simula el proceso con las mismas semillas y días, cambiando solo lo decidido en cada paso, y muestra:

| Variante | Qué es |
|---|---|
| As-Is (hoy) | El proceso actual |
| Paso 2 · Eliminar | Sin las etapas eliminadas |
| Paso 3 · Simplificar el diseño | Con el rediseño |
| Paso 4 · Acelerar | + duraciones reducidas |
| Paso 5 · Automatizar | + etapas automatizadas |

Con las etapas, el tiempo de ciclo medio (con una barra), el cambio **vs As-Is**, la espera por caso, los casos cerrados y los plazos incumplidos. Solo aparecen los pasos completados y el que está en curso. Si cambias algo después, la tabla avisa de que está desactualizada.

**Ver en el plano** simula esa variante en el edificio: una franja amarilla indica que es una **vista previa** (no se guarda); **Volver a la empresa real** la quita. Las etapas automatizadas se ven como cajas en el recuadro **⚙ Sistema** de su sala.

> **Lectura honesta de los números.** Automatizar una etapa puede *aumentar* el tiempo de ciclo si el cuello de botella está más adelante: entra más trabajo y se forman colas donde falta capacidad. Es exactamente por lo que la automatización va **la última**: primero se arregla el diseño y el cuello de botella, y solo entonces se acelera lo que ya es correcto.

---

## 3. La ficha de proceso

En la pestaña **Ficha de proceso** se genera el documento final, siempre actualizado con lo que hayas llenado:

1. **Identificación**: proceso, planta/empresa, dueño, fechas, fases completadas.
2. **Objetivo y alcance**: objetivo, entradas, salidas, dentro y fuera del alcance, criterios de éxito.
3. **Involucrados** y su validación.
4. **Hallazgos del trabajo de campo**.
5. **Proceso As-Is**: llegadas, tabla de etapas (área › subárea, rol, duración típica, plazo, siguiente paso y excepciones) y la línea base.
6. **Validación**: quién aprobó, cuándo y con qué comentarios.
7. **Optimización** (solo si hay pasos hechos): estado de cada paso, requerimientos cuestionados, lo eliminado, acelerado y automatizado, y las notas.

Botones: **Descargar .md** (Markdown), **Imprimir / guardar en PDF**, **Copiar Markdown** e **Incluir comparación de la optimización** (calcula el impacto y lo añade a la ficha). Hasta que se aprueba en la fase 5, la ficha es un **borrador**.

---

## Dependencias entre procesos

Los procesos no viven aislados: un pedido dispara su despacho, un ingreso de mercadería alimenta la bodega, una alerta de seguridad puede generar una orden de mantenimiento. Se declara en **Configurar empresa → Procesos → Dependencias con otros procesos**, desde el proceso que depende:

| Campo | Qué significa |
|---|---|
| **Depende de** | El proceso de origen |
| **Tipo** | **Dispara**: cuando el origen termina la etapa indicada, **nace un caso** en este proceso (se simula). **Requiere**: necesita su resultado, pero no se crea nada (informativa) |
| **¿En qué momento?** | Al terminar una etapa del origen, o cuando se completa un caso |
| **Casos que lo disparan** | Solo en «dispara»: 100 % = cada caso genera uno; 25 % = uno de cada cuatro |
| **Nota** | Por qué existe la dependencia |

Dónde se ve:

- **Configuración**: bajo cada proceso, un resumen en lenguaje natural («Nace de Alerta de seguridad al terminar Reportar, en el 25 % de los casos») y un mapa con el proceso resaltado.
- **Proceso → 🔗 Dependencias**: el mapa completo (columnas según de quién dependen; flecha continua = dispara, discontinua = requiere), con clic para resaltar un proceso, y la lista de lo que necesita y dispara. En la lista de procesos aparece 🔗 n.
- **Diagrama As-Is** (fase 3): bajo la etapa que dispara a otro proceso aparece «⇢ Orden de mantenimiento 25 %», y bajo la primera etapa «⇠ nace de …».
- **Ficha de proceso**: línea «Dependencias con otros procesos» en el apartado 2.
- **Plano**: los casos disparados nacen en la primera etapa del proceso dependiente. Cada uno guarda de qué caso vino.

Reglas: un proceso no puede depender de sí mismo, y los procesos que se **disparan** unos a otros no pueden formar un ciclo (se crearían casos sin fin). Los «requiere» sí pueden formar ciclos. Las llegadas propias del proceso dependiente (**Cada cuánto llegan casos nuevos**) se **suman** a las que dispara el origen: ponle una tasa baja si casi todo viene de la dependencia.

Si borras una etapa o un proceso, las dependencias que lo apuntaban se limpian solas. En las variantes de la optimización, si se elimina la etapa que disparaba a otro proceso, ese proceso pasa a dispararse cuando se completa el caso.

## Procedimientos

Cada etapa del proceso puede tener sus **procedimientos** (el cómo, quién y cuándo): ver [procedimientos.md](procedimientos.md). Se trabajan en la pestaña **3 · Procedimientos** y aparecen en la ficha del proceso y en el diagrama As-Is.

---

## Qué falta (todavía)

- Que las etapas del diagrama se puedan arrastrar o editar directamente sobre él.
- Registrar *quién* hizo cada cambio y *cuándo* (hoy solo hay fechas de cierre de fase y de paso).
- Comparar versiones de la ficha entre sí.
- Medir costos (hoy solo tiempo, espera, casos cerrados y plazos).
- El paso 1 no verifica que «quién lo pidió» sea realmente una persona: confía en lo que escribas.
