import { defineConfig, devices } from '@playwright/test';

// E2E_PORT permite reutilizar un servidor ya levantado (por ejemplo, el de vite preview en otro puerto).
const PORT = Number(process.env.E2E_PORT ?? 4173);
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'movil',
      use: {
        ...devices['Pixel 7'],
        launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
      },
    },
    {
      name: 'escritorio',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Nunca se reutiliza un servidor ya abierto: cada prueba usa el build que se acaba de hacer.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
