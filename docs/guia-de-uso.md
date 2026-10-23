# Office-Pixel — Guía de uso

Office-Pixel simula una **empresa virtual**: tú defines sus áreas, equipos, personas y procesos, y la app los muestra como un edificio donde la gente trabaja, camina y se pasa casos de una mesa a otra.

Esta guía tiene dos partes:

1. [Cómo se dibujan las áreas y los empleados](#1-cómo-se-dibujan-las-áreas-y-los-empleados)
2. [Cómo se configura todo, paso a paso](#2-cómo-se-configura-todo-paso-a-paso)

Para abrir la app: `npm run dev` y entra en <http://localhost:5173>.

---

## 1. Cómo se dibujan las áreas y los empleados

No dibujas nada a mano. **El edificio se genera solo** a partir de lo que configuras. La regla es siempre la misma:

| Lo que configuras | Lo que ves |
|---|---|
| Un **área** (primer nivel del organigrama) | Una **planta** del edificio |
| Un **equipo** (subárea) con personas | Una **sala** dentro de esa planta |
| Una **persona** | Un **escritorio** con su avatar |
| Un **caso** (solicitud, reclamo…) | Una **caja** de color |

### 1.1 Plantas

- Hay **una planta por área**, apiladas de arriba (la primera área) hacia abajo.
- **Un área sin ninguna persona no se dibuja.** Para que aparezca, tiene que haber al menos una persona en ella o en alguno de sus equipos.
- A la izquierda hay una **escalera** que conecta todas las plantas. Abajo del todo está la **ENTRADA**: por ahí llegan las personas y los casos nuevos.
- Cada planta tiene un color distinto. Ese color se usa en las cabeceras de sus salas y en la ropa de sus avatares, para reconocer de qué área es cada persona.
- Si pulsas los botones **P1, P2…** sobre el edificio, la cámara se acerca a esa planta. **Todo** o **Vista general** vuelve a encuadrar todo.

### 1.2 Salas

- Se dibuja **una sala por cada equipo que tenga personas sentadas**, de izquierda a derecha en el orden del organigrama.
- Si un área tiene personas directamente (por ejemplo, su responsable) y además equipos, el área tiene su propia sala y los equipos tienen las suyas.
- Al final de cada planta hay una **Sala común** (con sofá y mesa). Allí van las personas durante pausas y reuniones.
- Debajo de las salas corre el **pasillo**. Cada sala tiene una **puerta** hacia el pasillo.
- La cabecera de cada sala muestra:
  - el nombre del equipo,
  - `presentes/total · cN`: cuántas personas están en su sitio sobre el total del equipo, y cuántos casos hay en cola (`c` = cola).
- A la derecha de cada sala está la **bandeja de entrada**: aquí esperan los casos que aún nadie ha tomado.

### 1.3 Escritorios y personas

- Cada persona tiene **su escritorio** (con monitor, teclado y silla) en la sala de su equipo.
- Los escritorios se reparten en una cuadrícula: hasta 4 por fila, en el mismo orden en que las personas aparecen en la lista de **Personas**.
- El avatar tiene el color del área, y su cara y pelo varían de una persona a otra para distinguirlas. Bajo el avatar aparece su nombre de pila cuando haces zoom.
- Al alejar la cámara, los iconos crecen para seguir siendo legibles. Si te alejas mucho, se ocultan y cada sala muestra un número grande con su cola.

### 1.4 Qué hace cada avatar según su estado

| Estado | Qué se ve |
|---|---|
| **Libre** (en jornada, sin caso) | Sentado en su escritorio, punto gris sobre la cabeza |
| **Trabajando** | Sentado, con la caja del caso sobre su escritorio, punto azul |
| **En pausa** (almuerzo, descanso) | Camina a la sala común y se queda allí con la etiqueta «pausa» |
| **En reunión** | Va a la sala común con la etiqueta «reunión» |
| **Ausente** | Su avatar aparece semitransparente en su silla, con la etiqueta «ausente» |
| **Fuera de jornada** | No está en el edificio: sale por la entrada al terminar su turno y vuelve al empezar |

Para ir de un sitio a otro, los avatares **salen por la puerta, recorren el pasillo y suben o bajan por la escalera** si hace falta. Mientras caminan, el punto de estado desaparece.

Haz **clic en un avatar** (o en una fila de la lista «Personas») para ver su ficha: estado actual, caso que trabaja, utilización, tareas hechas y una barra con su día (de 6 a 22 h).

### 1.5 Cajas (casos)

- Los casos nuevos **entran por la entrada**, suben hasta la sala de su primera etapa y esperan en la **bandeja**.
- Cuando alguien lo toma, la caja se posa en su escritorio.
- Cuando el caso pasa a otro equipo, **la caja viaja** por el pasillo hasta la bandeja de la sala siguiente.
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

Si la bandeja se llena, aparece `+N` con los casos que no caben. En el panel inferior, la **utilización por unidad** pinta en ámbar (más de 70 %) y en rojo (más de 85 %) los equipos más saturados.

### 1.7 Noche y controles

- Entre las 18:00 y las 21:00 el edificio se va oscureciendo, y de 21:00 a 06:00 está a oscuras. Se aclara de 6:00 a 8:00.
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

- **Cargar ejemplo**: carga *Banco Pixel* (32 personas, 5 áreas, 2 procesos). Útil para ver cómo se ve una empresa completa.
- **Empezar en blanco**: una empresa mínima (1 área, 1 equipo, 2 personas, 1 proceso) que ya es válida y puedes ir ampliando.

Ambas te piden confirmar porque **reemplazan lo que haya en el formulario**.

### Paso 1 — Pestaña «Empresa»

1. **Nombre de la empresa.**
2. **Jornada:** hora de entrada y de salida.
3. **Días laborables:** pulsa las letras (L M X J V S D) para activarlas o apagarlas.
4. **Pausas:** el almuerzo u otros descansos. Pulsa **+ Añadir pausa** para otra. Quien está en pausa no trabaja.
5. **Ausentismo diario:** probabilidad de que cada persona falte un día cualquiera (por ejemplo, 3 %).
6. **Traslado de casos:** cuántos minutos tarda un caso en llegar a otro lugar:
   - dentro del mismo equipo,
   - entre equipos de una misma área,
   - entre áreas distintas.

> Las llegadas de casos, los plazos (SLA) y los tiempos de ciclo se cuentan solo en **horas hábiles** (dentro de la jornada y en días laborables).

### Paso 2 — Pestaña «Áreas y equipos»

1. Pulsa **+ Añadir área**. Cada área será una planta. Escribe su nombre y, si quieres, elige un **responsable**.
2. Dentro de cada área pulsa **+ Añadir equipo**. Cada equipo será una sala. Escribe su nombre.
3. A cada equipo se le muestra cuántas personas tiene (`N personas`) y puede tener su propio responsable.
4. Para borrar, usa la papelera (área) o la ✕ (equipo). **No te deja borrar** una unidad que aún tenga personas, etapas de procesos o reuniones: te avisa con un mensaje y tienes que moverlas o borrarlas antes.

> El «responsable» es solo informativo: no cambia cómo se asigna el trabajo.

### Paso 3 — Pestaña «Personas»

Una fila por persona. Pulsa **+ Añadir persona** (se añade al equipo que tengas filtrado arriba, en «Mostrar»).

| Columna | Qué significa |
|---|---|
| **Nombre** | Cómo se muestra en el edificio |
| **Equipo** | En qué sala se sienta |
| **Rol** | Lo que piden las etapas de los procesos (por ejemplo `analista`, `vendedor`). Al escribir, te sugiere los roles ya existentes |
| **Jefe** | Informativo |
| **Veloc.** | `1` = normal; `1,2` = 20 % más rápido; `0,8` = 20 % más lento |
| **Errores** | % de tareas que hay que rehacer. Si falla, el caso vuelve a la misma etapa |
| **Ausent.** | Ausentismo propio. Vacío = usa el general de la pestaña Empresa |
| **Horario** | «Horario general» o uno de los turnos que crees en la pestaña Horarios |
| **Habilidades** | Opcional, separadas por coma. Se usa si una etapa pide una habilidad concreta (solo desde el YAML) |

> **Lo importante:** una persona puede tomar una etapa si está en el equipo que pide la etapa **y** tiene el rol que pide. Si pones un rol distinto, esa persona no hará esa etapa.

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
2. **Equipo que la hace** y **Rol de quien la hace.** Solo se ofrecen los roles que existen en ese equipo.
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

  Para usar condiciones necesitas haber creado antes un *dato de cada caso* (4.2). Si una condición viene de un YAML con `&&` o `||`, se muestra como texto editable.

#### 4.5 Excepciones

Dentro de una etapa con trabajo, **+ Añadir excepción** crea algo que puede salir mal al terminarla:

| Campo | Qué es |
|---|---|
| **Qué pasa** | Una descripción (por ejemplo, «documento ilegible») |
| **Probabilidad** | % de casos a los que les ocurre |
| **El caso pasa a** | La etapa a la que salta (puede ser una anterior, para repetir, o una de cierre, para un rechazo) |
| **Demora** | Minutos extra antes de llegar allí |

Se evalúan en orden al terminar la etapa; si ninguna se dispara, el caso sigue su camino normal.

Hay otros tres «imprevistos» que no se configuran aquí:
- el **error humano** de cada persona (pestaña Personas),
- el **ausentismo** (pestaña Empresa o Personas),
- los **plazos (SLA)** de cada etapa.

### Paso 5 — Pestaña «Horarios y reuniones»

Tres bloques, todos opcionales:

1. **Horarios especiales (turnos):** pulsa **+ Añadir horario**, ponle un nombre (por ejemplo `turno_tarde`), su entrada, salida y pausas. Después, asígnalo a las personas en la pestaña Personas (columna Horario).
2. **Reuniones recurrentes:** nombre, equipo, hora de inicio, duración y días. Bloquea a **todo el equipo y sus subequipos** mientras dura (van a la sala común). Si dejas los días vacíos, se repite todos los días laborables.
3. **Ausencias planificadas:** elige una persona y escribe los días en que falta, separados por coma. El **día 0 es el primer lunes** de la simulación, el 1 es el martes, etc.

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
| **Utilización por unidad** | Cuánto trabajan los equipos: verde, ámbar > 70 %, rojo > 85 % |
| **Personas** | Todas, ordenadas por utilización. Clic para ver su ficha |
| **Ficha** | Estado, caso, utilización y su día |

> Todos los tiempos de ciclo y espera están en **horas hábiles**.

### Paso 8 — Itera

El uso típico es: simular, encontrar el cuello de botella (la sala roja, el equipo al 90 %), **cambiar algo** y comparar.

1. Abre ⚙ Configurar empresa.
2. Cambia una cosa (por ejemplo, añade una persona al equipo saturado, sube su velocidad, o reduce la probabilidad de una excepción).
3. **Aplicar y simular** con la **misma semilla** que antes para que la comparación sea justa.
4. Compara los resultados.

### Guardar, copiar y compartir (YAML)

La pestaña **YAML (avanzado)** muestra exactamente lo mismo que los formularios, como texto:

- **Descargar .yaml** para guardar o compartir la empresa.
- **Abrir archivo…** o pegar un YAML y pulsar **Cargar en los formularios**.
- Algunas opciones solo existen en el YAML, como las *habilidades requeridas por una etapa* (`skill`).

---

## Problemas frecuentes

| Mensaje | Qué hacer |
|---|---|
| `people: debe haber al menos una persona` | Añade una persona en la pestaña Personas |
| `etapa "x": nadie en "y" cumple role/skill` | Ninguna persona del equipo de esa etapa tiene el rol que pide. Cambia el rol de la etapa o el de alguna persona |
| `etapa "x": falta "next"` | La etapa no tiene siguiente. Elige a dónde va, o márcala como final |
| `la etapa "x" no existe` | Una etapa, excepción o condición apunta a una etapa que borraste. Elige otra |
| `Aún tiene N persona(s)…` (al borrar) | Mueve o borra primero lo que usa esa área o equipo |
| `Primero añade un «Dato de cada caso»` | Para usar condiciones hay que crear antes un dato (paso 4.2) |
| Un área no aparece en el edificio | No tiene personas ni en ella ni en sus equipos |
| Un equipo cuya cola crece sin parar | Faltan personas con el rol correcto, o van más lentas que la llegada de casos |

## Qué no se puede configurar (todavía)

- Prioridades entre casos, ni asignar a alguien concreto.
- Que una persona tenga varios roles o trabaje en dos casos a la vez.
- Picos de demanda, bajas o contrataciones a mitad de la simulación.
- Ausencias por horas (solo días completos).
- Costos por persona o por etapa.
- Deshacer en los formularios.
- Editar el organigrama o el flujo arrastrando y soltando.
