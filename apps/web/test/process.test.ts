import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fichaMarkdown, parseCompany, ensureDoc } from '@office-pixel/sim';
import { layoutFlow } from '../src/process/flow';
import { mdToHtml } from '../src/process/fichaView';

const def = parseCompany(readFileSync(new URL('../../../examples/banco_pixel.yaml', import.meta.url), 'utf8')).def!;
const credito = def.processes.find((p) => p.id === 'solicitud_credito')!;

describe('diagrama del proceso', () => {
  it('coloca cada etapa una vez, en columnas según su distancia desde el inicio', () => {
    const { nodes, edges, width, height } = layoutFlow(credito);
    expect(nodes.size).toBe(credito.stages.length);
    expect(nodes.get('captura')!.depth).toBe(0);
    expect(nodes.get('kyc')!.depth).toBe(1);
    expect(nodes.get('evaluacion_senior')!.depth).toBe(2);
    expect(nodes.get('evaluacion_analista')!.depth).toBe(2);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    // dos nodos nunca ocupan el mismo sitio
    const seen = new Set([...nodes.values()].map((n) => `${n.x},${n.y}`));
    expect(seen.size).toBe(nodes.size);
    // aristas: normales, por regla y de excepción
    expect(edges.some((e) => e.kind === 'exception')).toBe(true);
    expect(edges.some((e) => e.kind === 'rule' && e.label === 'amount > 50000')).toBe(true);
    for (const e of edges) {
      expect(nodes.has(e.from)).toBe(true);
      expect(nodes.has(e.to)).toBe(true);
    }
  });
});

describe('ficha en HTML', () => {
  it('convierte títulos, citas, tablas, listas y negritas', () => {
    const html = mdToHtml(
      ['# Título', '', '> Versión 1.0', '', '## Sección', '', '**Objetivo:** algo | raro', '', '| A | B |', '|---|---|', '| 1 | dos \\| tres |', '', '- uno', '- dos'].join('\n'),
    );
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<h2>Sección</h2>');
    expect(html).toContain('<blockquote>Versión 1.0</blockquote>');
    expect(html).toContain('<b>Objetivo:</b>');
    expect(html).toContain('<th>A</th>');
    expect(html).toContain('<td>dos | tres</td>');
    expect(html).toContain('<ul><li>uno</li><li>dos</li></ul>');
  });

  it('escapa HTML del contenido del usuario', () => {
    const p = structuredClone(credito);
    ensureDoc(p).scope.objective = '<img src=x onerror=alert(1)>';
    const html = mdToHtml(fichaMarkdown(def, p));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('la ficha completa se convierte sin perder las secciones', () => {
    const html = mdToHtml(fichaMarkdown(def, credito));
    expect((html.match(/<h2>/g) ?? []).length).toBe(7); // 6 + procedimientos asociados (el ejemplo trae uno)
    expect(html).toContain('<table>');
  });
});
