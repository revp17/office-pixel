import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Reglas de arquitectura de `apps/server`: es una pieza pequeña y separada. Solo puede apoyarse en el dominio
 * (`@office-pixel/sim`), en Node y en sí misma; nunca en la interfaz ni en otra aplicación.
 */
const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'));
const importsOf = (text: string) => [...text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);

describe('arquitectura de apps/server', () => {
  it('solo importa Node, el dominio (sim) y sus propios archivos', () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const spec of importsOf(readFileSync(join(SRC, f), 'utf8'))) {
        const ok = spec.startsWith('node:') || spec === '@office-pixel/sim' || /^\.\/[\w-]+$/.test(spec);
        if (!ok) bad.push(`${f} importa «${spec}»`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('la API y el almacén no dependen del arranque del servidor', () => {
    for (const f of ['api.ts', 'store.ts']) {
      expect(importsOf(readFileSync(join(SRC, f), 'utf8')), f).not.toContain('./server');
    }
    // el almacén (SQLite) no conoce HTTP ni la validación del dominio
    const store = importsOf(readFileSync(join(SRC, 'store.ts'), 'utf8'));
    expect(store).not.toContain('./api');
    expect(store).not.toContain('@office-pixel/sim');
  });
});
