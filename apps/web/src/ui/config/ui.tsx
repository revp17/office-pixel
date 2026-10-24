import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { CompanyDef, DistSpec } from '@office-pixel/sim';
import { DAY_NAMES, DAY_TITLES, DIST_LABELS, defaultDist, distFields, getParam, isNumText, parseNumText } from '../../application/editing/model';

export type Up = (fn: (d: CompanyDef) => void) => void;
export interface TabProps {
  d: CompanyDef;
  up: Up;
  note: (msg: string) => void;
}

const val = (e: Event) => (e.target as HTMLInputElement).value;

export function Field(p: { label: string; hint?: string; children: ComponentChildren; grow?: boolean }) {
  return (
    <label class={`field${p.grow ? ' grow' : ''}`}>
      <span class="lbl">{p.label}</span>
      {p.children}
      {p.hint && <span class="hint">{p.hint}</span>}
    </label>
  );
}

export function Section(p: { title: string; hint?: string; action?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="sect">
      <header>
        <h4>{p.title}</h4>
        {p.action}
      </header>
      {p.hint && <p class="sect-hint">{p.hint}</p>}
      {p.children}
    </section>
  );
}

export function Card(p: { title?: ComponentChildren; actions?: ComponentChildren; children: ComponentChildren; class?: string }) {
  return (
    <div class={`card ${p.class ?? ''}`}>
      {(p.title || p.actions) && (
        <div class="card-head">
          <div class="card-title">{p.title}</div>
          <div class="card-actions">{p.actions}</div>
        </div>
      )}
      {p.children}
    </div>
  );
}

export function Text(p: { value: string; onChange: (v: string) => void; placeholder?: string; list?: string; class?: string; maxLength?: number }) {
  return (
    <input
      class={p.class}
      type="text"
      value={p.value}
      placeholder={p.placeholder}
      list={p.list}
      maxLength={p.maxLength}
      onInput={(e) => p.onChange(val(e))}
    />
  );
}

export function TextArea(p: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number }) {
  return (
    <textarea
      class="ta"
      rows={p.rows ?? 3}
      value={p.value}
      placeholder={p.placeholder}
      maxLength={p.maxLength}
      onInput={(e) => p.onChange((e.target as HTMLTextAreaElement).value)}
    />
  );
}

/**
 * Número editable. Mientras se escribe se conserva el texto tal cual («0.», vacío, «-»…) y el valor se
 * aplica en cuanto es un número; al salir del campo se ajusta a los límites y se muestra limpio.
 * Admite coma decimal y las flechas ↑ ↓ cambian el valor en el paso indicado.
 */
export function Num(p: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  class?: string;
}) {
  const [text, setText] = useState<string | null>(null); // null = no se está editando
  const shown = text ?? (p.value === undefined ? '' : String(p.value));
  const clamp = (n: number) => Math.min(p.max ?? Infinity, Math.max(p.min ?? -Infinity, n));
  return (
    <span class={`num ${p.class ?? ''}`}>
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder={p.placeholder}
        onInput={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          if (!isNumText(el.value)) {
            el.value = shown; // un carácter que no es de un número: se descarta
            return;
          }
          setText(el.value);
          p.onChange(parseNumText(el.value));
        }}
        onBlur={() => {
          const n = parseNumText(text ?? '');
          if (n !== undefined && clamp(n) !== n) p.onChange(clamp(n));
          setText(null);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const step = p.step ?? 1;
          const n = clamp(Math.round(((parseNumText(shown) ?? 0) + (e.key === 'ArrowUp' ? step : -step)) * 1e6) / 1e6);
          setText(String(n));
          p.onChange(n);
        }}
      />
      {p.suffix && <i>{p.suffix}</i>}
    </span>
  );
}

/**
 * Nombre que se confirma al salir del campo (o con Enter), para no renombrar con cada tecla.
 * `onCommit` devuelve un texto de error si el nombre no vale; entonces se vuelve al anterior.
 */
export function NameInput(p: { value: string; onCommit: (v: string) => string | void; placeholder?: string; maxLength?: number }) {
  const [draft, setDraft] = useState(p.value);
  useEffect(() => setDraft(p.value), [p.value]);
  const commit = () => {
    if (draft === p.value) return;
    const err = p.onCommit(draft);
    if (err) setDraft(p.value);
  };
  return (
    <input
      type="text"
      value={draft}
      placeholder={p.placeholder}
      maxLength={p.maxLength}
      onInput={(e) => setDraft((e.currentTarget as HTMLInputElement).value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(p.value);
      }}
    />
  );
}

/** Guarda una fracción (0–1) y la muestra como porcentaje. */
export function Pct(p: { value: number | undefined; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <Num
      value={p.value === undefined ? undefined : Math.round(p.value * 1000) / 10}
      min={0}
      max={100}
      step={0.5}
      suffix="%"
      placeholder={p.placeholder}
      onChange={(v) => p.onChange(v === undefined ? undefined : Math.min(100, Math.max(0, v)) / 100)}
    />
  );
}

export function Sel(p: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  class?: string;
}) {
  const known = p.options.some((o) => o.value === p.value);
  return (
    <select class={p.class} value={p.value} onChange={(e) => p.onChange(val(e))}>
      {!known && <option value={p.value}>{p.value === '' ? '— elegir —' : `${p.value} (no existe)`}</option>}
      {p.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Time(p: { value: string; onChange: (v: string) => void }) {
  return <input type="time" value={p.value} onInput={(e) => p.onChange(val(e))} />;
}

export function Days(p: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <span class="days">
      {DAY_NAMES.map((n, i) => {
        const on = p.value.includes(i);
        return (
          <button
            key={i}
            type="button"
            title={DAY_TITLES[i]}
            class={`daychip${on ? ' on' : ''}`}
            onClick={() => p.onChange(on ? p.value.filter((x) => x !== i) : [...p.value, i].sort())}
          >
            {n}
          </button>
        );
      })}
    </span>
  );
}

export function IconBtn(p: { title: string; onClick: () => void; children: ComponentChildren; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" class={`ibtn${p.danger ? ' danger' : ''}`} title={p.title} disabled={p.disabled} onClick={p.onClick}>
      {p.children}
    </button>
  );
}

export function AddBtn(p: { onClick: () => void; children: ComponentChildren }) {
  return (
    <button type="button" class="addbtn" onClick={p.onClick}>
      + {p.children}
    </button>
  );
}

/** Editor de una distribución (tiempo o dato numérico). */
export function DistEditor(p: { spec: DistSpec; minutes: boolean; onChange: (s: DistSpec) => void }) {
  const fields = distFields(p.spec.dist, p.minutes);
  return (
    <span class="dist">
      <Sel
        value={p.spec.dist}
        options={(Object.keys(DIST_LABELS) as Array<DistSpec['dist']>).map((k) => ({ value: k, label: DIST_LABELS[k] }))}
        onChange={(v) => p.onChange(defaultDist(v as DistSpec['dist'], p.minutes))}
      />
      {fields.map((f) => (
        <label key={f.key} class="mini">
          {f.label}
          <Num
            value={getParam(p.spec, f.key, f.alt)}
            min={0}
            step={f.key === 'sigma' ? 0.05 : 1}
            suffix={p.minutes && f.key !== 'sigma' ? 'min' : undefined}
            onChange={(v) => {
              const next: DistSpec = { ...p.spec };
              delete next[f.alt];
              next[f.key] = v ?? 0;
              p.onChange(next);
            }}
          />
        </label>
      ))}
    </span>
  );
}
