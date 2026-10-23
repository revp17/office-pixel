import { stringify } from 'yaml';
import type { CompanyDef } from '../model';

/** Serializa la empresa a YAML legible (sin recortes de línea). */
export function companyToYaml(def: CompanyDef): string {
  return stringify(def, { lineWidth: 0 });
}
