import { useMemo, useState } from 'preact/hooks';
import { compareVariants, fichaMarkdown, type VariantRow } from '@office-pixel/sim';
import { Card } from '../config/ui';
import type { HubCtx } from './documentar';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])_(.+?)_(?=[\s).,;:]|$)/g, '$1<i>$2</i>');

/** Convierte el Markdown de la ficha (títulos, tablas, listas, citas, negritas) a HTML. */
export function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^# /.test(l)) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (/^## /.test(l)) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (/^> /.test(l)) out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`);
    else if (/^\|/.test(l)) {
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        if (!/^\|[-| :]+\|$/.test(lines[i])) rows.push(lines[i].replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim()));
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    } else if (/^- /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^- /.test(lines[i])) items.push(`<li>${inline(lines[i++].slice(2))}</li>`);
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    } else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return out.join('\n');
}

export function FichaView({ ctx }: { ctx: HubCtx }) {
  const [impact, setImpact] = useState<VariantRow[] | undefined>();
  const [busy, setBusy] = useState(false);
  const md = useMemo(() => fichaMarkdown(ctx.d, ctx.proc, impact), [ctx.d, ctx.proc, impact]);
  const html = useMemo(() => mdToHtml(md), [md]);
  const name = (ctx.proc.name ?? ctx.proc.id).replace(/[^\w-]+/g, '_');

  const download = () => {
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ficha_${name}${ctx.proc.doc?.version ? `_v${ctx.proc.doc.version}` : ''}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md);
      ctx.note('Ficha copiada al portapapeles.');
    } catch {
      ctx.note('No se pudo copiar. Usa «Descargar .md».');
    }
  };
  const withImpact = () => {
    setBusy(true);
    setTimeout(() => {
      try {
        setImpact(compareVariants(ctx.d, ctx.proc.id, ctx.sim));
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  return (
    <div class="form">
      <Card class="fichabar">
        <div class="inline wrapbtn">
          <button type="button" class="btn primary" onClick={download}>
            Descargar .md
          </button>
          <button type="button" class="btn" onClick={() => window.print()}>
            Imprimir / guardar en PDF
          </button>
          <button type="button" class="btn" onClick={copy}>
            Copiar Markdown
          </button>
          <button type="button" class="btn" disabled={busy} onClick={withImpact} title="Calcula con el simulador cada variante y la añade a la ficha">
            {busy ? 'Calculando…' : impact ? 'Actualizar comparación' : 'Incluir comparación de la optimización'}
          </button>
        </div>
        {!ctx.proc.doc?.approvedAt && <p class="hint">Esta ficha aún es un borrador: se aprueba en la fase 5 del ciclo de documentación.</p>}
      </Card>
      <article class="ficha-doc" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
