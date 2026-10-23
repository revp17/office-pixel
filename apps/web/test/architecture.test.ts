import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reglas de arquitectura de `apps/web`: cada capa solo puede apoyarse en las indicadas.
 *
 *   shared          formato y utilidades sin dependencias
 *   application     casos de uso y lógica de edición; define los «puertos» (interfaces) que implementa la infraestructura
 *   infrastructure  Nhost, SQLite local y el almacenamiento del navegador (implementan los puertos)
 *   scene           el plano en Phaser (dibujo y distribución del edificio)
 *   ui              formularios y pantallas en Preact
 *   app             la raíz de composición: junta todo y arranca
 *
 * Si este test falla, un import rompe la estructura: muévelo a la capa correcta o replantea la dependencia.
 */
const SRC = resolve(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const ALLOWED: Record<string, string[]> = {
  shared: ['shared'],
  application: ['application', 'shared'],
  infrastructure: ['infrastructure', 'application', 'shared'],
  scene: ['scene', 'shared'],
  ui: ['ui', 'application', 'scene', 'shared'],
  app: ['app', 'ui', 'application', 'infrastructure', 'scene', 'shared'],
};
/** paquetes externos permitidos por capa (además de @office-pixel/sim, que lo pueden usar todas) */
const EXTERNAL: Record<string, string[]> = {
  shared: [],
  application: [],
  infrastructure: [],
  scene: ['phaser'],
  ui: ['preact', 'preact/hooks'],
  app: ['phaser', 'preact', 'preact/hooks'],
};

function files(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(n) && !n.endsWith('.d.ts')) out.push(p);
  }
  return out;
}
const rel = (f: string) => relative(SRC, f).split(sep);
const layerOf = (f: string) => (rel(f).length > 1 ? rel(f)[0] : 'root');
const importsOf = (text: string) => [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const all = files(SRC);

describe('arquitectura de apps/web', () => {
  it('todas las carpetas son capas conocidas', () => {
    for (const l of new Set(all.map(layerOf))) expect([...Object.keys(ALLOWED), 'root'], `carpeta «${l}» sin regla`).toContain(l);
  });

  it('main.ts es solo el punto de entrada', () => {
    const main = readFileSync(join(SRC, 'main.ts'), 'utf8');
    expect(main.split('\n').length).toBeLessThan(10);
    expect(importsOf(main)).toEqual(['./app/bootstrap']);
  });

  for (const [layer, allowed] of Object.entries(ALLOWED)) {
    it(`«${layer}» solo depende de: ${allowed.join(', ')}`, () => {
      const bad: string[] = [];
      for (const f of all.filter((x) => layerOf(x) === layer)) {
        for (const spec of importsOf(readFileSync(f, 'utf8'))) {
          if (!spec.startsWith('.')) continue;
          const target = resolve(dirname(f), spec);
          if (!target.startsWith(SRC)) {
            // única salida permitida: las empresas de ejemplo (examples/*.yaml) como texto, desde la raíz de composición
            const example = layer === 'app' && /\/examples\/[\w.-]+\.yaml\?raw$/.test(spec);
            if (!example) bad.push(`${rel(f).join('/')} sale de src (${spec})`);
            continue;
          }
          const t = layerOf(target + '.ts');
          if (t !== 'root' && !allowed.includes(t)) bad.push(`${rel(f).join('/')} importa de «${t}» (${spec})`);
        }
      }
      expect(bad).toEqual([]);
    });

    it(`«${layer}» solo usa los paquetes externos que le corresponden`, () => {
      const ok = new Set(['@office-pixel/sim', ...EXTERNAL[layer]]);
      const bad: string[] = [];
      for (const f of all.filter((x) => layerOf(x) === layer)) {
        for (const spec of importsOf(readFileSync(f, 'utf8'))) {
          if (spec.startsWith('.') || spec.startsWith('node:')) continue;
          const bare = spec.split('?')[0];
          if (!ok.has(bare)) bad.push(`${rel(f).join('/')} importa «${spec}»`);
        }
      }
      expect(bad).toEqual([]);
    });
  }

  it('la lógica (application y shared) no toca el navegador: nada de document, window, localStorage ni fetch', () => {
    const bad: string[] = [];
    for (const f of all.filter((x) => ['application', 'shared'].includes(layerOf(x)))) {
      if (/\b(document|window|localStorage|sessionStorage|fetch)\b/.test(code(readFileSync(f, 'utf8')))) bad.push(rel(f).join('/'));
    }
    expect(bad).toEqual([]);
  });

  it('la interfaz y el plano no acceden al guardado: solo la raíz de composición y la infraestructura', () => {
    const bad: string[] = [];
    for (const f of all.filter((x) => ['ui', 'scene', 'application'].includes(layerOf(x)))) {
      if (/\bfetch\s*\(|\blocalStorage\b/.test(code(readFileSync(f, 'utf8')))) bad.push(rel(f).join('/'));
    }
    // excepciones documentadas: preferencias de la vista que no son datos de la empresa
    expect(bad.sort()).toEqual([]);
  });
});
