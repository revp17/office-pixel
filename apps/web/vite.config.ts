import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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

/**
 * PWA: instalable y con la aplicación (HTML, JS, CSS, iconos) guardada para abrir sin conexión.
 * Los datos NO pasan por el service worker: Nhost y /api siempre van a la red, nunca se sirven de caché.
 */
const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['apple-touch-icon.png'],
  manifest: {
    name: 'Office-Pixel',
    short_name: 'Office-Pixel',
    description: 'Simulador visual de una empresa virtual: áreas, personas y procesos.',
    lang: 'es',
    theme_color: '#1f2937',
    background_color: '#1f2937',
    display: 'standalone',
    start_url: '/',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\//],
    cleanupOutdatedCaches: true,
  },
});

export default defineConfig({
  plugins: [officePixelApi(), pwa],
  server: { port: 5173 },
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  build: { chunkSizeWarningLimit: 1500 },
});
