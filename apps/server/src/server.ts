import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api';
import { Store } from './store';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export const defaultDbPath = () => process.env.OFFICE_PIXEL_DB ?? join(root, 'data', 'office-pixel.db');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Arranca el servidor: la API y, si existe `apps/web/dist`, la aplicación ya compilada. */
export function start(port = Number(process.env.PORT ?? 3001), dbPath = defaultDbPath()) {
  const store = new Store(dbPath);
  const api = createApiHandler(store);
  const dist = join(root, 'apps', 'web', 'dist');

  const server = createServer(async (req, res) => {
    if (await api(req, res)) return;
    if (!existsSync(dist)) {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end('API de Office-Pixel activa. Para ver la aplicación: npm run dev (desarrollo) o npm run build y luego npm start.');
      return;
    }
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname));
    let file = join(dist, path);
    // nunca salir de la carpeta compilada
    if (file !== dist && !file.startsWith(dist + sep)) file = join(dist, 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dist, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  });
  server.listen(port, () => console.log(`Office-Pixel: http://localhost:${port}  ·  base de datos: ${store.path}`));
  return { server, store };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
