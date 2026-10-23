import { Persistence } from '../application/persistence';
import { db } from '../infrastructure/backend/db';
import { browserCache } from '../infrastructure/browserCache';

/** Raíz de composición: aquí se eligen las implementaciones concretas (Nhost o SQLite, y la copia local del navegador). */
export const backend = db;
export const persist = new Persistence(backend, browserCache());
