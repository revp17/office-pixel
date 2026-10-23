export type Facility = 'oficina' | 'bodega' | 'ingreso' | 'despacho' | 'seguridad' | 'mantenimiento' | 'transporte';

export interface FacilityInfo {
  label: string;
  icon: string;
  /** frase corta (se muestra al elegir el tipo) */
  hint: string;
  /** para qué sirve y cuándo usarla */
  description: string;
  /** qué se dibuja en la sala */
  equipment: string[];
  /** puestos típicos de quienes trabajan ahí */
  roles: string[];
  /** procesos que suelen pasar por esta instalación */
  processes: string[];
  /** nombre sugerido al crear un área de este tipo */
  defaultName: string;
}

/** Espacio de dibujo de una ilustración propia: cada elemento usa coordenadas de 0 a ART_W y de 0 a ART_H. */
export const ART_W = 240;
export const ART_H = 80;

/** Un elemento de una ilustración propia. */
export type ArtItem =
  | { t: 'rect'; x: number; y: number; w: number; h: number; c: string; r?: number }
  | { t: 'ellipse'; x: number; y: number; w: number; h: number; c: string }
  | { t: 'tri'; x: number; y: number; w: number; h: number; c: string }
  | { t: 'line'; x: number; y: number; x2: number; y2: number; c: string; lw: number }
  /** un icono o emoji; (x, y) es su esquina superior izquierda y s su tamaño */
  | { t: 'emoji'; x: number; y: number; s: number; ch: string };

/** Ilustración propia de un tipo de instalación: elementos dibujados a mano o una imagen subida. */
export interface FacilityArt {
  items?: ArtItem[];
  /** imagen (data URL) en lugar de elementos */
  image?: string;
}

/**
 * Tipo de instalación creado por el usuario. Se dibuja con el aspecto (`look`) de uno de los tipos
 * incluidos, pero con su propio nombre e icono.
 */
export interface CustomFacility {
  id: string;
  label: string;
  icon: string;
  description?: string;
  /** tipo incluido cuyo dibujo usa en el plano cuando no tiene ilustración propia */
  look: Facility;
  /** ilustración propia, totalmente distinta de los 7 dibujos incluidos */
  art?: FacilityArt;
}

/** Catálogo de instalaciones que una sala puede representar; solo cambian cómo se ve, no la simulación. */
export const FACILITIES: Record<Facility, FacilityInfo> = {
  oficina: {
    label: 'Oficina',
    icon: '🖥',
    hint: 'Escritorios y computadores (por defecto)',
    description: 'Trabajo administrativo o de escritorio: ventas, finanzas, atención, planificación, dirección.',
    equipment: ['Escritorios con computador', 'Sillas', 'Bandeja de entrada de casos'],
    roles: ['gerente', 'analista', 'vendedor', 'facturador', 'agente'],
    processes: ['Venta y facturación', 'Compras', 'Atención de reclamos'],
    defaultName: 'Nueva oficina',
  },
  bodega: {
    label: 'Bodega / almacén',
    icon: '📦',
    hint: 'Estanterías con mercadería',
    description: 'Donde se guarda y se prepara la mercadería: almacenamiento, picking, inventarios, cadena de frío.',
    equipment: ['Estanterías con cajas', 'Bandeja de entrada de casos'],
    roles: ['bodeguero', 'preparador', 'auditor_inventario', 'jefe_almacen'],
    processes: ['Ubicación de productos', 'Picking y preparación de pedidos', 'Toma de inventario'],
    defaultName: 'Nueva bodega',
  },
  ingreso: {
    label: 'Ingreso de productos',
    icon: '🚚',
    hint: 'Muelle de recepción con camión y pallets',
    description: 'Recepción de mercadería de proveedores: descarga, conteo e inspección de calidad antes de guardarla.',
    equipment: ['Camión en el muelle', 'Pallets con cajas', 'Franja de seguridad', 'Luz de aviso'],
    roles: ['recibidor', 'estibador', 'inspector', 'jefe_recepcion'],
    processes: ['Ingreso de productos', 'Control de calidad', 'Devolución a proveedores'],
    defaultName: 'Recepción de mercadería',
  },
  despacho: {
    label: 'Despacho',
    icon: '📤',
    hint: 'Muelle de salida con pedidos listos',
    description: 'Salida de pedidos: empaque, etiquetado y carga a los vehículos de reparto.',
    equipment: ['Puerta de muelle', 'Pallets de pedidos listos', 'Franja de seguridad', 'Luz de aviso'],
    roles: ['despachador', 'empacador', 'jefe_despacho'],
    processes: ['Despacho de pedidos', 'Empaque y etiquetado', 'Carga de rutas'],
    defaultName: 'Despacho',
  },
  seguridad: {
    label: 'Seguridad',
    icon: '🛡',
    hint: 'Garita, cámaras y control de acceso',
    description: 'Control de accesos y vigilancia: garita, visitas, rondas, monitoreo de cámaras y atención de alertas.',
    equipment: ['Pared de cámaras con luz REC', 'Torniquete de acceso'],
    roles: ['guardia', 'operador_cctv', 'supervisor_ronda', 'jefe_seguridad'],
    processes: ['Control de acceso', 'Alerta de seguridad', 'Rondas e incidentes'],
    defaultName: 'Seguridad',
  },
  mantenimiento: {
    label: 'Mantenimiento',
    icon: '🔧',
    hint: 'Taller con banco de trabajo y herramientas',
    description: 'Reparación y cuidado de equipos e instalaciones: mecánico, eléctrico, infraestructura y limpieza.',
    equipment: ['Banco de trabajo', 'Caja de herramientas', 'Tablero de herramientas', 'Luz de trabajo'],
    roles: ['técnico', 'mecánico', 'electricista', 'operario_mantenimiento', 'jefe_mantenimiento'],
    processes: ['Orden de mantenimiento correctivo', 'Mantenimiento preventivo', 'Reparación de equipos'],
    defaultName: 'Mantenimiento',
  },
  transporte: {
    label: 'Transporte y flota',
    icon: '🚛',
    hint: 'Vehículos de reparto',
    description: 'Reparto y gestión de la flota: planificación de rutas, conductores y entrega al cliente.',
    equipment: ['Vehículos de reparto', 'Franja de seguridad'],
    roles: ['conductor', 'coordinador_flota', 'planificador_rutas', 'repartidor'],
    processes: ['Planificación de rutas', 'Entrega al cliente', 'Mantenimiento de vehículos'],
    defaultName: 'Transporte y flota',
  },
};
