import { FACILITIES, type CompanyDef, type Facility, type FacilityArt } from './types';

/** Un tipo de instalación (incluido o propio) ya resuelto para mostrarlo y dibujarlo. */
export interface FacilityView {
  id: string;
  label: string;
  icon: string;
  hint: string;
  description: string;
  /** tipo incluido cuyo dibujo se usa en el plano */
  look: Facility;
  builtin: boolean;
  /** ilustración propia (solo tipos propios) */
  art?: FacilityArt;
}

/** ¿Tiene una ilustración propia con algo que dibujar? */
export const hasArt = (a: FacilityArt | undefined): a is FacilityArt => !!a && (!!a.image || (a.items?.length ?? 0) > 0);

export const isBuiltinFacility = (id: string): id is Facility => Object.prototype.hasOwnProperty.call(FACILITIES, id);

/** Todos los tipos disponibles en la empresa: primero los incluidos y luego los propios. */
export function facilityViews(def: Pick<CompanyDef, 'facilityTypes'>): FacilityView[] {
  const builtin = (Object.keys(FACILITIES) as Facility[]).map((k) => ({
    id: k,
    label: FACILITIES[k].label,
    icon: FACILITIES[k].icon,
    hint: FACILITIES[k].hint,
    description: FACILITIES[k].description,
    look: k,
    builtin: true,
  }));
  const custom = (def.facilityTypes ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    hint: c.description?.trim() || `Dibujada como ${FACILITIES[c.look].label.toLowerCase()}`,
    description: c.description?.trim() || `Instalación propia, dibujada como ${FACILITIES[c.look].label.toLowerCase()}.`,
    look: c.look,
    builtin: false,
    ...(hasArt(c.art) ? { art: c.art } : {}),
  }));
  return [...builtin, ...custom];
}

/** El tipo de una unidad; si no está definido o no existe, es una oficina. */
export function resolveFacility(def: Pick<CompanyDef, 'facilityTypes'>, id: string | undefined): FacilityView {
  const all = facilityViews(def);
  return all.find((f) => f.id === (id ?? 'oficina')) ?? all[0];
}
