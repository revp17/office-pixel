import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reglas de arquitectura de `packages/sim`: cada capa solo puede apoyarse en las de abajo.
 *
 *   kernel  ← model ← company
 *                  ← simulation
 *   process → model, company, simulation, kernel
 *   legacy  → kernel, model
 *
 * Si este test falla, un import rompe la estructura: muévelo a la capa correcta o replantea la dependencia.
 */
const SRC = resolve(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const ALLOWED: Record<string, string[]> = {
  kernel: ['kernel'],
  model: ['model', 'kernel'],
  company: ['company', 'model', 'kernel'],
  simulation: ['simulation', 'model', 'kernel'],
  process: ['process', 'company', 'simulation', 'model', 'kernel'],
  legacy: ['legacy', 'model', 'kernel'],
};

function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (n.endsWith('.ts')) out.push(p);
  }
  return out;
}

const layerOf = (file: string) => relative(SRC, file).split(sep)[0];
const importsOf = (text: string) => [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const all = files(SRC).filter((f) => layerOf(f) !== 'index.ts');

describe('arquitectura de packages/sim', () => {
  it('todas las carpetas son capas conocidas', () => {
    const layers = new Set(all.map(layerOf));
    for (const l of layers) expect(Object.keys(ALLOWED), `carpeta «${l}» sin regla`).toContain(l);
  });

  for (const [layer, allowed] of Object.entries(ALLOWED)) {
    it(`«${layer}» solo depende de: ${allowed.join(', ')}`, () => {
      const bad: string[] = [];
      for (const f of all.filter((x) => layerOf(x) === layer)) {
        for (const spec of importsOf(readFileSync(f, 'utf8'))) {
          if (!spec.startsWith('.')) continue;
          const target = layerOf(resolve(dirname(f), spec));
          if (!allowed.includes(target)) bad.push(`${relative(SRC, f)} importa de «${target}» (${spec})`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('el dominio no usa el navegador ni Node: solo la librería de YAML', () => {
    const bad: string[] = [];
    for (const f of all) {
      const text = readFileSync(f, 'utf8');
      for (const spec of importsOf(text)) if (!spec.startsWith('.') && spec !== 'yaml') bad.push(`${relative(SRC, f)} importa «${spec}»`);
      if (/\b(document|window|localStorage|sessionStorage|process\.env)\b/.test(code(text))) bad.push(`${relative(SRC, f)} usa APIs del entorno`);
    }
    expect(bad).toEqual([]);
  });

  it('el modelo son solo tipos y constantes: sin dependencia de la lógica', () => {
    const bad = all.filter((f) => layerOf(f) === 'model').filter((f) => /\bimport\b[^;]*from\s+'\.\.\/(company|simulation|process)/.test(readFileSync(f, 'utf8')));
    expect(bad.map((f) => relative(SRC, f))).toEqual([]);
  });
});
