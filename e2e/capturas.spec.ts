import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';

/**
 * Capturas PNG de las pantallas clave, solo con CAPTURAS=1 y una carpeta existente en CAPTURAS_DIR. Las capturas no van al
 * repo. El proyecto «movil» guarda a 390 px y el «escritorio» a 1440 px, así que las dos pasadas dan los dos anchos.
 * Las capturas con nube (@nube) necesitan el build con nube; sus peticiones a Supabase se simulan.
 */

const CARPETA = process.env.CAPTURAS_DIR ?? '';
const SUPABASE = 'https://proyecto-de-prueba.supabase.co';
/** supabase-js guarda la sesión en `sb-<primer subdominio de la URL>-auth-token`. */
const CLAVE_SESION = 'sb-proyecto-de-prueba-auth-token';
const CORREO = 'correo@example.com';
const USUARIO = 'b7e4c2a1-3d5f-4a8e-8c6b-2e9f0d1a7c33';

/** Abre la ruta, espera a que `listo` confirme el contenido y solo entonces fotografía. */
async function capturar(
  page: Page,
  testInfo: TestInfo,
  ruta: string,
  nombre: string,
  listo: () => Promise<void>,
): Promise<void> {
  const ancho = testInfo.project.name === 'movil' ? 390 : 1440;
  await page.setViewportSize({ width: ancho, height: ancho === 390 ? 844 : 900 });
  await page.goto(ruta);
  await listo();
  await page.screenshot({
    path: join(CARPETA, `${nombre}-${String(ancho)}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

function codificar(objeto: object): string {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
}

function usuario() {
  return {
    id: USUARIO,
    aud: 'authenticated',
    role: 'authenticated',
    email: CORREO,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    factors: [],
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

/** Sesión falsa (supabase-js no verifica la firma en el cliente). El `aal` del token decide el segundo factor. */
async function conectarSesion(page: Page, aal: 'aal1' | 'aal2'): Promise<void> {
  const ahora = Math.floor(Date.now() / 1000);
  const expira = ahora + 3600;
  const token = [
    codificar({ alg: 'HS256', typ: 'JWT' }),
    codificar({
      sub: USUARIO,
      email: CORREO,
      role: 'authenticated',
      aud: 'authenticated',
      aal,
      amr: [{ method: 'otp', timestamp: ahora }],
      iat: ahora,
      exp: expira,
    }),
    'firma-de-prueba',
  ].join('.');
  const sesion = {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expira,
    refresh_token: 'refresco-de-prueba',
    user: usuario(),
  };
  await page.addInitScript(
    ({ clave, valor }: { clave: string; valor: string }) => {
      if (window.sessionStorage.getItem('e2e-sesion')) return;
      window.localStorage.setItem(clave, valor);
      window.sessionStorage.setItem('e2e-sesion', '1');
    },
    { clave: CLAVE_SESION, valor: JSON.stringify(sesion) },
  );
}

async function responder(ruta: Route, estado: number, cuerpo?: unknown): Promise<void> {
  await ruta.fulfill({
    status: estado,
    headers: { 'access-control-allow-origin': '*' },
    contentType: 'application/json',
    body: cuerpo === undefined ? '' : JSON.stringify(cuerpo),
  });
}

/** Respuestas fijas de Supabase para las capturas con nube. Lo que no está simulado se corta. */
async function simularSupabase(
  page: Page,
  administradora: boolean,
  accesos: unknown[],
): Promise<void> {
  const ahora = Date.now();
  const hace = (dias: number): string => new Date(ahora - dias * 86_400_000).toISOString();
  await page.route(`${SUPABASE}/**`, async (ruta) => {
    const peticion = ruta.request();
    const { pathname } = new URL(peticion.url());
    if (peticion.method() === 'OPTIONS') {
      await ruta.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
          'access-control-allow-headers':
            peticion.headers()['access-control-request-headers'] ?? '*',
        },
      });
      return;
    }
    if (pathname.endsWith('/auth/v1/user')) {
      await responder(ruta, 200, usuario());
      return;
    }
    if (pathname.endsWith('/auth/v1/logout')) {
      await responder(ruta, 204);
      return;
    }
    if (pathname.endsWith('/rest/v1/accesos')) {
      await responder(ruta, 200, accesos);
      return;
    }
    if (pathname.endsWith('/rest/v1/rpc/soy_administrador')) {
      await responder(ruta, 200, administradora);
      return;
    }
    if (pathname.endsWith('/rest/v1/compras')) {
      await responder(ruta, 200, [
        {
          id_hotmart: 'HP-100001-ABCDEF',
          plan: 'mensual',
          monto_usd: 5.99,
          estado: 'aprobada',
          correo: CORREO,
          creado_en: hace(1),
        },
        {
          id_hotmart: 'HP-100002-GHIJKL',
          plan: 'anual',
          monto_usd: 59.9,
          estado: 'aprobada',
          correo: CORREO,
          creado_en: hace(2),
        },
      ]);
      return;
    }
    if (pathname.endsWith('/rest/v1/eventos_app')) {
      await responder(ruta, 200, [
        {
          tipo: 'portada_vista',
          dispositivo: '3f2c9c1e-7a1b-4d7e-9b7a-2f6d1e0c9a11',
          creado_en: hace(1),
        },
      ]);
      return;
    }
    if (pathname.endsWith('/rest/v1/eventos_pago')) {
      await responder(ruta, 200, [
        { id_evento: 'EV-900001', estado: 'procesado', recibido_en: hace(1) },
      ]);
      return;
    }
    await ruta.abort();
  });
}

test.describe('capturas de pantalla', () => {
  test.skip(process.env.CAPTURAS !== '1', 'Las capturas solo se hacen con CAPTURAS=1');
  test.skip(
    CARPETA === '' || !existsSync(CARPETA),
    'Define CAPTURAS_DIR con una carpeta que exista. Las capturas no van al repo.',
  );

  test('portada', async ({ page }, testInfo) => {
    await capturar(page, testInfo, '/', 'portada', () =>
      expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
    );
  });

  test('onboarding: primer paso de /onboarding', async ({ page }, testInfo) => {
    await capturar(page, testInfo, '/onboarding', 'onboarding', () =>
      expect(
        page.getByRole('heading', { level: 2, name: /¿Para qué quieres entrenar tu atención\?/ }),
      ).toBeVisible(),
    );
  });

  test('precios', async ({ page }, testInfo) => {
    await capturar(page, testInfo, '/precios', 'precios', () =>
      expect(page.getByRole('heading', { level: 1 })).toContainText('Prueba 7 días'),
    );
  });

  test.describe('capturas con nube @nube', () => {
    test('@nube /entrar con el formulario del correo', async ({ page }, testInfo) => {
      await simularSupabase(page, false, []);
      await capturar(page, testInfo, '/entrar', 'entrar-nube', () =>
        expect(page.getByLabel('Correo de tu compra')).toBeVisible(),
      );
    });

    test('@nube /entrar/confirmar con sesión y acceso, mientras se comprueba', async ({
      page,
    }, testInfo) => {
      await conectarSesion(page, 'aal1');
      await simularSupabase(page, false, [{ estado: 'activo' }]);
      // La respuesta de accesos se retiene para fotografiar «Comprobando tu acceso…» antes de la redirección a Hoy.
      let liberar: () => void = () => undefined;
      const retenida = new Promise<void>((resolver) => {
        liberar = () => {
          resolver();
        };
      });
      await page.route(`${SUPABASE}/rest/v1/accesos**`, async (ruta) => {
        await retenida;
        await responder(ruta, 200, [{ estado: 'activo' }]);
      });

      await capturar(page, testInfo, '/entrar/confirmar', 'entrar-confirmar-nube', () =>
        expect(page.getByText('Comprobando tu acceso…')).toBeVisible(),
      );
      liberar();
      // Se espera a que la confirmación termine (sale de /entrar/confirmar) antes de cerrar la prueba.
      await expect(page).not.toHaveURL(/\/entrar\/confirmar$/);
    });

    test('@nube /sin-compra con sesión sin compra', async ({ page }, testInfo) => {
      await conectarSesion(page, 'aal1');
      await simularSupabase(page, false, []);
      await capturar(page, testInfo, '/sin-compra', 'sin-compra-nube', () =>
        expect(page.getByText('No encontramos una compra activa con este correo.')).toBeVisible(),
      );
    });

    test('@nube panel: Hoy de la administradora con segundo factor', async ({ page }, testInfo) => {
      await conectarSesion(page, 'aal2');
      await simularSupabase(page, true, []);
      await capturar(page, testInfo, '/admin', 'panel-nube', () =>
        expect(page.getByRole('heading', { level: 2, name: 'Requiere atención' })).toBeVisible(),
      );
    });
  });
});
