/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'Atenzo: tu entrenamiento diario de atención',
        short_name: 'Atenzo',
        description: 'Juegos breves para entrenar tu atención. Sin culpa, sin trampas, sin prisa.',
        lang: 'es',
        start_url: '/hoy',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#000000',
        categories: ['health', 'productivity', 'education'],
        // Accesos directos de la app instalada: mantener pulsado el icono.
        shortcuts: [
          {
            name: 'Sesión de hoy',
            short_name: 'Sesión',
            url: '/sesion',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Siguiente reto',
            short_name: 'Retos',
            url: '/retos',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Biblioteca',
            short_name: 'Biblioteca',
            url: '/biblioteca',
            icons: [{ src: '/pwa-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Las fuentes no se precargan: se piden solo los subconjuntos que se usan y se guardan en caché.
        globPatterns: ['**/*.{js,css,html,svg,png,webp}'],
        // El cliente de Supabase solo hace falta con cuenta: no se precarga en la instalación.
        // Solo la librería: el envoltorio de src/services/supabase.ts se importa al arrancar y debe precachearse.
        globIgnores: ['**/supabase-lib-*.js'],
        runtimeCaching: [
          {
            urlPattern: /\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fuentes',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        navigateFallback: '/index.html',
        // Las rutas de API y las de legal se sirven siempre desde red si hay conexión.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 250,
    rolldownOptions: {
      output: {
        // Separa las librerías grandes para que el HTML inicial pese lo mínimo posible.
        manualChunks(id: string) {
          if (id.includes('@supabase')) return 'supabase-lib';
          if (/node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Las pruebas de las funciones de Supabase (supabase/functions y supabase/tests) corren aquí también:
    // sus módulos puros no usan API de Deno, así que Vitest los importa sin red ni base.
    include: [
      'src/**/*.test.{ts,tsx}',
      'supabase/**/*.test.ts',
      'servidor/**/*.test.ts',
      'api/**/*.test.ts',
    ],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/data/**', 'src/services/**'],
    },
  },
});
