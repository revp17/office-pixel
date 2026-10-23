import type { ArtItem } from './types';

/** Un objeto colocado en una sala: su centro está en (x, y), medido en píxeles desde la esquina superior izquierda de la sala. */
export interface DecorItem {
  id: string;
  /** clave del catálogo (`DECOR`) */
  k: string;
  x: number;
  y: number;
  /** giro en grados, de 90 en 90 */
  rot: 0 | 90 | 180 | 270;
  /** espejo horizontal */
  flip?: boolean;
}

export type DecorGroup = 'Muebles' | 'Almacenaje' | 'Equipos' | 'Estructura' | 'Decoración' | 'Logística y seguridad';
export const DECOR_GROUPS: DecorGroup[] = ['Muebles', 'Almacenaje', 'Equipos', 'Estructura', 'Decoración', 'Logística y seguridad'];

export interface DecorDef {
  label: string;
  group: DecorGroup;
  /** tamaño del objeto, en píxeles del plano, sin girar */
  w: number;
  h: number;
  /** cómo se dibuja, con coordenadas de 0 a w y de 0 a h */
  art: ArtItem[];
}

const R = (x: number, y: number, w: number, h: number, c: string, r = 0): ArtItem => ({ t: 'rect', x, y, w, h, c, ...(r ? { r } : {}) });
const E = (x: number, y: number, w: number, h: number, c: string): ArtItem => ({ t: 'ellipse', x, y, w, h, c });
const T = (x: number, y: number, w: number, h: number, c: string): ArtItem => ({ t: 'tri', x, y, w, h, c });
const L = (x: number, y: number, x2: number, y2: number, c: string, lw = 1): ArtItem => ({ t: 'line', x, y, x2, y2, c, lw });

const WOOD = '#8a6238';
const WOOD_L = '#b98856';

/** Catálogo de objetos listos para acomodar en las salas. */
export const DECOR: Record<string, DecorDef> = {
  // ---------- Muebles ----------
  escritorio: {
    label: 'Escritorio', group: 'Muebles', w: 48, h: 30,
    art: [R(0, 0, 48, 30, WOOD, 4), R(0, 0, 48, 25, WOOD_L, 4), R(15, 3, 18, 12, '#131824', 2), R(17, 5, 14, 8, '#7fe3b4', 1), R(16, 19, 16, 5, '#e3e8f4', 1)],
  },
  mesa: {
    label: 'Mesa', group: 'Muebles', w: 56, h: 34,
    art: [R(0, 0, 56, 34, WOOD, 5), R(1, 1, 54, 30, WOOD_L, 5)],
  },
  mesa_redonda: {
    label: 'Mesa redonda', group: 'Muebles', w: 40, h: 40,
    art: [E(0, 0, 40, 40, WOOD), E(2, 2, 36, 35, WOOD_L)],
  },
  mesa_reunion: {
    label: 'Mesa de reunión', group: 'Muebles', w: 100, h: 44,
    art: [R(0, 0, 100, 44, '#6b4a2b', 9), R(2, 2, 96, 38, '#9c7040', 9), R(40, 14, 20, 12, '#c4965f', 4)],
  },
  mostrador: {
    label: 'Mostrador', group: 'Muebles', w: 72, h: 22,
    art: [R(0, 0, 72, 22, '#4a5672', 4), R(0, 0, 72, 16, '#6c7a9c', 4), R(54, 3, 14, 9, '#131824', 2), R(56, 5, 10, 5, '#7fe3b4', 1)],
  },
  silla: {
    label: 'Silla', group: 'Muebles', w: 16, h: 16,
    art: [E(1, 3, 14, 13, '#2a3144'), E(3, 5, 10, 9, '#3b4663'), R(2, 0, 12, 4, '#232b3d', 2)],
  },
  sillon: {
    label: 'Sillón', group: 'Muebles', w: 26, h: 24,
    art: [R(0, 0, 26, 24, '#4a5c8a', 6), R(3, 6, 20, 16, '#5d73a8', 4), R(0, 3, 5, 18, '#3e4e76', 3), R(21, 3, 5, 18, '#3e4e76', 3)],
  },
  sofa: {
    label: 'Sofá', group: 'Muebles', w: 64, h: 26,
    art: [R(0, 0, 64, 26, '#6a4a8a', 6), R(5, 7, 54, 17, '#8560aa', 4), R(0, 3, 6, 21, '#59407a', 3), R(58, 3, 6, 21, '#59407a', 3)],
  },
  banco: {
    label: 'Banco', group: 'Muebles', w: 44, h: 12,
    art: [R(0, 0, 44, 12, WOOD, 3), R(1, 1, 42, 8, WOOD_L, 3)],
  },

  // ---------- Almacenaje ----------
  archivador: {
    label: 'Archivador', group: 'Almacenaje', w: 22, h: 28,
    art: [R(0, 0, 22, 28, '#6f7f99', 3), R(2, 2, 18, 7, '#8c9bb5', 1), R(2, 11, 18, 7, '#8c9bb5', 1), R(2, 20, 18, 6, '#8c9bb5', 1), R(8, 5, 6, 1, '#3a4560'), R(8, 14, 6, 1, '#3a4560'), R(8, 23, 6, 1, '#3a4560')],
  },
  estanteria: {
    label: 'Estantería', group: 'Almacenaje', w: 48, h: 16,
    art: [R(0, 0, 48, 16, '#2d3d5e'), R(0, 7, 48, 2, '#e0883a'), R(3, 1, 11, 6, '#c98f4c'), R(17, 2, 12, 5, '#5d8fc9'), R(32, 1, 12, 6, '#7aa86a'), R(4, 9, 14, 6, '#d6a35f'), R(22, 10, 10, 5, '#9c7a4d')],
  },
  libreria: {
    label: 'Librería', group: 'Almacenaje', w: 44, h: 14,
    art: [R(0, 0, 44, 14, '#6b4a2b', 2), R(2, 2, 40, 10, '#3b2a18'), R(4, 3, 4, 8, '#c0392b'), R(9, 4, 4, 7, '#5aa9ff'), R(14, 3, 5, 8, '#f5c451'), R(21, 4, 4, 7, '#4cd98a'), R(27, 3, 5, 8, '#9b6bd1'), R(34, 4, 4, 7, '#e8edf7')],
  },
  casillero: {
    label: 'Casilleros', group: 'Almacenaje', w: 30, h: 34,
    art: [R(0, 0, 30, 34, '#5a6b8a', 3), R(2, 2, 12, 14, '#7f90ae', 1), R(16, 2, 12, 14, '#7f90ae', 1), R(2, 18, 12, 14, '#7f90ae', 1), R(16, 18, 12, 14, '#7f90ae', 1), R(11, 8, 2, 3, '#e8edf7'), R(25, 8, 2, 3, '#e8edf7')],
  },
  caja: {
    label: 'Caja', group: 'Almacenaje', w: 18, h: 16,
    art: [R(0, 0, 18, 16, '#c98f4c', 1), R(0, 0, 18, 3, '#e0a860'), L(9, 0, 9, 16, '#9c7a4d')],
  },
  pallet: {
    label: 'Pallet con cajas', group: 'Almacenaje', w: 32, h: 28,
    art: [R(0, 22, 32, 6, '#7a5a34'), R(2, 10, 13, 12, '#c98f4c'), R(17, 10, 13, 12, '#9c7a4d'), R(8, 0, 15, 11, '#d6a35f')],
  },
  barril: {
    label: 'Barril', group: 'Almacenaje', w: 18, h: 18,
    art: [E(0, 0, 18, 18, '#2f6aa8'), E(2, 2, 14, 14, '#3f7fbf'), E(5, 5, 8, 8, '#2f6aa8')],
  },

  // ---------- Equipos ----------
  computador: {
    label: 'Computador', group: 'Equipos', w: 24, h: 20,
    art: [R(5, 0, 14, 11, '#131824', 2), R(6, 1, 12, 9, '#7fe3b4', 1), R(10, 11, 4, 2, '#9aa6c0'), R(2, 15, 20, 4, '#e3e8f4', 1)],
  },
  impresora: {
    label: 'Impresora', group: 'Equipos', w: 28, h: 22,
    art: [R(0, 7, 28, 15, '#d9dfec', 3), R(5, 0, 18, 9, '#f4f6fb', 1), R(5, 12, 18, 3, '#6b7690'), E(22, 16, 3, 3, '#4cd98a')],
  },
  servidor: {
    label: 'Rack de servidores', group: 'Equipos', w: 24, h: 38,
    art: [R(0, 0, 24, 38, '#2a3144', 3), R(2, 3, 20, 7, '#3b4663', 1), R(2, 13, 20, 7, '#3b4663', 1), R(2, 23, 20, 7, '#3b4663', 1), E(4, 5, 3, 3, '#4cd98a'), E(4, 15, 3, 3, '#f5c451'), E(4, 25, 3, 3, '#4cd98a')],
  },
  cafetera: {
    label: 'Cafetera', group: 'Equipos', w: 16, h: 18,
    art: [R(0, 0, 16, 18, '#3a3f4f', 3), R(4, 10, 8, 6, '#e8edf7', 1), E(5, 2, 6, 6, '#c0392b')],
  },
  dispensador: {
    label: 'Dispensador de agua', group: 'Equipos', w: 18, h: 26,
    art: [R(0, 0, 18, 26, '#e8edf7', 3), R(3, 2, 12, 11, '#5aa9ff', 5), R(5, 17, 8, 4, '#9aa6c0', 1)],
  },
  refrigerador: {
    label: 'Refrigerador', group: 'Equipos', w: 26, h: 38,
    art: [R(0, 0, 26, 38, '#cfd6e6', 4), L(0, 15, 26, 15, '#9aa6c0', 1), R(20, 4, 2, 8, '#6b7690'), R(20, 19, 2, 12, '#6b7690')],
  },
  pantalla: {
    label: 'Pantalla / TV', group: 'Equipos', w: 46, h: 8,
    art: [R(0, 0, 46, 8, '#131824', 2), R(1, 1, 44, 5, '#4aa8ff', 1)],
  },
  pizarra: {
    label: 'Pizarra', group: 'Equipos', w: 56, h: 7,
    art: [R(0, 0, 56, 7, '#9aa6c0', 1), R(1, 1, 54, 4, '#f4f6fb')],
  },

  // ---------- Estructura ----------
  puerta: {
    label: 'Puerta', group: 'Estructura', w: 34, h: 12,
    art: [R(0, 4, 34, 6, '#6b4a2b', 1), R(2, 5, 30, 4, WOOD_L, 1), E(26, 5, 3, 3, '#f5c451'), L(2, 2, 32, 2, '#ffffff', 1)],
  },
  puerta_doble: {
    label: 'Puerta doble', group: 'Estructura', w: 64, h: 12,
    art: [R(0, 4, 64, 6, '#6b4a2b', 1), R(2, 5, 29, 4, WOOD_L, 1), R(33, 5, 29, 4, WOOD_L, 1), E(26, 5, 3, 3, '#f5c451'), E(35, 5, 3, 3, '#f5c451')],
  },
  ventana: {
    label: 'Ventana', group: 'Estructura', w: 40, h: 8,
    art: [R(0, 1, 40, 6, '#e8edf7', 1), R(2, 2, 36, 4, '#7ab6e6'), L(20, 2, 20, 6, '#e8edf7', 1)],
  },
  pared: {
    label: 'Pared', group: 'Estructura', w: 64, h: 8,
    art: [R(0, 0, 64, 8, '#39445e', 2), R(0, 0, 64, 2, '#4d5a7a')],
  },
  columna: {
    label: 'Columna', group: 'Estructura', w: 14, h: 14,
    art: [R(0, 0, 14, 14, '#4a5672', 2), R(2, 2, 10, 10, '#5d6b8c', 1)],
  },
  escalera: {
    label: 'Escalera', group: 'Estructura', w: 30, h: 40,
    art: [R(0, 0, 30, 40, '#2f3a52'), L(0, 5, 30, 5, '#59668a'), L(0, 10, 30, 10, '#59668a'), L(0, 15, 30, 15, '#59668a'), L(0, 20, 30, 20, '#59668a'), L(0, 25, 30, 25, '#59668a'), L(0, 30, 30, 30, '#59668a'), L(0, 35, 30, 35, '#59668a'), T(9, 8, 12, 10, '#e8edf7')],
  },

  // ---------- Decoración ----------
  planta: {
    label: 'Planta', group: 'Decoración', w: 18, h: 20,
    art: [R(5, 13, 8, 7, '#8a5a34', 2), E(0, 2, 10, 10, '#3f9e5e'), E(8, 2, 10, 10, '#3f9e5e'), E(4, 0, 10, 10, '#56bd78')],
  },
  planta_grande: {
    label: 'Planta grande', group: 'Decoración', w: 28, h: 32,
    art: [R(8, 21, 12, 11, '#8a5a34', 3), E(0, 4, 16, 16, '#3f9e5e'), E(12, 4, 16, 16, '#3f9e5e'), E(6, 0, 16, 16, '#56bd78'), E(8, 9, 12, 12, '#2f7d49')],
  },
  alfombra: {
    label: 'Alfombra', group: 'Decoración', w: 72, h: 46,
    art: [R(0, 0, 72, 46, '#3c2f55', 8), R(4, 4, 64, 38, '#4b3b6d', 6), R(10, 10, 52, 26, '#5a4880', 4)],
  },
  cuadro: {
    label: 'Cuadro', group: 'Decoración', w: 26, h: 6,
    art: [R(0, 0, 26, 6, WOOD_L, 1), R(1, 1, 24, 4, '#7fb4e8')],
  },
  reloj: {
    label: 'Reloj', group: 'Decoración', w: 14, h: 14,
    art: [E(0, 0, 14, 14, '#9aa6c0'), E(1.5, 1.5, 11, 11, '#f4f6fb'), L(7, 7, 7, 3, '#131824', 1), L(7, 7, 10, 8, '#131824', 1)],
  },
  basurero: {
    label: 'Basurero', group: 'Decoración', w: 14, h: 16,
    art: [R(1, 2, 12, 14, '#59627a', 2), R(0, 0, 14, 4, '#7a849c', 1)],
  },

  // ---------- Logística y seguridad ----------
  extintor: {
    label: 'Extintor', group: 'Logística y seguridad', w: 10, h: 16,
    art: [R(1, 4, 8, 12, '#c0392b', 3), R(3, 0, 4, 5, '#2a2f3b', 1), R(5, 2, 5, 2, '#2a2f3b')],
  },
  salida: {
    label: 'Salida de emergencia', group: 'Logística y seguridad', w: 26, h: 10,
    art: [R(0, 0, 26, 10, '#1f8f4a', 2), L(5, 5, 20, 5, '#ffffff', 1.5), T(18, 2, 6, 6, '#ffffff')],
  },
  camara: {
    label: 'Cámara', group: 'Logística y seguridad', w: 14, h: 10,
    art: [R(0, 1, 11, 7, '#2a2f3b', 2), E(10, 2, 4, 5, '#ff4d4d'), R(3, 8, 5, 2, '#59627a')],
  },
  torniquete: {
    label: 'Torniquete', group: 'Logística y seguridad', w: 34, h: 20,
    art: [R(0, 2, 5, 16, '#9aa6c0', 1), R(29, 2, 5, 16, '#9aa6c0', 1), R(5, 8, 24, 4, '#f5c451', 1)],
  },
  barrera: {
    label: 'Barrera', group: 'Logística y seguridad', w: 54, h: 8,
    art: [R(0, 0, 54, 8, '#f4f6fb', 1), R(4, 0, 8, 8, '#c0392b'), R(20, 0, 8, 8, '#c0392b'), R(36, 0, 8, 8, '#c0392b'), R(0, 0, 3, 8, '#59627a')],
  },
  cono: {
    label: 'Cono', group: 'Logística y seguridad', w: 12, h: 14,
    art: [R(0, 11, 12, 3, '#2a2f3b', 1), T(2, 0, 8, 12, '#e0883a'), R(3, 6, 6, 2, '#ffffff')],
  },
  banco_trabajo: {
    label: 'Banco de trabajo', group: 'Logística y seguridad', w: 64, h: 22,
    art: [R(0, 4, 64, 10, '#6b4f30', 2), R(3, 14, 5, 8, '#3a4560'), R(56, 14, 5, 8, '#3a4560'), R(8, 0, 20, 6, '#c0392b', 2), L(34, 7, 44, 7, '#c9d2e6', 2)],
  },
  camion: {
    label: 'Camión', group: 'Logística y seguridad', w: 84, h: 34,
    art: [R(0, 2, 56, 28, '#e8edf7', 3), R(56, 10, 22, 20, '#f5c451', 8), R(66, 14, 10, 9, '#9ad1ff', 2), E(8, 24, 10, 10, '#131824'), E(60, 24, 10, 10, '#131824')],
  },
};

export const DECOR_KEYS = Object.keys(DECOR);
export const isDecorKind = (k: unknown): k is string => typeof k === 'string' && Object.prototype.hasOwnProperty.call(DECOR, k);

/** Caja que ocupa el objeto ya girado (para saber si queda dentro de la sala). */
export function decorBounds(it: Pick<DecorItem, 'k' | 'x' | 'y' | 'rot'>): { x: number; y: number; w: number; h: number } {
  const d = DECOR[it.k];
  const turned = it.rot === 90 || it.rot === 270;
  const w = turned ? d.h : d.w;
  const h = turned ? d.w : d.h;
  return { x: it.x - w / 2, y: it.y - h / 2, w, h };
}
