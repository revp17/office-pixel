import { dependentsOf, prerequisitesOf, procedureMarkdown, procedureStatus, type Procedure } from '@office-pixel/sim';
import { unitPath } from '@office-pixel/sim';
import { Card } from '../config/ui';
import type { HubCtx } from './documentar';
import { AnnotatedImage, TaskFlow, WarningBox } from './visuales';

/** Estilos del documento: se inyectan en la app y se incluyen en el HTML descargado. */
export const PROC_DOC_CSS = `
.proc-doc { background:#fff; color:#1a1f2b; padding:34px 40px; line-height:1.55; font:13.5px/1.55 'Segoe UI',system-ui,sans-serif; max-width:960px; border-radius:12px; }
.proc-doc h1 { font-size:23px; margin:0 0 6px; color:#0e1117; }
.proc-doc h2 { font-size:16px; margin:26px 0 8px; padding-bottom:4px; border-bottom:2px solid #5aa9ff; color:#0e1117; }
.proc-doc blockquote { margin:0 0 12px; padding:6px 12px; background:#eef4fd; border-left:3px solid #5aa9ff; color:#334; }
.proc-doc p { margin:6px 0; }
.proc-doc table { border-collapse:collapse; width:100%; margin:8px 0 14px; font-size:12px; }
.proc-doc th { background:#eef1f7; text-align:left; padding:6px 8px; border:1px solid #d5dbe8; }
.proc-doc td { padding:5px 8px; border:1px solid #d5dbe8; vertical-align:top; }
.proc-doc ol.steps { margin:8px 0; padding-left:22px; }
.proc-doc ol.steps > li { margin:0 0 16px; padding-left:4px; }
.proc-doc .st-main { font-size:14px; }
.proc-doc .st-meta { color:#44506a; font-size:12.5px; margin-top:2px; }
.proc-doc .alts { margin:6px 0 0 4px; padding-left:18px; font-size:12.5px; color:#2a3550; }
.proc-doc .warnbox { display:flex; flex-direction:column; gap:2px; margin:8px 0; padding:8px 12px; border:2px solid; border-radius:8px; font-size:12.5px; color:#1a1f2b; }
.proc-doc .annot { position:relative; max-width:620px; margin:8px 0 2px; border:1px solid #c9d2e6; border-radius:6px; overflow:hidden; }
.proc-doc .annot img { display:block; width:100%; height:auto; }
.proc-doc .annot svg { position:absolute; inset:0; width:100%; height:100%; }
.proc-doc .cap { font-size:11.5px; color:#55627f; margin:0 0 6px; }
.proc-doc .flowwrap { overflow:auto; border:1px solid #d5dbe8; border-radius:10px; background:#f7f9fd; padding:6px; margin:8px 0 14px; }
.proc-doc svg.flow .edge { stroke:#7a86a3; stroke-width:2; fill:none; }
.proc-doc svg.flow .arrow { fill:#7a86a3; }
.proc-doc svg.flow .fnode rect { fill:#fff; stroke:#b9c4dc; stroke-width:1.5; }
.proc-doc svg.flow .t1 { font:700 12px 'Segoe UI',sans-serif; fill:#1a1f2b; }
.proc-doc svg.flow .t1.small { font-size:11.5px; font-weight:600; }
.proc-doc svg.flow .t2 { font:600 10.5px 'Segoe UI',sans-serif; fill:#55627f; }
.proc-doc svg.flow .t3 { font:10.5px 'Segoe UI',sans-serif; fill:#55627f; }
.proc-doc svg.flow .stepnum { fill:#5aa9ff; }
.proc-doc svg.flow .stepnum-t { font:800 11px 'Segoe UI',sans-serif; fill:#fff; }
.proc-doc .small { font-size:12px; color:#55627f; }
`;

if (typeof document !== 'undefined' && !document.getElementById('proc-doc-css')) {
  const s = document.createElement('style');
  s.id = 'proc-doc-css';
  s.textContent = PROC_DOC_CSS;
  document.head.appendChild(s);
}

const SIGN: Record<string, string> = { pendiente: 'Pendiente', conforme: 'Conforme', observado: 'Con observaciones' };

export function ProcDoc({ ctx, pc }: { ctx: HubCtx; pc: Procedure }) {
  const { d, proc } = ctx;
  const stage = proc.stages.find((s) => s.id === pc.stageId);
  const tricks = pc.fieldwork.flatMap((f) => f.tricks.filter((t) => t.trim()));
  const file = pc.code + (pc.version ? `_v${pc.version}` : '');

  const download = (content: string, name: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const html = () => {
    const el = document.querySelector('.proc-doc');
    if (!el) return;
    download(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${pc.code} — ${pc.title.replace(/</g, '&lt;')}</title><style>body{margin:24px;background:#eef1f7}${PROC_DOC_CSS}</style></head><body>${el.outerHTML}</body></html>`,
      `${file}.html`,
      'text/html;charset=utf-8',
    );
  };
  const md = () => download(procedureMarkdown(d, proc, pc), `${file}.md`, 'text/markdown;charset=utf-8');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(procedureMarkdown(d, proc, pc));
      ctx.note('Markdown copiado al portapapeles.');
    } catch {
      ctx.note('No se pudo copiar. Usa «Descargar .md».');
    }
  };

  return (
    <div class="form">
      <Card class="fichabar">
        <div class="inline wrapbtn">
          <button type="button" class="btn primary" onClick={html} title="Documento autocontenido, con las capturas y sus marcas">
            Descargar .html
          </button>
          <button type="button" class="btn" onClick={() => window.print()}>
            Imprimir / guardar en PDF
          </button>
          <button type="button" class="btn" onClick={md}>
            Descargar .md
          </button>
          <button type="button" class="btn" onClick={copy}>
            Copiar Markdown
          </button>
        </div>
        <p class="hint">El .html incluye las capturas con sus flechas y círculos; el .md solo lleva el texto.</p>
      </Card>

      <article class="proc-doc">
        <h1>
          {pc.code} — {pc.title}
        </h1>
        <blockquote>
          Versión {pc.version ?? 'borrador'}
          {pc.approvedAt ? ` · publicado el ${pc.approvedAt}` : ' · aún sin publicar'} · Proceso: {proc.name ?? proc.id}
          {stage ? ` · Etapa: ${stage.label ?? stage.id} (${unitPath(d, stage.unit)})` : ''}
        </blockquote>

        <h2>1. Objetivo y alcance</h2>
        <p>
          <b>Objetivo:</b> {pc.objective?.trim() || <i>Sin definir</i>}
        </p>
        <p>
          <b>Inicia cuando:</b> {pc.startsWhen?.trim() || <i>Sin definir</i>}
        </p>
        <p>
          <b>Termina cuando:</b> {pc.endsWhen?.trim() || <i>Sin definir</i>}
        </p>
        {pc.includes?.trim() && (
          <p>
            <b>Incluye:</b> {pc.includes}
          </p>
        )}
        {pc.excludes?.trim() && (
          <p>
            <b>No incluye:</b> {pc.excludes}
          </p>
        )}

        {prerequisitesOf(d, pc).length > 0 && (
          <>
            <p>
              <b>Requisitos previos</b> (procedimientos que deben estar hechos antes):
            </p>
            <ul>
              {prerequisitesOf(d, pc).map((r) => (
                <li key={r.pc.id}>
                  {r.pc.code} — {r.pc.title} ({r.proc.name ?? r.proc.id}, {procedureStatus(r.pc) === 'publicado' ? `v${r.pc.version}` : 'borrador'})
                </li>
              ))}
            </ul>
          </>
        )}
        {dependentsOf(d, pc).length > 0 && (
          <>
            <p>
              <b>Lo necesitan después:</b>
            </p>
            <ul>
              {dependentsOf(d, pc).map((r) => (
                <li key={r.pc.id}>
                  {r.pc.code} — {r.pc.title} ({r.proc.name ?? r.proc.id})
                </li>
              ))}
            </ul>
          </>
        )}

        <h2>2. Responsabilidades</h2>
        {pc.responsibilities.length === 0 ? (
          <p>
            <i>Sin responsabilidades definidas.</i>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Puesto</th>
                <th>Responsabilidad</th>
              </tr>
            </thead>
            <tbody>
              {pc.responsibilities.map((r, i) => (
                <tr key={i}>
                  <td>{r.role}</td>
                  <td>{r.description || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>3. Definiciones y glosario</h2>
        {pc.glossary.filter((g) => g.term).length === 0 ? (
          <p>
            <i>{pc.noGlossary ? 'No hay términos que requieran explicación.' : 'Sin términos definidos.'}</i>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Término</th>
                <th>Definición</th>
              </tr>
            </thead>
            <tbody>
              {pc.glossary
                .filter((g) => g.term)
                .map((g, i) => (
                  <tr key={i}>
                    <td>{g.term}</td>
                    <td>{g.definition}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        <h2>4. Desarrollo paso a paso</h2>
        {pc.steps.length > 0 && <TaskFlow steps={pc.steps} />}
        <ol class="steps">
          {pc.steps.map((s) => (
            <li key={s.id}>
              <div class="st-main">
                <b>{s.actor || '—'}</b> — {s.action || '—'}
              </div>
              {(s.tool || s.result) && (
                <div class="st-meta">
                  {s.tool ? <span>Herramienta: {s.tool}. </span> : null}
                  {s.result ? <span>Resultado esperado: {s.result}.</span> : null}
                </div>
              )}
              {s.warning && s.warning.text && <WarningBox warning={s.warning} />}
              {s.alternatives.length > 0 && (
                <ul class="alts">
                  {s.alternatives.map((a) => (
                    <li key={a.id}>
                      <b>Si</b> {a.condition || '…'}: {a.action || '…'}
                    </li>
                  ))}
                </ul>
              )}
              {s.image && (
                <>
                  <AnnotatedImage image={s.image} />
                  {s.image.caption && <p class="cap">{s.image.caption}</p>}
                </>
              )}
            </li>
          ))}
        </ol>
        {pc.steps.length === 0 && (
          <p>
            <i>Sin pasos.</i>
          </p>
        )}

        <h2>5. Anexos y control de cambios</h2>
        {pc.annexes.length > 0 && (
          <ul>
            {pc.annexes.map((a) => (
              <li key={a.id}>
                {a.title} <span class="small">({a.kind})</span>
                {a.url ? ` — ${a.url}` : ''}
              </li>
            ))}
          </ul>
        )}
        {tricks.length > 0 && (
          <>
            <p>
              <b>Trucos operativos recogidos:</b>
            </p>
            <ul>
              {tricks.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </>
        )}
        {pc.changes.length === 0 ? (
          <p>
            <i>Sin historial de versiones.</i>
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Versión</th>
                <th>Fecha</th>
                <th>Descripción del cambio</th>
              </tr>
            </thead>
            <tbody>
              {pc.changes.map((c) => (
                <tr key={c.version}>
                  <td>{c.version}</td>
                  <td>{c.date}</td>
                  <td>{c.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <h2>6. Validación</h2>
        {pc.attempts.length > 0 && (
          <>
            <p>
              <b>Prueba del novato</b>
            </p>
            <table>
              <thead>
                <tr>
                  <th>Quién</th>
                  <th>Fecha</th>
                  <th>¿Terminó la tarea?</th>
                  <th>Preguntas</th>
                  <th>Notas</th>
                </tr>
              </thead>
              <tbody>
                {pc.attempts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.tester || '—'}</td>
                    <td>{a.date || '—'}</td>
                    <td>{a.completed ? 'Sí' : 'No'}</td>
                    <td>{a.questions}</td>
                    <td>{a.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {pc.signoffs.length > 0 && (
          <>
            <p>
              <b>Conformidad del ejecutor</b>
            </p>
            <table>
              <thead>
                <tr>
                  <th>Operador</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {pc.signoffs.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{SIGN[s.status]}</td>
                    <td>{s.date || '—'}</td>
                    <td>{s.comment || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {pc.attempts.length === 0 && pc.signoffs.length === 0 && (
          <p>
            <i>Sin validar.</i>
          </p>
        )}
      </article>
    </div>
  );
}
