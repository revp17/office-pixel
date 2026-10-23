# Procedimientos asociados a los procesos

Un **procedimiento** baja de la visión macro del proceso a la visión micro de la ejecución: describe **cómo, quién y cuándo** se hace una etapa con tanta claridad que **cualquier persona capacitada de la empresa pueda ejecutarla sin cometer errores**.

| Elemento | Enfoque | Responde a | Formato común |
|---|---|---|---|
| **Proceso** | Estratégico / macro | ¿Qué se hace? y ¿Para qué? | Diagrama de flujo (departamentos) |
| **Procedimiento** | Táctico / micro | ¿Cómo se hace? y ¿Quién lo hace? | Documento narrativo + capturas de pantalla |

Cada procedimiento está **asociado a una etapa de un proceso**. Se trabaja en **📋 Procesos → 3 · Procedimientos**.

---

## La pantalla de procedimientos

- **¿Proceso o procedimiento?** (desplegable): la tabla de arriba, siempre a mano.
- **Cobertura**: una fila por cada etapa con trabajo, con cuántos procedimientos tiene y cuántos están **publicados**. El botón **+ Crear** abre un procedimiento ya asociado a esa etapa.
- **Procedimientos de este proceso**: una tarjeta por procedimiento, con su **código** (`PRO-SC-001`), etapa, pasos completados, y si es **Borrador** o **Publicado vX**.

Dentro de un procedimiento hay dos vistas: **Levantar (5 pasos)** y **Documento**.

---

## Levantar un procedimiento: 5 pasos

Cada paso tiene una **lista de comprobación**. Un paso solo se completa cuando su lista está completa y el anterior ya se completó; **Reabrir** un paso reabre también los posteriores y el procedimiento vuelve a ser borrador.

### Paso 1 · Entrevista de tarea a tarea y observación crítica

A diferencia del proceso general, aquí no te sientas con directores sino con los **operadores directos**.

- **Pide que lo ejecuten en vivo**: mira qué software usan, qué carpetas abren, qué herramientas manipulan. No te quedes solo con lo que dicen.
- **Identifica las excepciones**: «¿qué pasa si el sistema falla aquí?», «¿qué haces si el cliente no envía este dato?». Se registran en una lista de excepciones por cada levantamiento.
- **Registra los «trucos»**: conocimientos informales que no están en ningún manual.

Cada **registro** lleva operador, cómo se levantó (**observación en vivo** o **entrevista**), fecha, lo que hace y con qué herramienta, sus excepciones y sus trucos.

La lista exige: todos los registros indican su operador · al menos **una observación en vivo** · al menos **una excepción** · trucos registrados (o confirmar que no hay).

### Paso 2 · Estructurar el contenido (los 5 bloques)

1. **Objetivo y alcance**: objetivo, **empieza cuando…** y **termina cuando…** (más «incluye» y «no incluye», opcionales).
2. **Responsabilidades**: **puestos** (Analista de Compras, Gerente de Finanzas), **no nombres propios** (el sistema avisa si el puesto coincide con una persona de la empresa).
3. **Definiciones o glosario**: siglas, sistemas (SAP, CRM) y términos técnicos, o confirmar que no hace falta.
4. **Desarrollo paso a paso**: se redacta en el paso 3.
5. **Anexos y control de cambios**: enlaces a plantillas, formatos y capturas; el historial de versiones se llena solo al publicar.

**Requisitos previos (opcional)**, al inicio de este paso: marca los procedimientos —de este u otros procesos— que deben estar hechos o disponibles antes de ejecutar este (por ejemplo, «Control de acceso del camión» antes de «Descarga en el muelle»). Se muestra la cadena `requisito → este → quien lo necesita`, y se avisa si algún requisito sigue en borrador. No se permiten ciclos: un procedimiento que ya depende de este no puede ser su requisito.

### Paso 3 · Redactar en formato «acción-resultado»

Cada paso se escribe con campos separados: **[Actor]** + **[Acción]** + **[Herramienta o medio]** + **[Resultado esperado]**. El sistema compone la frase:

> Analista de Cuentas — Registrar la factura · Herramienta: módulo SAP ERP · Resultado: código de validación interna generado

La **revisión automática** de cada paso señala:

| Nivel | Qué detecta |
|---|---|
| ✖ Error | Falta el actor, la acción o el **resultado esperado** · el **actor es un nombre propio** · la acción **no empieza con un verbo** (infinitivo o imperativo: Ingresar, Verificar, Descargar, Aprobar…) |
| ⚠ Aviso | Parece haber **más de una acción** (una sola por paso) · frase larga (más de ~140 caracteres) |
| ℹ Info | No indica herramienta o medio |

La lista exige: hay pasos · todos con actor, acción y resultado · sin errores de redacción · **cada actor está en las responsabilidades** · y **todas las excepciones del levantamiento tienen su camino alternativo**.

**Caminos alternativos** (*«si… entonces…»*): cada paso puede tenerlos. Las excepciones del paso 1 que aún no están cubiertas aparecen en un recuadro amarillo con un selector **«Cubrir en el paso…»** que crea el camino alternativo en el paso elegido. Los procedimientos fallan si no documentan los caminos alternativos.

### Paso 4 · Incorporar ayudas visuales

El procedimiento no es solo texto:

- **Diagrama de flujo a nivel de tarea**: se dibuja solo con tus pasos, como una secuencia lineal. 🛑 / ⚠ marca los pasos con advertencia, 📷 los que tienen captura y ↳ los que tienen caminos alternativos.
- **Señales de advertencia**: por paso, una caja destacada de tipo **Alerta crítica**, **Riesgo financiero**, **Seguridad** o **Error común**, con su texto (por ejemplo, *«No avanzar sin la firma del director»*). O confirmar que no hay pasos críticos.
- **Capturas de pantalla anotadas** (si el procedimiento es **digital**): **Subir captura…** (se reduce y comprime automáticamente) y dibuja encima:
  - **◯ Círculo**: un clic.
  - **➜ Flecha**: arrastra.
  - **① Número**: un clic; numera solo.
  - **↶ Deshacer** y **Quitar marcas**. Cada captura lleva un pie.

La lista exige: el diagrama (hay pasos) · advertencias (o confirmar que no hay) · y, si es digital, **al menos una captura con marcas**.

### Paso 5 · Prueba de escritorio y validación cruzada

Antes de publicarlo como oficial:

- **La prueba del novato**: entrega el borrador a una persona del mismo departamento que **no** haga la tarea habitualmente. Se registran las pruebas (quién, fecha, si **completó la tarea**, cuántas **preguntas** hizo y qué falló). La prueba se **supera** si completó la tarea **sin hacer preguntas**; cuenta **la última**. Si falla: corrige los pasos y repite.
- **Firma del ejecutor**: cada operador que dio la información (los del paso 1) revisa el documento final y firma su **conformidad** (o deja observaciones). Deben firmar **todos**.

### Publicar

Con los 5 pasos completos, **Publicar versión 1.0** fija la versión y la fecha y la anota en el **control de cambios**. Para una nueva versión hay que **describir qué cambió** (la reabres, corriges y publicas la 1.1, 1.2…).

---

## El documento

La vista **Documento** reúne todo con los 6 apartados:

1. Objetivo y alcance · 2. Responsabilidades · 3. Definiciones y glosario · 4. Desarrollo paso a paso (con el diagrama, los pasos numerados, advertencias, caminos alternativos y capturas con sus marcas) · 5. Anexos y control de cambios (incluye los trucos recogidos) · 6. Validación (prueba del novato y conformidad del ejecutor).

| Botón | Para qué |
|---|---|
| **Descargar .html** | Documento autocontenido, **con las capturas y sus marcas** |
| **Imprimir / guardar en PDF** | Imprime solo el documento |
| **Descargar .md** | Solo el texto (las capturas se mencionan, no se incluyen) |
| **Copiar Markdown** | Al portapapeles |

---

## Cómo se conecta con el proceso

- Los **requisitos previos** y **lo que se necesita después** aparecen en el documento (apartado 1) y en **Proceso → 🔗 Dependencias → Procedimientos encadenados**, donde se avisa si hay procedimientos publicados con requisitos aún en borrador. Al borrar un procedimiento se quitan los requisitos que lo apuntaban.
- La **ficha del proceso** incluye la sección **Procedimientos asociados** (código, título, etapa, versión, estado, nº de pasos y la **cobertura**: cuántas etapas con trabajo tienen un procedimiento publicado).
- En el **diagrama As-Is** (fase 3 del ciclo de documentación), cada etapa con procedimiento lleva la marca **📄 n procedimiento(s)**.
- Los procedimientos viajan en el YAML de la empresa y **no afectan a la simulación**.
- Banco Pixel trae un ejemplo completo: `PRO-SC-001 · Cómo validar la identidad del solicitante (KYC)`, publicado v1.0.

---

## Límites actuales

- La revisión del verbo es una **heurística en español**: reconoce infinitivos (-ar, -er, -ir) y una lista de imperativos habituales; si una instrucción válida no se reconoce, se puede reformular con el infinitivo.
- La **firma** es un registro de conformidad (nombre, estado, fecha y comentario), **no una firma digital** con valor legal.
- Las capturas se guardan **dentro del documento** de la empresa (en el navegador): se comprimen, pero con muchas imágenes puede acercarse al límite de almacenamiento del navegador.
- Un procedimiento detalla **una etapa**; no hay todavía procedimientos que cubran varias etapas.
- No hay comparación visual entre versiones: el control de cambios es el historial escrito.
