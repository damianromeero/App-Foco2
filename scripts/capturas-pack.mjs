// Genera las tres capturas del pack de la plantilla: 390×844 px, en JPG.
// Uso: node scripts/capturas-pack.mjs --salida <carpeta> [--url http://localhost:3716] [--slug neuroestimulacion]
// Antes, sirve la compilación de producción en --url (npm run build && npm run preview -- --port 3716 --strictPort).
// Las cifras de ejemplo de la captura se quedan. Los avisos con data-captura="oculto" solo se ocultan aquí:
// la app real los sigue mostrando.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values } = parseArgs({
  options: {
    salida: { type: 'string' },
    url: { type: 'string', default: 'http://localhost:3716' },
    slug: { type: 'string', default: 'neuroestimulacion' },
  },
});

if (!values.salida) {
  console.error('Falta --salida <carpeta>.');
  process.exit(1);
}

const VIEWPORT = { width: 390, height: 844 };
const OCULTOS = '[data-captura="oculto"] { display: none !important; }';
const PALABRAS_PROHIBIDAS = /\bdemo\b|ejemplo|demostraci/i;
const CLAVE_ALMACENAMIENTO = 'foco5';

/** Clave de fecha local, igual que la app: AAAA-MM-DD. */
function claveDia(fecha) {
  const dos = (numero) => String(numero).padStart(2, '0');
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Estado de ejemplo para la pantalla Hoy: seis días seguidos entrenados y un bloque de foco. */
function estadoDeEjemplo() {
  const hoy = new Date();
  const dia = (atras, hora = 19) =>
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - atras, hora, 30);
  const precision = [0.82, 0.88, 0.79, 0.91, 0.86, 0.9];
  const sessions = precision.map((accuracy, index) => {
    const fecha = dia(6 - index);
    return {
      dateKey: claveDia(fecha),
      completedAt: fecha.toISOString(),
      durationSec: 300,
      games: ['vigilancia', 'semaforo', 'stroop'].map((gameId, orden) => ({
        gameId,
        level: orden === 0 ? 4 : 3,
        accuracy,
        medianRtMs: 520 + orden * 40 + index * 6,
        scorable: 20,
        correct: Math.round(accuracy * 20),
        calm: false,
        completedAt: fecha.toISOString(),
      })),
      reflection: { mood: 'calmado', phoneUse: '30-60' },
    };
  });
  const foco = dia(2, 20);
  return {
    onboardedAt: dia(7, 10).toISOString(),
    goal: 'concentrarme',
    displayName: 'Lucía',
    settings: {},
    baseline: null,
    levels: { vigilancia: 4, semaforo: 4, stroop: 3 },
    lastPlayed: {
      vigilancia: claveDia(dia(1)),
      semaforo: claveDia(dia(1)),
      stroop: claveDia(dia(1)),
    },
    sessions,
    focusSessions: [
      {
        id: 'foco-captura-1',
        dateKey: claveDia(foco),
        startedAt: foco.toISOString(),
        plannedMinutes: 15,
        focusedSeconds: 900,
        exits: 1,
      },
    ],
    lessonsRead: [],
    habitChecks: {},
    dailyPlan: null,
    demoBilling: null,
  };
}

const browser = await chromium.launch();
const zonaHoraria = Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Contexto aislado de móvil, con reducción de movimiento y sin service worker. */
async function nuevoContexto() {
  return browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'es-ES',
    timezoneId: zonaHoraria,
    serviceWorkers: 'block',
  });
}

/** Oculta solo los avisos marcados, comprueba que no quede ninguna palabra prohibida y guarda el JPG. */
async function fotografiar(pagina, nombre) {
  await pagina.addStyleTag({ content: OCULTOS });
  await pagina.evaluate(() => document.fonts.ready);
  const texto = await pagina.evaluate(() => document.body.innerText);
  const hallazgo = texto.match(PALABRAS_PROHIBIDAS);
  if (hallazgo) throw new Error(`${nombre}: aparece «${hallazgo[0]}» en la captura`);
  const ruta = join(values.salida, `${values.slug}-${nombre}.jpg`);
  await pagina.screenshot({ path: ruta, type: 'jpeg', quality: 92, animations: 'disabled' });
  console.log(`Captura guardada: ${ruta}`);
}

try {
  await mkdir(values.salida, { recursive: true });

  // 1. Portada: primer pliegue de la landing.
  const contextoVenta = await nuevoContexto();
  const venta = await contextoVenta.newPage();
  await venta.goto(`${values.url}/`, { waitUntil: 'networkidle' });
  await venta
    .getByRole('heading', { level: 1, name: 'Entrena tu atención en 5 minutos al día.' })
    .waitFor();
  await venta.waitForFunction(() => {
    const imagen = document.querySelector('img[src="/captura-hoy.webp"]');
    return imagen instanceof HTMLImageElement && imagen.complete && imagen.naturalWidth > 0;
  });
  await fotografiar(venta, '1-venta');
  await contextoVenta.close();

  // 2. Inicio: primer paso del onboarding, con el almacenamiento vacío.
  const contextoInicio = await nuevoContexto();
  const inicio = await contextoInicio.newPage();
  await inicio.goto(`${values.url}/onboarding`, { waitUntil: 'networkidle' });
  await inicio.getByRole('heading', { level: 2, name: /¿Para qué quieres entrenar/ }).waitFor();
  await fotografiar(inicio, '2-onboarding');
  await contextoInicio.close();

  // 3. App: Hoy con datos de ejemplo. El estado se escribe en el almacenamiento antes de entrar.
  const contextoApp = await nuevoContexto();
  const app = await contextoApp.newPage();
  await app.goto(`${values.url}/robots.txt`);
  await app.evaluate(
    ([clave, estado]) => {
      window.localStorage.setItem(clave, JSON.stringify({ state: estado, version: 1 }));
    },
    [CLAVE_ALMACENAMIENTO, estadoDeEjemplo()],
  );
  await app.goto(`${values.url}/hoy`, { waitUntil: 'networkidle' });
  await app.getByRole('heading', { level: 1, name: /Bienvenido/ }).waitFor();
  await app.waitForTimeout(1000);
  await fotografiar(app, '3-app');
  await contextoApp.close();
} finally {
  await browser.close();
}
