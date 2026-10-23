import type { LocalCache } from '../application/ports';

/** Copia local en el navegador (localStorage). Si no hay almacenamiento, no falla: simplemente no guarda. */
export function browserCache(key = 'office-pixel.company.v1'): LocalCache {
  return {
    read() {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(text) {
      try {
        localStorage.setItem(key, text);
      } catch {
        /* sin espacio o sin almacenamiento: la base de datos es la que manda */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* sin almacenamiento */
      }
    },
  };
}

/** Copia en memoria (para pruebas o si no hay navegador). */
export function memoryCache(initial: string | null = null): LocalCache {
  let value = initial;
  return {
    read: () => value,
    write: (t) => void (value = t),
    clear: () => void (value = null),
  };
}
