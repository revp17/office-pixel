// Interfaz pública del paquete `@office-pixel/sim`. Las capas, de abajo arriba:
//   kernel      → matemática y utilidades puras (azar con semilla, distribuciones, expresiones, calendario)
//   model       → los tipos del dominio (empresa, procesos, procedimientos, eventos), sin lógica
//   company     → reglas de la empresa: validación, YAML, instalaciones y objetos de las salas
//   simulation  → motor de eventos discretos y reproductor del registro de eventos
//   process     → gestión de procesos: dependencias, documentación, optimización, procedimientos y fichas

// kernel
export type { DistSpec } from './kernel/dist';
export { compileExpr } from './kernel/expr';
export { mulberry32 } from './kernel/rng';
export { makeBizCalendar, parseHM, DAY } from './kernel/time';

// model
export * from './model';

// company
export { parseCompany, validateCompany, normalizeCompany, MAX_FACILITY_LABEL, MAX_FACILITY_ICON, MAX_FACILITY_DESCRIPTION, type CompanyParseResult } from './company/validate';
export { companyToYaml } from './company/yaml';
export * from './company/facilities';
export * from './company/decor';

// simulation
export { simulateCompany } from './simulation/engine';
export { OrgReplayer, type OrgCaseView, type OrgCaseStatus, type PersonView, type OrgCounters } from './simulation/replay';

// process
export * from './process/manage';
export { fichaMarkdown } from './process/ficha';
export * from './process/procedures';
export * from './process/deps';
