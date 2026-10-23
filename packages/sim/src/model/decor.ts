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
