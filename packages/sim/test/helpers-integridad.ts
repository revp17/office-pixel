import type { CompanyDef } from '../src';

/** Una empresa mínima y válida para probar limpiezas de referencias. */
export function emptyDef(): CompanyDef {
  return {
    company: 'Mínima',
    calendar: { workDays: [0, 1, 2, 3, 4], hours: { start: '09:00', end: '18:00' } },
    units: [{ id: 'a', name: 'A' }],
    people: [{ id: 'p', name: 'P', unit: 'a', role: 'r' }],
    processes: [
      {
        id: 'x',
        name: 'X',
        arrivals: { type: 'constant', everyMinutes: 30 },
        stages: [
          { id: 's1', unit: 'a', role: 'r', duration: { dist: 'fixed', value: 5 }, next: 's2' },
          { id: 's2', terminal: true },
        ],
      },
    ],
  };
}
