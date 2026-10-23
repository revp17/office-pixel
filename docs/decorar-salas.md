# Decorar una sala: biblioteca de objetos

Cada área o subárea con sala propia se puede **amueblar** con objetos ya dibujados: puertas, ventanas, mesas, sillas, sofás, plantas, archivadores, estanterías, equipos, señales de seguridad y más. Se colocan con el ratón, como en un editor de planos.

Es solo decoración: **no cambia el tamaño de la sala ni la simulación**. Los escritorios de las personas se siguen generando solos (en el editor aparecen con sombra para que no pises su sitio).

## Abrirlo

**Configurar empresa → Empresa → Áreas y subáreas** → en el área o subárea, junto a «Tipo de instalación», el botón **🪑 Decorar sala**. Si el área no tiene sala propia (solo tiene subáreas con gente), decora sus subáreas.

## Usarlo

1. A la izquierda elige un **grupo** y un objeto. Queda «en la mano».
2. Haz **clic en la sala** para colocarlo; puedes colocar varios seguidos. **Esc** o **✋ Soltar** para dejar de colocar.
3. **Arrastra** un objeto para moverlo (se ajusta a una cuadrícula de 2 px y no sale de la sala).
4. Con un objeto seleccionado: **↻ Girar** (tecla **R**, de 90° en 90°), **⇋ Espejo**, **⧉ Duplicar**, **⤒ Al frente** / **⤓ Al fondo**, **🗑 Borrar** (tecla **Supr**). Las **flechas** lo mueven de a poco.
5. **Guardar sala** lo pasa al formulario; se aplica a la empresa con **Aplicar y simular**. **Cancelar** descarta los cambios; **Vaciar sala** quita todos los objetos.

## Catálogo (44 objetos)

| Grupo | Objetos |
|---|---|
| Muebles | escritorio, mesa, mesa redonda, mesa de reunión, mostrador, silla, sillón, sofá, banco |
| Almacenaje | archivador, estantería, librería, casilleros, caja, pallet con cajas, barril |
| Equipos | computador, impresora, rack de servidores, cafetera, dispensador de agua, refrigerador, pantalla/TV, pizarra |
| Estructura | puerta, puerta doble, ventana, pared, columna, escalera |
| Decoración | planta, planta grande, alfombra, cuadro, reloj, basurero |
| Logística y seguridad | extintor, salida de emergencia, cámara, torniquete, barrera, cono, banco de trabajo, camión |

Los objetos se dibujan encima del suelo, de los escritorios y de la ilustración del tipo de instalación, y por debajo de las personas y los casos. El orden entre ellos es el de colocación (puedes cambiarlo con *Al frente* / *Al fondo*).

## Cómo se guardan

En el YAML, dentro de cada unidad, como lista `decor` (máximo 300 objetos por sala):

```yaml
units:
  - id: bodega_central
    name: Bodega central
    decor:
      - { id: d_a1, k: estanteria, x: 60, y: 200, rot: 0 }
      - { id: d_a2, k: puerta, x: 138, y: 252, rot: 180 }
      - { id: d_a3, k: planta_grande, x: 20, y: 230, rot: 0, flip: true }
```

`x` e `y` son el **centro** del objeto, en píxeles desde la esquina superior izquierda de la sala. `rot` es 0, 90, 180 o 270. Si una sala crece (por ejemplo, al añadir personas), los objetos conservan su posición medida desde la esquina; los que queden fuera de la sala no se dibujan.

## Límites

- Los objetos son **estáticos** (sin animación) y de un único estilo.
- No se pueden añadir objetos nuevos al catálogo desde la pantalla: si necesitas uno que no está, se añade en el código (`packages/sim/src/org/decor.ts`). Para algo propio hoy puedes usar la **ilustración propia** de un tipo de instalación (ver [instalaciones-y-plantillas.md](instalaciones-y-plantillas.md)).
- Solo se decoran las salas de áreas y subáreas; la **sala común** y los pasillos no.
- No hay deshacer dentro del editor: usa **Cancelar** para volver a lo guardado.
