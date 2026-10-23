import type { CompanyDef, OrgSimResult, PersonState } from '@office-pixel/sim';
import { emptyCompany } from '../application/editing/model';

export type Mode = 'explain' | 'week';

/** casos propios por día y proceso en el modo «cómo funciona» */
export const SAMPLE_PER_DAY = 4;

/** Lo que muestra la aplicación ahora mismo (una sola sesión por pestaña). */
export const state = {
  /** la empresa guardada y abierta (antes de abrir la base de datos, un marcador vacío) */
  company: emptyCompany() as CompanyDef,
  /** lo que se simula: la empresa, o una variante en vista previa */
  def: undefined as unknown as CompanyDef,
  result: undefined as unknown as OrgSimResult,
  /** si hay vista previa (optimización), la variante que se simula en vez de la empresa guardada */
  preview: null as { company: CompanyDef; label: string } | null,
  mode: 'explain' as Mode,
  personEvents: new Map<string, Array<{ t: number; state: PersonState }>>(),
};
