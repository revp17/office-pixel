import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const serverSrc = (file: string) => fileURLToPath(new URL(`../server/src/${file}`, import.meta.url));
const dbPath = () => process.env.OFFICE_PIXEL_DB ?? fileURLToPath(new URL('../../data/office-pixel.db', import.meta.url));

/**
 * En desarrollo, la API y la base de datos SQLite viven dentro del propio servidor de Vite
 * (un solo comando: `npm run dev`). En producción las sirve `npm start` (apps/server).
 * El código del servidor se carga con el transformador de Vite para que resuelva el paquete `sim`.
 */
function officePixelApi(): Plugin {
  return {
    name: 'office-pixel-api',
    async configureServer(server) {
      const { Store } = (await server.ssrLoadModule(serverSrc('store.ts'))) as typeof import('../server/src/store');
      const { createApiHandler } = (await server.ssrLoadModule(serverSrc('api.ts'))) as typeof import('../server/src/api');
      const store = new Store(dbPath());
      const api = createApiHandler(store);
      server.middlewares.use(async (req, res, next) => {
        try {
          if (!(await api(req, res))) next();
        } catch (e) {
          next(e);
        }
      });
      server.httpServer?.once('close', () => store.close());
      server.config.logger.info(`  base de datos: ${store.path}`);
    },
  };
}

export default defineConfig({
  plugins: [officePixelApi()],
  server: { port: 5173 },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { chunkSizeWarningLimit: 1500 },
});
