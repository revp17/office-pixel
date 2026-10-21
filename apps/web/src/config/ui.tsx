import type { ComponentChildren } from 'preact';
import type { CompanyDef, DistSpec } from '@office-pixel/sim';
import { DAY_NAMES, DAY_TITLES, DIST_LABELS, defaultDist, distFields, getParam } from './model';

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

export function Text(p: { value: string; onChange: (v: string) => void; placeholder?: string; list?: string; class?: string }) {
  return (
    <input
      class={p.class}
      type="text"
      value={p.value}
      placeholder={p.placeholder}
      list={p.list}
      onInput={(e) => p.onChange(val(e))}
    />
  );
}

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
  return (
    <span class={`num ${p.class ?? ''}`}>
      <input
        type="number"
        value={p.value ?? ''}
        min={p.min}
        max={p.max}
        step={p.step ?? 1}
        placeholder={p.placeholder}
        onInput={(e) => {
          const v = val(e);
          p.onChange(v === '' ? undefined : Number(v));
        }}
      />
      {p.suffix && <i>{p.suffix}</i>}
    </span>
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
