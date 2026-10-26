import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Acceso de compradoras. Sin nube (@demo): /entrar y /login llevan a la app sin avisos ni envíos, y la app abre sin pedir
 * acceso.
 * Con nube (@nube): TODAS las peticiones a Supabase se simulan con page.route; ninguna llega a un servicio real. La
 * pasada nube compila con VITE_SUPABASE_URL=https://proyecto-de-prueba.supabase.co y VITE_ENLACE_COMPRA (ver abajo).
 */

const SUPABASE = 'https://proyecto-de-prueba.supabase.co';
/** supabase-js guarda la sesión en `sb-<primer subdominio de la URL>-auth-token` (supabase-js, `defaultStorageKey`). */
const CLAVE_SESION = 'sb-proyecto-de-prueba-auth-token';
const CORREO = 'correo@example.com';
const USUARIO = '3c1e7a52-8f0d-4b6a-9c2e-5d7f1a0b9e11';
const MENSAJE_ENVIADO =
  'Si hay una compra con ese correo, te hemos enviado un enlace. Revisa tu bandeja.';
/** Enlace de compra del build de esta pasada. Vacío si la pasada no define VITE_ENLACE_COMPRA. */
const ENLACE_DE_LA_PASADA = (process.env.VITE_ENLACE_COMPRA ?? '').trim();

interface RespuestaSimulada {
  status: number;
  cuerpo?: unknown;
}

interface Simulacion {
  accesos: RespuestaSimulada;
  otp: RespuestaSimulada;
  /** Método y ruta de cada petición que sale hacia Supabase. Las que no están simuladas se cortan. */
  peticiones: string[];
}

function crearSimulacion(): Simulacion {
  return {
    accesos: { status: 200, cuerpo: [] },
    otp: { status: 200, cuerpo: {} },
    peticiones: [],
  };
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

async function responder(ruta: Route, respuesta: RespuestaSimulada): Promise<void> {
  await ruta.fulfill({
    status: respuesta.status,
    headers: { 'access-control-allow-origin': '*' },
    contentType: 'application/json',
    body: respuesta.cuerpo === undefined ? '' : JSON.stringify(respuesta.cuerpo),
  });
}

/** Todas las peticiones a Supabase pasan por aquí. Lo que no está simulado se corta: nunca sale a la red. */
async function simularSupabase(page: Page, simulacion: Simulacion): Promise<void> {
  await page.route(`${SUPABASE}/**`, async (ruta) => {
    const peticion = ruta.request();
    const { pathname } = new URL(peticion.url());
    simulacion.peticiones.push(`${peticion.method()} ${pathname}`);

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
    if (pathname.endsWith('/auth/v1/otp')) {
      await responder(ruta, simulacion.otp);
      return;
    }
    if (pathname.endsWith('/auth/v1/logout')) {
      await responder(ruta, { status: 204 });
      return;
    }
    if (pathname.endsWith('/auth/v1/user')) {
      await responder(ruta, { status: 200, cuerpo: usuario() });
      return;
    }
    if (pathname.endsWith('/rest/v1/accesos')) {
      await responder(ruta, simulacion.accesos);
      return;
    }
    await ruta.abort();
  });
}

function codificar(objeto: object): string {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
}

/**
 * Sesión falsa para la nube: supabase-js no verifica la firma en el cliente, solo lee `exp` y el `aal` del token.
 * Se escribe una sola vez por pestaña (marca en sessionStorage), así un «Cerrar sesión» no la vuelve a crear.
 */
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

/** Completa el inicio (sin test base) y termina en Hoy. Hace falta para que la app deje entrar a /hoy. */
async function completarInicio(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Lo hago después' }).click();
  // El inicio termina en el paywall. Sin nube, el plan gratuito lleva a Hoy; con nube y compra activa, «Ir a Hoy».
  await page.getByRole('button', { name: 'Ver planes y prueba de 7 días' }).click();
  await expect(page).toHaveURL(/\/paywall$/);
  await page.getByRole('link', { name: /^(Seguir con el plan gratuito|Ir a Hoy)$/ }).click();
  await expect(page).toHaveURL(/\/hoy$/);
}

/** Enlaces con href vacío, «#», con «undefined»/«null» o que no son una URL válida. */
async function enlacesRotos(page: Page): Promise<string[]> {
  const origen = new URL(page.url()).origin;
  const hrefs = await page
    .locator('a[href]')
    .evaluateAll((enlaces) => enlaces.map((enlace) => enlace.getAttribute('href') ?? ''));
  return hrefs.filter(
    (href) =>
      href === '' || href === '#' || /undefined|null/.test(href) || !URL.canParse(href, origen),
  );
}

test.describe('acceso sin nube @demo', () => {
  test('/entrar lleva a la app sin avisos internos y no envía nada', async ({ page }) => {
    const peticionesDeAcceso: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.url().includes('/auth/v1/')) peticionesDeAcceso.push(peticion.url());
    });

    // Sin inicio hecho, la app manda primero al onboarding; con él, a Hoy.
    await page.goto('/entrar');
    await expect(page).toHaveURL(/\/(hoy|onboarding)$/);
    await expect(page.getByText(/esta copia|todavía no está|no está configurad/i)).toHaveCount(0);
    await expect(page.getByLabel('Correo de tu compra')).toHaveCount(0);
    expect(peticionesDeAcceso).toEqual([]);
  });

  test('/login lleva por /entrar a la app', async ({ page }) => {
    await completarInicio(page);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/hoy$/);
  });

  test('/hoy abre sin pedir acceso en la demostración', async ({ page }) => {
    const peticionesDeAcceso: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.url().includes('/auth/v1/') || peticion.url().includes('/rest/v1/')) {
        peticionesDeAcceso.push(peticion.url());
      }
    });

    await completarInicio(page);
    await page.goto('/hoy');
    await expect(page).toHaveURL(/\/hoy$/);
    await expect(page.getByRole('link', { name: 'Empezar', exact: true })).toBeVisible();
    expect(peticionesDeAcceso).toEqual([]);
  });
});

test.describe('acceso con nube @nube', () => {
  let simulacion: Simulacion;

  test.beforeEach(async ({ page }) => {
    simulacion = crearSimulacion();
    await simularSupabase(page, simulacion);
  });

  test('@nube /entrar manda el enlace con create_user false y vuelve a /entrar/confirmar', async ({
    page,
  }) => {
    await page.goto('/entrar');
    const peticionOtp = page.waitForRequest(
      (peticion) => peticion.url().includes('/auth/v1/otp') && peticion.method() === 'POST',
    );
    await page.getByLabel('Correo de tu compra').fill(CORREO);
    await page.getByRole('button', { name: 'Enviarme el enlace' }).click();

    const otp = await peticionOtp;
    const cuerpo: unknown = otp.postDataJSON();
    expect(cuerpo).toMatchObject({ email: CORREO, create_user: false });

    const redireccion = new URL(otp.url()).searchParams.get('redirect_to') ?? '';
    expect(redireccion).not.toBe('');
    expect(new URL(redireccion).pathname).toBe('/entrar/confirmar');

    await expect(page.getByText(MENSAJE_ENVIADO)).toBeVisible();
  });

  test('@nube sin sesión, /hoy lleva a /entrar', async ({ page }) => {
    await page.goto('/hoy');
    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByLabel('Correo de tu compra')).toBeVisible();
  });

  test('@nube con sesión y sin fila en accesos, /hoy lleva a /sin-compra con el correo enmascarado', async ({
    page,
  }) => {
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 200, cuerpo: [] };

    await page.goto('/hoy');
    await expect(page).toHaveURL(/\/sin-compra$/);
    await expect(page.getByText('No encontramos una compra activa con este correo.')).toBeVisible();
    await expect(page.getByText('c***@example.com').first()).toBeVisible();
    await expect(page.getByText(CORREO)).toHaveCount(0);
  });

  test('@nube con sesión y fila activa, /entrar/confirmar lleva a /hoy', async ({ page }) => {
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 200, cuerpo: [{ estado: 'activo' }] };
    await completarInicio(page);

    await page.goto('/entrar/confirmar');
    await expect(page).toHaveURL(/\/hoy$/);
    await expect(page.getByRole('link', { name: 'Empezar', exact: true })).toBeVisible();
  });

  test('@nube con sesión y fila inactiva, /entrar/confirmar lleva a /sin-compra', async ({
    page,
  }) => {
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 200, cuerpo: [{ estado: 'inactivo' }] };

    await page.goto('/entrar/confirmar');
    await expect(page).toHaveURL(/\/sin-compra$/);
    await expect(page.getByText('No encontramos una compra activa con este correo.')).toBeVisible();
  });

  test('@nube si la consulta de acceso falla, muestra el error con Reintentar y nunca la app', async ({
    page,
  }) => {
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 500, cuerpo: { code: 'XX000', message: 'Fallo de prueba' } };

    await page.goto('/hoy');
    await expect(
      page.getByRole('heading', { level: 1, name: 'No pudimos comprobar tu acceso' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Empezar', exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/hoy$/);

    simulacion.accesos = { status: 200, cuerpo: [{ estado: 'activo' }] };
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'No pudimos comprobar tu acceso' }),
    ).toHaveCount(0);
  });

  test('@nube sin compra y con enlace de la pasada, /sin-compra enlaza la compra sin enlaces rotos', async ({
    page,
  }) => {
    test.skip(ENLACE_DE_LA_PASADA === '', 'Esta pasada no define VITE_ENLACE_COMPRA');
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 200, cuerpo: [] };

    await page.goto('/sin-compra');
    const comprar = page.getByRole('link', { name: 'Comprar', exact: true });
    await expect(comprar).toHaveAttribute('href', ENLACE_DE_LA_PASADA);
    await expect(comprar).toHaveAttribute('rel', 'noopener');
    await expect(page.getByText(/todavía no está configurada/i)).toHaveCount(0);
    expect(await enlacesRotos(page)).toEqual([]);
  });

  test('@nube sin compra y sin enlace, /sin-compra no muestra compra ni avisos internos', async ({
    page,
  }) => {
    test.skip(
      ENLACE_DE_LA_PASADA !== '',
      'Requiere una pasada sin VITE_ENLACE_COMPRA: el build de esta pasada sí enlaza la compra',
    );
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 200, cuerpo: [] };

    await page.goto('/sin-compra');
    await expect(page.getByText('No encontramos una compra activa con este correo.')).toBeVisible();
    await expect(page.getByText(/todavía no está configurada/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Comprar' })).toHaveCount(0);
    expect(await enlacesRotos(page)).toEqual([]);
  });

  test('@nube «Cerrar sesión» en Cuenta borra la sesión y lleva a /entrar', async ({ page }) => {
    await conectarSesion(page, 'aal1');
    simulacion.accesos = { status: 200, cuerpo: [{ estado: 'activo' }] };
    await completarInicio(page);

    await page.goto('/cuenta');
    await expect(page.getByText('Conectada como')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();

    await expect(page).toHaveURL(/\/entrar$/);
    await expect(page.getByLabel('Correo de tu compra')).toBeVisible();
    expect(simulacion.peticiones).toContain('POST /auth/v1/logout');
    expect(
      await page.evaluate((clave) => window.localStorage.getItem(clave), CLAVE_SESION),
    ).toBeNull();
  });

  test('@nube el botón «Enviarme el enlace» muestra foco visible con el teclado', async ({
    page,
  }) => {
    await page.goto('/entrar');
    await page.getByLabel('Correo de tu compra').fill(CORREO);
    await page.keyboard.press('Tab');

    const boton = page.getByRole('button', { name: 'Enviarme el enlace' });
    await expect(boton).toBeFocused();
    const contorno = await boton.evaluate((elemento) => {
      const estilo = window.getComputedStyle(elemento);
      return { estilo: estilo.outlineStyle, ancho: estilo.outlineWidth };
    });
    expect(contorno).toEqual({ estilo: 'solid', ancho: '2px' });
  });
});
