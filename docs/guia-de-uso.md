# Office-Pixel — Guía de uso

Office-Pixel simula una **empresa virtual**: tú defines su estructura (planta, áreas, subáreas y las personas de cada una) y sus procesos, y la app los muestra como un plano donde la gente trabaja, camina y se pasa casos de una mesa a otra.

> Los procesos se **documentan, optimizan y fichan** en el espacio **📋 Procesos**: ver [gestion-de-procesos.md](gestion-de-procesos.md).

Esta guía tiene dos partes:

1. [Cómo se dibujan la planta, las áreas, las subáreas y las personas](#1-cómo-se-dibuja-la-empresa)
2. [Cómo se configura todo, paso a paso](#2-cómo-se-configura-todo-paso-a-paso)

Para abrir la app: `npm run dev` y entra en <http://localhost:5173>.

---

## 1. Cómo se dibuja la empresa

No dibujas nada a mano: **el plano se genera solo** a partir de lo que configuras.

### 1.1 La estructura

```
Planta (o empresa)                  ← una sola, con el nombre de tu empresa
 └─ Área                            ← 1 o varias, cada una con su nombre
     ├─ Responsables y colaboradores del área
     └─ Subárea                     ← 0 o varias dentro de cada área, cada una con su nombre
         └─ Responsables y colaboradores de la subárea
```

- **Cada área y cada subárea tiene su propio nombre.**
- **Cada área y cada subárea puede tener uno o varios responsables y uno o varios colaboradores.** (También pueden no tener ninguno todavía.)
- Una persona pertenece a **una** unidad (un área o una subárea) y es **responsable** o **colaborador** de ella.

### 1.2 Qué se ve para cada nivel

| Lo que configuras | Lo que ves |
|---|---|
| La **planta** (empresa) | Un contorno grande que contiene todo, con el letrero **PLANTA · nombre de la empresa** |
| Un **área** | Una zona con el color del área y el rótulo **ÁREA · nombre** |
| Las **personas del área** | Una sala con la cabecera en el color pleno del área, con el nombre del área |
| Una **subárea** | Una sala dentro del área, con su propio nombre y la cabecera en tono más apagado y una franja de color a la izquierda |
| Una **persona** | Un escritorio con su avatar |
| Un **responsable** | Se sienta **primero** en su sala, con una **placa dorada** en el escritorio, un hombro y una insignia doradas en el avatar, y una ★ delante de su nombre |
| Un **colaborador** | Escritorio y avatar normales, después de los responsables |
| Un **caso** (solicitud, reclamo…) | Una caja de color |

Detalles:

- Un área solo tiene **sala propia** si tiene personas asignadas directamente al área (por ejemplo, su responsable) o si no tiene subáreas. Si todas sus personas están en subáreas, el área se ve como la zona que agrupa a sus subáreas.
- **Las áreas y subáreas vacías también se dibujan**, con el aviso «Sin personas aún», para que veas la estructura mientras la armas.
- Las subáreas anidadas (una subárea dentro de otra) muestran su camino: `Subárea › Sub-subárea`.
- Cada sala tiene su **puerta**, su **bandeja de entrada** (a la derecha: aquí esperan los casos que nadie ha tomado) y una cabecera con `presentes/total · cN` (personas en su sitio sobre el total, y casos en cola).
- Cada área tiene además una **Sala común** (con sofá y mesa) donde van las personas en las pausas y reuniones.
- Los escritorios se reparten en cuadrícula, hasta 4 por fila: primero los responsables y luego los colaboradores, en el orden de la lista.

### 1.3 Disposición de las áreas: vertical u horizontal

El selector **▤ Vertical / ▥ Horizontal** de la barra superior cambia cómo se colocan las áreas dentro de la planta. Puedes alternar en cualquier momento: la simulación sigue en el mismo instante y la persona seleccionada se mantiene. La opción se recuerda al recargar.

| | **Vertical** (por defecto) | **Horizontal** |
|---|---|---|
| Áreas | Apiladas de arriba abajo | En fila, de izquierda a derecha |
| Cada área | Una franja: salas en fila y su pasillo debajo | Una columna: salas apiladas y su pasillo a la izquierda |
| Pasillo principal (une las áreas) | Vertical, a la izquierda | Horizontal, arriba |
| Entrada | Abajo del todo, junto al pasillo principal | A la izquierda del pasillo principal |
| Puertas de las salas | En el borde inferior | En el borde izquierdo |
| Va mejor en | Ventanas altas o estrechas | Pantallas anchas |

Los botones con el nombre de cada área, sobre el plano, acercan la cámara a esa área. **Planta completa** (o **Vista general**) encuadra todo.

### 1.4 Qué hace cada avatar según su estado

| Estado | Qué se ve |
|---|---|
| **Libre** (en jornada, sin caso) | Sentado en su escritorio, punto gris sobre la cabeza |
| **Trabajando** | Sentado, con la caja del caso sobre su escritorio, punto azul |
| **En pausa** (almuerzo, descanso) | Camina a la sala común de su área y se queda allí con la etiqueta «pausa» |
| **En reunión** | Va a la sala común con la etiqueta «reunión» |
| **Ausente** | Su avatar aparece semitransparente en su silla, con la etiqueta «ausente» |
| **Fuera de jornada** | No está en el plano: sale por la entrada al terminar su turno y vuelve al empezar |

Para ir de un sitio a otro, los avatares **salen por la puerta de su sala, recorren el pasillo del área y el pasillo principal** si cambian de área, y entran por la puerta de la sala de destino.

Haz **clic en un avatar** (o en una fila de la lista «Personas») para ver su ficha: si es responsable o colaborador, su área › subárea, estado actual, caso que trabaja, utilización, tareas hechas y una barra con su día (de 6 a 22 h).

### 1.5 Cajas (casos)

- Los casos nuevos **entran por la entrada**, van hasta la sala de su primera etapa y esperan en la **bandeja**.
- Cuando alguien lo toma, la caja se posa en su escritorio.
- Cuando el caso pasa a otra sala, **la caja viaja** por los pasillos hasta la bandeja de la sala siguiente.
- El color de la caja indica el proceso (el primer proceso es ámbar, el segundo rosa, el tercero celeste…).
- Una caja semitransparente está **pausada** (la persona se fue a almorzar o terminó su jornada con el caso a medias).
- Una **insignia roja parpadeante** en la caja indica que ese caso ya rompió su plazo (SLA).
- Cuando un caso se cierra, desaparece.

### 1.6 Cuellos de botella

Cada sala mide su **carga** como `casos en cola ÷ (personas × 1,5)`:

| Carga | Qué ves |
|---|---|
| Menos de 70 % | Barra verde, sin color en la sala |
| 70 % a 100 % | Barra ámbar y la sala se tiñe de ámbar |
| Más de 100 % | Barra roja y la sala **parpadea en rojo** |

Si la bandeja se llena, aparece `+N`. En el panel inferior, la **utilización por unidad** pinta en ámbar (más de 70 %) y en rojo (más de 85 %) las unidades más saturadas.

### 1.7 Noche y controles

- Entre las 18:00 y las 21:00 el plano se va oscureciendo, y de 21:00 a 06:00 está a oscuras. Se aclara de 6:00 a 8:00.
- **Rueda del ratón:** acerca o aleja hacia donde apuntas. **Arrastrar:** mueve la vista.
- **Velocidad:** de 10 min/s hasta 12 h/s. A velocidades altas los avatares llegan a su sitio con algo de retraso visual; lo importante es el resultado.
- **Línea de tiempo:** arrastra para saltar a cualquier momento (también hacia atrás).

---

## 2. Cómo se configura todo, paso a paso

Toda la empresa se configura con formularios. Se abre con el botón **⚙ Configurar empresa**, arriba a la izquierda.

El panel tiene **6 pestañas** a la izquierda y, abajo, el estado de la configuración:

- **✔ Todo listo para simular** → puedes aplicar.
- **⚠ N problemas por resolver** → pulsa ahí para ver la lista. **Aplicar y simular** está bloqueado hasta resolverlos.

> Los identificadores internos se crean solos a partir de los nombres. No tienes que escribir códigos.
> Los cambios no se aplican hasta pulsar **Aplicar y simular**. **Cancelar** (o la tecla `Esc`) descarta todo.

### Paso 0 — Elige un punto de partida

Arriba a la derecha del panel:

- **Cargar ejemplo**: carga *Banco Pixel* (32 personas, 5 áreas, 2 procesos, con responsables en áreas y subáreas).
- **Empezar en blanco**: una empresa mínima (1 área con 1 subárea, 2 personas y 1 proceso) que ya es válida y puedes ir ampliando.

Ambas te piden confirmar porque **reemplazan lo que haya en el formulario**.

### Paso 1 — Pestaña «Empresa» (la planta)

1. **Nombre de la planta o empresa.**
2. **Jornada:** hora de entrada y de salida.
3. **Días laborables:** pulsa las letras (L M X J V S D) para activarlas o apagarlas.
4. **Pausas:** el almuerzo u otros descansos. Pulsa **+ Añadir pausa** para otra. Quien está en pausa no trabaja.
5. **Ausentismo diario:** probabilidad de que cada persona falte un día cualquiera (por ejemplo, 3 %).
6. **Traslado de casos:** cuántos minutos tarda un caso en llegar a otro lugar:
   - dentro de la misma subárea,
   - entre subáreas de una misma área,
   - entre áreas distintas.

> Las llegadas de casos, los plazos (SLA) y los tiempos de ciclo se cuentan solo en **horas hábiles** (dentro de la jornada y en días laborables).

### Paso 2 — Pestaña «Áreas y subáreas»

Aquí armas la estructura y, en cada área y subárea, a sus responsables y colaboradores.

1. Arriba ves la **Planta / empresa** (su nombre).
2. Pulsa **+ Añadir área**. Escribe su **nombre**.
3. Dentro del área hay dos columnas:
   - **Responsables:** pulsa **+ Responsable** para añadir uno. Aparece un campo con el nombre: escríbelo. Repite para tener varios.
   - **Colaboradores:** igual con **+ Colaborador**.
4. En cada persona, el botón **⇄** la pasa de responsable a colaborador (y al revés) y la **✕** la borra.
5. Para crear una **subárea**, pulsa **+ Añadir subárea** dentro del área. Tiene su propio nombre y sus propias columnas de responsables y colaboradores.
6. Para borrar, usa la papelera (área) o la ✕ (subárea). **No te deja borrar** una unidad que aún tenga personas, etapas de procesos o reuniones: te avisa y tienes que moverlas o borrarlas antes.

> Las personas que creas aquí tienen un rol y valores por defecto. Para ajustar su rol, velocidad, errores, etc., ve a la pestaña **Personas**.

### Paso 3 — Pestaña «Personas»

Una fila por persona (la misma que creaste en el paso 2, con todos sus detalles). Pulsa **+ Añadir persona** (se añade a la unidad que tengas filtrada arriba, en «Mostrar»).

| Columna | Qué significa |
|---|---|
| **Nombre** | Cómo se muestra en el plano |
| **Área / subárea** | Dónde se sienta |
| **Tipo** | **Responsable** (franja dorada en la tabla) o **Colaborador** |
| **Rol** | Lo que piden las etapas de los procesos (por ejemplo `analista`, `vendedor`). Al escribir, te sugiere los roles ya existentes |
| **Jefe** | Informativo |
| **Veloc.** | `1` = normal; `1,2` = 20 % más rápido; `0,8` = 20 % más lento |
| **Errores** | % de tareas que hay que rehacer. Si falla, el caso vuelve a la misma etapa |
| **Ausent.** | Ausentismo propio. Vacío = usa el general de la pestaña Empresa |
| **Horario** | «Horario general» o uno de los turnos definidos en el YAML (`schedules`) |
| **Habilidades** | Opcional, separadas por coma |

> **Lo importante:** una persona puede tomar una etapa si está en el área o subárea que pide la etapa **y** tiene el rol que pide. Ser responsable o colaborador **no cambia** quién puede hacer qué: solo cómo se ve y cómo se agrupa a las personas.

### Paso 4 — Pestaña «Procesos»

A la izquierda está la lista de procesos; a la derecha, el editor del proceso elegido. Para uno nuevo: **+ Nuevo proceso**.

#### 4.1 Datos generales y llegadas

1. **Nombre del proceso.**
2. **¿Cada cuánto llegan casos nuevos?** Elige:
   - *Al azar (promedio por hora)*: llegan de forma irregular, con un promedio de N casos por hora hábil. Es lo más realista.
   - *Regular*: llega uno cada X minutos.

#### 4.2 Datos de cada caso (opcional)

Son valores que lleva cada caso, como un **monto**. Sirven para decidir el camino (paso 4.4).

1. Pulsa **+ Añadir dato** y ponle nombre (sin espacios, por ejemplo `monto`).
2. Elige **cómo varía entre casos**: fija, normal (campana), con cola larga o exponencial, y sus valores. Para montos, la «cola larga» suele ser lo más natural: muchos casos pequeños y pocos grandes.

#### 4.3 Etapas

Cada etapa es una **tarjeta numerada**. El caso las recorre según el camino que definas.

Para cada etapa:

1. **Nombre.**
2. **Área / subárea que la hace** y **Rol de quien la hace.** Solo se ofrecen los roles que existen ahí.
3. **Cuánto tarda** (a velocidad normal): elige el tipo de variación y sus minutos. Por ejemplo: *normal, media 35 min, desviación 10 min*.
4. **Plazo máximo (SLA):** en horas hábiles, desde que el caso llega a la etapa. Vacío = sin plazo. Si se supera, el caso se marca en rojo y cuenta como incumplido.
5. Con ↑ ↓ cambias el orden y con la papelera borras la etapa.

**+ Añadir etapa** la inserta antes del cierre y la engancha en el camino.

**Etapa final:** marca «Es el final del proceso» en la que cierra el caso. Una etapa final puede:
- no requerir trabajo (cierre inmediato, como «Rechazada»), o
- exigir que alguien trabaje antes de cerrar (marca «Alguien debe trabajar antes de cerrar»).

Un proceso necesita **al menos dos etapas** y **una final**.

#### 4.4 ¿A dónde va después? (el camino)

Para cada etapa no final, elige:

- **Siempre a la misma etapa:** eliges cuál.
- **Según condiciones:** el caso va a un sitio u otro según sus datos. Cada condición se arma con selectores:

  > **Si** `monto` · `es mayor que` · `50000` → **entonces ir a** «Evaluación senior»

  Pulsa **+ Añadir condición** para más. Se evalúan **en orden** y gana la primera que se cumple; usa ↑ ↓ para ordenarlas. Siempre existe **«En cualquier otro caso, ir a…»** para los que no cumplen ninguna.

  Para usar condiciones necesitas haber creado antes un *dato de cada caso* (4.2).

#### 4.5 Excepciones

Dentro de una etapa con trabajo, **+ Añadir excepción** crea algo que puede salir mal al terminarla:

| Campo | Qué es |
|---|---|
| **Qué pasa** | Una descripción (por ejemplo, «documento ilegible») |
| **Probabilidad** | % de casos a los que les ocurre |
| **El caso pasa a** | La etapa a la que salta (puede ser una anterior, para repetir, o una de cierre, para un rechazo) |
| **Demora** | Minutos extra antes de llegar allí |

Se evalúan en orden al terminar la etapa; si ninguna se dispara, el caso sigue su camino normal.

Hay otros tres «imprevistos» que no se configuran aquí: el **error humano** de cada persona, el **ausentismo** y los **plazos (SLA)**.

### Paso 5 — Turnos, reuniones y ausencias (en el YAML)

El menú de configuración es: **Empresa** (con **Instalaciones** y **Áreas y subáreas**), **Personas**, **Procesos** y **YAML (avanzado)**. Los turnos, las reuniones y las ausencias planificadas ya no tienen pestaña propia: se editan en **YAML (avanzado)** (claves `schedules`, `meetings` y `scenario.absences`) y se siguen respetando al simular. Tres bloques, todos opcionales:

1. **Horarios especiales (turnos):** bajo `schedules`, un nombre (por ejemplo `turno_tarde`) con su entrada, salida y pausas. Después, asígnalo a las personas en la pestaña Personas (columna Horario).
2. **Reuniones recurrentes** (`meetings`): nombre, área o subárea, hora de inicio, duración y días. Bloquea a **todas las personas de esa unidad y de sus subáreas** mientras dura (van a la sala común). Si dejas los días vacíos, se repite todos los días laborables.
3. **Ausencias planificadas** (`scenario.absences`): una persona y los días en que falta. El **día 0 es el primer lunes** de la simulación, el 1 es el martes, etc.

### Paso 6 — Aplicar y simular

1. Revisa que abajo diga **✔ Todo listo para simular**.
2. Pulsa **Aplicar y simular**. El panel se cierra y la simulación empieza.
3. La empresa queda **guardada en tu navegador**: si recargas la página, vuelve a aparecer.

### Paso 7 — Ajusta la simulación y mira los resultados

En la barra superior:

- **▶ / ⏸**, **⟲ Reiniciar**, **Velocidad** y la **línea de tiempo.**
- **Días** (de 1 a 30) y **Semilla:** con la misma semilla y la misma configuración, la simulación sale **idéntica**; cambia la semilla para ver otra variante. Pulsa **↻ Simular** para repetirla.

En el panel de abajo (la simulación completa ya está calculada):

| Panel | Qué cuenta |
|---|---|
| **Resultado** | Casos cerrados / creados por proceso, ciclo medio y P90 (el tiempo que tardan 9 de cada 10 casos), plazos incumplidos y las etapas con mayor espera |
| **Utilización por unidad** | Cuánto trabajan las áreas y subáreas: verde, ámbar > 70 %, rojo > 85 % |
| **Personas** | Todas, ordenadas por utilización. Clic para ver su ficha |
| **Ficha** | Responsable o colaborador, su área › subárea, estado, caso, utilización y su día |

> Todos los tiempos de ciclo y espera están en **horas hábiles**.

### Paso 8 — Itera

El uso típico es: simular, encontrar el cuello de botella (la sala roja, la unidad al 90 %), **cambiar algo** y comparar.

1. Abre ⚙ Configurar empresa.
2. Cambia una cosa (por ejemplo, añade un colaborador a la subárea saturada, sube su velocidad, o reduce la probabilidad de una excepción).
3. **Aplicar y simular** con la **misma semilla** que antes para que la comparación sea justa.
4. Compara los resultados.

### Guardar, copiar y compartir (YAML)

La pestaña **YAML (avanzado)** muestra exactamente lo mismo que los formularios, como texto:

- **Descargar .yaml** para guardar o compartir la empresa.
- **Abrir archivo…** o pegar un YAML y pulsar **Cargar en los formularios**.
- En el YAML, cada persona tiene `kind: responsable` o `kind: colaborador` (sin `kind` es colaborador). El formato antiguo con `head:` en una unidad se convierte solo al cargarlo: esa persona pasa a ser responsable.

---

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| `people: debe haber al menos una persona` | Añade una persona en «Áreas y subáreas» o en «Personas» |
| `etapa "x": nadie en "y" cumple role/skill` | Ninguna persona de esa área o subárea tiene el rol que pide. Cambia el rol de la etapa o el de alguna persona |
| `etapa "x": falta "next"` | La etapa no tiene siguiente. Elige a dónde va, o márcala como final |
| `la etapa "x" no existe` | Una etapa, excepción o condición apunta a una etapa que borraste. Elige otra |
| `Aún tiene N persona(s)…` (al borrar) | Mueve o borra primero lo que usa esa área o subárea |
| `Primero añade un «Dato de cada caso»` | Para usar condiciones hay que crear antes un dato (paso 4.2) |
| Una sala dice «Sin personas aún» | Añade responsables o colaboradores a esa área o subárea |
| Una subárea cuya cola crece sin parar | Faltan personas con el rol correcto, o van más lentas que la llegada de casos |

## Qué no se puede configurar (todavía)

- **Varias plantas** (por ejemplo, varias sedes): hoy hay una sola planta por empresa.
- Que ser responsable dé poderes: no asigna trabajo ni toma decisiones, solo organiza y distingue a las personas.
- Prioridades entre casos, ni asignar a alguien concreto.
- Que una persona tenga varios roles o trabaje en dos casos a la vez.
- Picos de demanda, bajas o contrataciones a mitad de la simulación.
- Ausencias por horas (solo días completos).
- Costos por persona o por etapa.
- Deshacer en los formularios.
- Editar la estructura arrastrando y soltando.

---

## Empezar de cero para probar tu propia empresa

En la barra superior, **🧹 Limpiar todo**:

1. Pide confirmación (borra **todo** lo guardado en este navegador: empresa, áreas, personas, procesos, procedimientos con sus capturas, fases de documentación, optimización y preferencias de vista).
2. Ofrece **descargar antes una copia .yaml** de la empresa actual.
3. Deja una empresa en blanco con lo mínimo que el simulador exige (1 área con 1 subárea, 2 personas y 1 proceso de 2 etapas: «Mi empresa»). Renómbralo o bórralo desde **⚙ Configurar empresa**.

Alternativas: **Configurar empresa → Empezar en blanco** (solo reemplaza el formulario hasta que pulses *Aplicar y simular*) o **YAML (avanzado) → importar** un archivo tuyo. Para volver a un ejemplo, **Cargar plantilla…**.

---

## Quitar un área que la empresa ya no usa

En **Configurar empresa → Áreas y subáreas**, el botón 🗑 de un área o subárea:

- Si está **vacía**, se borra directamente.
- Si todavía tiene **personas, etapas de proceso o reuniones**, se abre un asistente que muestra qué hay dentro y te deja elegir:
  1. **Mover todo a otra área**: sus personas, etapas y reuniones pasan a la área que elijas. La empresa sigue funcionando igual; solo cambian de sala.
  2. **Eliminar el área con todo su contenido**: se borran sus personas y reuniones, y se quitan las etapas que la usan. El asistente lista el efecto en cada una:
     - una etapa intermedia se elimina y el flujo se **reconecta** con la siguiente;
     - si era la **primera etapa**, la siguiente pasa a ser la entrada del proceso;
     - si era un **cierre**, queda como cierre sin área;
     - un **proceso que se queda sin ninguna etapa de trabajo se borra** (el asistente lo avisa).

Las subáreas se van con su área. Los procedimientos de una etapa eliminada se conservan, pero quedan sin etapa asociada; las dependencias entre procesos y los requisitos que apuntaban a lo borrado se limpian solos.

Los cambios se aplican al formulario; no se guardan hasta **Aplicar y simular**. Si te equivocas, cierra con la ✕ sin aplicar y vuelves a la empresa anterior.

---

## Ordenar las áreas (y subáreas)

El **orden de las tarjetas** en **Configurar empresa → Empresa → Áreas y subáreas** es el orden en el plano: en vertical, la primera va **arriba**; en horizontal, a la **izquierda**. Dentro de un área, las subáreas siguen su propio orden (de izquierda a derecha en vertical, de arriba a abajo en horizontal). También ordena los botones de área sobre el plano.

Cada tarjeta (con dos o más hermanas) tiene cuatro botones: **⤒** primera, **▲** subir, **▼** bajar y **⤓** última. Las áreas dicen «Área 2 de 4». Los botones se desactivan en los extremos. Las subáreas se mueven entre las de su misma área; para pasar una subárea a otra área, bórrala y créala allí (o usa **Quitar área → Mover** si es una área entera).

El orden se guarda con la empresa (es el orden de `units` en el YAML) y no cambia la simulación ni las personas.

---

## Dos modos de ver la simulación: «Cómo funciona» y «Semana completa»

El selector **Modo** de la barra superior cambia el propósito de la simulación:

| | 🎓 **Cómo funciona** (por defecto) | 📅 **Semana completa** |
|---|---|---|
| Para qué | **Entender el proceso**: quién hace qué, en qué orden y a dónde va el caso | **Medir**: cuellos de botella, tiempos de ciclo y utilización con la carga real |
| Casos | Una **muestra**: como máximo 4 casos por día en cada proceso | Los que configuraste (llegadas por hora) |
| Duración | 2 días | 5 días |
| Ritmo | **2 min/s**, y se **salta el tiempo muerto** (noches, esperas sin trabajo en marcha) | 30 min/s |
| Relato | Panel **📖 Qué está pasando** con frases como «Sofía Luna empieza “Captura de solicitud”» | Sin relato |
| Arranque | **En pausa**: pulsa ▶ o **⏭ Siguiente paso** | Reproduce solo |

**⏭ Siguiente paso** avanza hasta el siguiente hecho (llega un caso, alguien empieza o termina, el caso viaja a otra área, hay una excepción…) y se detiene, para ir viendo el flujo hecho por hecho. Con ▶ corre solo, pero despacio. En **Velocidad** hay ahora **1 min/s**, 2, 5 y 10 min/s además de las rápidas.

El relato cuenta: llegadas de casos, a qué etapa y área pasa cada uno, quién lo toma y quién lo termina, traspasos entre áreas (con minutos de viaje), errores y reprocesos, excepciones, plazos vencidos, pausas, reuniones y ausencias. **Limpiar** borra el relato; ▾ lo pliega.

Cambiar de modo **vuelve a simular** (cambia los días y la carga). Los resultados de abajo en modo «Cómo funciona» son de la **muestra**, no de la carga real: para medir tiempos y cuellos de botella usa «Semana completa». El modo se recuerda en el navegador.

Al seguir un proceso con dependencias, el caso nuevo que nace en otro proceso se cuenta con su origen («Nace porque terminó…»). Las llegadas que provienen de una dependencia «dispara» no se limitan: dependen de los casos del proceso de origen.
