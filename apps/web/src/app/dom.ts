/** Los elementos fijos de index.html que usa la aplicación. */
export const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const dom = {
  seed: $<HTMLInputElement>('seed'),
  days: $<HTMLInputElement>('days'),
  configRoot: $<HTMLDivElement>('config-root'),
  hubRoot: $<HTMLDivElement>('hub-root'),
  previewBanner: $<HTMLDivElement>('preview-banner'),
  previewText: $<HTMLSpanElement>('preview-text'),
  play: $<HTMLButtonElement>('play'),
  speed: $<HTMLSelectElement>('speed'),
  mode: $<HTMLSelectElement>('mode'),
  step: $<HTMLButtonElement>('step'),
  timeline: $<HTMLInputElement>('timeline'),
  clock: $<HTMLSpanElement>('clock'),
  fill: $<HTMLDivElement>('progress-fill'),
  progressText: $<HTMLSpanElement>('progress-text'),
  kpis: $<HTMLElement>('kpis'),
  units: $<HTMLElement>('units'),
  people: $<HTMLElement>('people'),
  detail: $<HTMLElement>('detail'),
  chips: $<HTMLDivElement>('floors'),
  game: $<HTMLElement>('game'),
};
