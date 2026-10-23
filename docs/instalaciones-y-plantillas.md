# Instalaciones (bodega, ingreso, despacho, seguridad, mantenimiento) y plantillas

Office-Pixel sirve para empresas de cualquier tamaño: una oficina con 10 personas, una distribuidora mediana o un centro de distribución grande. Además de oficinas, el plano puede mostrar **instalaciones operativas**, y trae **tres empresas de ejemplo** con sus procesos ya definidos.

## Tipo de instalación

Cada área y cada subárea tiene un **Tipo de instalación** (en **Configurar empresa → Áreas y subáreas**). Solo cambia **cómo se dibuja la sala**; las personas, los procesos y la simulación funcionan igual.

| Tipo | Qué se dibuja |
|---|---|
| 🖥 Oficina (por defecto) | Escritorios con computador |
| 📦 Bodega / almacén | Estanterías con cajas |
| 🚚 Ingreso de productos | Muelle de recepción con camión, pallets y luz de aviso |
| 📤 Despacho | Puerta de muelle y pallets listos, con franja de seguridad |
| 🛡 Seguridad | Pared de cámaras (con luz REC), torniquete de acceso |
| 🔧 Mantenimiento | Banco de trabajo, caja y tablero de herramientas |
| 🚛 Transporte y flota | Vehículos de reparto |

## Catálogo de instalaciones

En **Configurar empresa → Empresa → Instalaciones** están los 7 tipos con su vista previa, para qué sirven, qué se dibuja, los puestos y procesos típicos y en qué áreas de tu empresa se usan. Desde cada ficha puedes **aplicar el tipo a un área o subárea existente** o **crear un área nueva de ese tipo** (queda sin personas: añádelas en «Áreas y subáreas»).

Las salas que no son oficina son un poco más anchas y altas para que quepa su equipamiento. Su nombre lleva el icono del tipo.

En el YAML es el campo `facility` de la unidad:

```yaml
units:
  - { id: bodega, name: Bodega central, facility: bodega }
  - { id: garita, name: Garita y accesos, facility: seguridad }
```

Valores válidos: `oficina`, `bodega`, `ingreso`, `despacho`, `seguridad`, `mantenimiento`, `transporte`. Cualquier otro se rechaza al validar.

## Plantillas de empresa

En **Configurar empresa → Cargar plantilla…** (arriba a la derecha) hay cuatro empresas para empezar. Cargar una **reemplaza lo que hay en el formulario** (pide confirmación); nada se guarda hasta que pulsas **Aplicar y simular**.

| Plantilla | Tamaño | Qué muestra |
|---|---|---|
| Banco Pixel | 32 personas, oficinas | Servicios: crédito, riesgos, legal y atención |
| **Ferretería El Tornillo** | Pequeña, 10 personas | Tienda, bodega, recepción, despacho, un guardia y un técnico |
| **Distribuidora Andina** | Mediana, 38 personas | Logística (recepción, dos bodegas, picking, despacho, flota), seguridad con garita y CCTV, mantenimiento mecánico y eléctrico |
| **Centro de Distribución Pacífico** | Grande, ~60 personas | Recepción con control de calidad, bodega seca y cadena de frío, picking/empaque/muelles de salida, rutas y conductores, seguridad, mantenimiento y atención |

Las tres plantillas operativas traen estos procesos, que puedes ver correr en el plano:

- **Ingreso de productos**: control de acceso del camión → descarga en el muelle → inspección → ubicación en bodega (con devolución al proveedor si falla la calidad).
- **Pedido y despacho**: registro → (facturación) → picking → empaque → carga → transporte y entrega (con pedido incompleto si falta stock).
- **Mantenimiento**: solicitud → clasificación → reparación (mecánica, eléctrica o de infraestructura según el tipo) → cierre. En la pequeña, con espera de repuesto.
- **Seguridad**: control de acceso de visitantes (pequeña) o alerta de cámaras → verificación en sitio → informe, con falsas alarmas que se cierran sin informe.

Las plantillas también traen **dependencias entre procesos**: en la ferretería un incidente de seguridad puede generar una orden de mantenimiento, y el despacho de pedidos *requiere* que la mercadería ya esté en bodega (ver [gestion-de-procesos.md](gestion-de-procesos.md#dependencias-entre-procesos)).

Cada caso se ve como una caja que viaja entre salas: el camión descarga en el ingreso, la mercadería pasa a la bodega, el pedido sale por despacho y el aviso de mantenimiento llega al taller.

## Cómo adaptarlo a tu empresa

1. Carga la plantilla más parecida a tu tamaño.
2. En **Áreas y subáreas**: renombra, añade o quita áreas, y elige el tipo de instalación de cada una.
3. En **Personas**: ajusta quién trabaja en cada sala, sus turnos y su velocidad.
4. En **Procesos**: cambia tiempos, llegadas por hora, reglas y excepciones (por ejemplo, la probabilidad de rechazo de calidad o de falsa alarma).
5. **Aplicar y simular** y mira dónde se acumula el trabajo.

## Límites actuales

- El tipo de instalación es **visual**: no hay inventario, stock ni capacidad de bodega simulados. Un caso es un pedido, una descarga o una orden, no un producto.
- Los vehículos y el equipamiento son **decorativos y estáticos** (salvo las luces que parpadean): no hay camiones que lleguen y se vayan ni guardias que patrullen.
- Los tiempos de las plantillas son **inventados** para ilustrar; calíbralos con los datos reales de tu operación.
- Sigue sin haber varias plantas o sedes, ni un plano de planta libre: la distribución se genera desde el organigrama.
