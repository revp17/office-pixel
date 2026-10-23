/** Cómo varía un valor entre casos o tareas: fija, normal, con cola larga (lognormal) o exponencial. */
export interface DistSpec {
  dist: 'fixed' | 'normal' | 'lognormal' | 'exponential';
  [param: string]: unknown;
}
import { standardNormal, type Rng } from './rng';

const KEYS: Record<DistSpec['dist'], string[][]> = {
  fixed: [['value', 'minutes']],
  normal: [['mean', 'meanMinutes'], ['sd', 'sdMinutes']],
  lognormal: [['median', 'medianMinutes'], ['sigma']],
  exponential: [['mean', 'meanMinutes']],
};

function pick(spec: DistSpec, names: string[]): number | undefined {
  for (const n of names) {
    const v = spec[n];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function checkDist(spec: unknown, path: string, errors: string[]): void {
  if (typeof spec !== 'object' || spec === null) {
    errors.push(`${path}: debe ser un objeto con "dist"`);
    return;
  }
  const s = spec as DistSpec;
  const keys = KEYS[s.dist];
  if (!keys) {
    errors.push(`${path}.dist: "${String(s.dist)}" no es válida (fixed, normal, lognormal, exponential)`);
    return;
  }
  keys.forEach((names) => {
    const v = pick(s, names);
    if (v === undefined) errors.push(`${path}: falta el parámetro numérico "${names[0]}"`);
    else if (v < 0) errors.push(`${path}.${names[0]}: no puede ser negativo`);
  });
}

/** Muestrea la distribución; el resultado nunca es negativo. */
export function sampleDist(spec: DistSpec, rng: Rng): number {
  const keys = KEYS[spec.dist];
  const p1 = pick(spec, keys[0]) ?? 0;
  const p2 = keys[1] ? (pick(spec, keys[1]) ?? 0) : 0;
  let v: number;
  switch (spec.dist) {
    case 'fixed':
      v = p1;
      break;
    case 'normal':
      v = p1 + p2 * standardNormal(rng);
      break;
    case 'lognormal':
      v = p1 * Math.exp(p2 * standardNormal(rng));
      break;
    case 'exponential':
      v = -p1 * Math.log(1 - rng());
      break;
  }
  return Math.max(0, v);
}
