import { expect, test, type Page, type Route } from '@playwright/test';

/**
 * Panel de administración. Sin nube (@demo): /admin no muestra datos ni llama a Supabase. Con nube (@nube): todas las
 * peticiones a Supabase se simulan con page.route; lo que no está simulado se corta.
 */

const SUPABASE = 'https://proyecto-de-prueba.supabase.co';
/** supabase-js guarda la sesión en `sb-<primer subdominio de la URL>-auth-token`. */
const CLAVE_SESION = 'sb-proyecto-de-prueba-auth-token';
const CORREO = 'correo@example.com';
const USUARIO = '8d2f4b1e-6a3c-4e7d-9b5a-1f0c2e3d4a55';

interface RespuestaSimulada {
  status: number;
  cuerpo?: unknown;
}

interface Simulacion {
  /** Lo que devuelve soy_administrador(): true si la persona está en la lista de administradoras. */
  administradora: boolean;
  peticiones: string[];
}

function crearSimulacion(): Simulacion {
  return { administradora: true, peticiones: [] };
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

/** Filas de ejemplo con correos ficticios. Las fechas son recientes para caer dentro de los periodos del panel. */
function datosDeEjemplo() {
  const ahora = Date.now();
  const hace = (dias: number): string => new Date(ahora - dias * 86_400_000).toISOString();
  return {
    compras: [
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
    ],
    eventos_app: [
      {
        tipo: 'portada_vista',
        dispositivo: '3f2c9c1e-7a1b-4d7e-9b7a-2f6d1e0c9a11',
        creado_en: hace(1),
      },
      {
        tipo: 'precios_vista',
        dispositivo: '3f2c9c1e-7a1b-4d7e-9b7a-2f6d1e0c9a11',
        creado_en: hace(1),
      },
    ],
    eventos_pago: [{ id_evento: 'EV-900001', estado: 'procesado', recibido_en: hace(1) }],
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

async function simularSupabase(page: Page, simulacion: Simulacion): Promise<void> {
  const datos = datosDeEjemplo();
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
    if (pathname.endsWith('/rest/v1/rpc/soy_administrador')) {
      await responder(ruta, { status: 200, cuerpo: simulacion.administradora });
      return;
    }
    if (pathname.endsWith('/auth/v1/user')) {
      await responder(ruta, { status: 200, cuerpo: usuario() });
      return;
    }
    if (pathname.endsWith('/auth/v1/logout')) {
      await responder(ruta, { status: 204 });
      return;
    }
    if (pathname.endsWith('/rest/v1/compras')) {
      await responder(ruta, { status: 200, cuerpo: datos.compras });
      return;
    }
    if (pathname.endsWith('/rest/v1/eventos_app')) {
      await responder(ruta, { status: 200, cuerpo: datos.eventos_app });
      return;
    }
    if (pathname.endsWith('/rest/v1/eventos_pago')) {
      await responder(ruta, { status: 200, cuerpo: datos.eventos_pago });
      return;
    }
    await ruta.abort();
  });
}

function codificar(objeto: object): string {
  return Buffer.from(JSON.stringify(objeto)).toString('base64url');
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

test.describe('panel sin nube @demo', () => {
  test('/admin no muestra datos ni llama a Supabase', async ({ page }) => {
    const peticionesDeDatos: string[] = [];
    page.on('request', (peticion) => {
      if (peticion.url().includes('/rest/v1/')) peticionesDeDatos.push(peticion.url());
    });

    await page.goto('/admin');
    await expect(page.getByText('El panel necesita Supabase configurado')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hoy' })).toHaveCount(0);
    expect(peticionesDeDatos).toEqual([]);
  });
});

test.describe('panel con nube @nube', () => {
  let simulacion: Simulacion;

  test.beforeEach(async ({ page }) => {
    simulacion = crearSimulacion();
    await simularSupabase(page, simulacion);
  });

  test('@nube sin sesión, /admin lleva a /admin/entrar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/entrar$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Panel de administración' }),
    ).toBeVisible();
  });

  test('@nube sesión sin segundo factor, /admin lleva a /admin/seguridad', async ({ page }) => {
    await conectarSesion(page, 'aal1');
    simulacion.administradora = true;

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/seguridad$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Seguridad' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mostrar el código QR' })).toBeVisible();
  });

  test('@nube sesión sin permiso de administradora, /admin dice que no hay nada aquí', async ({
    page,
  }) => {
    await conectarSesion(page, 'aal2');
    simulacion.administradora = false;

    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1, name: 'No hay nada aquí' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Secciones del panel' })).toHaveCount(0);
  });

  test('@nube administradora con segundo factor ve Hoy con sus cifras', async ({ page }) => {
    await conectarSesion(page, 'aal2');
    simulacion.administradora = true;

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Hoy' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Requiere atención' })).toBeVisible();
    await expect(page.getByText('Ingresos', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('US$65,89').first()).toBeVisible();
  });

  test('@nube en Ventas los correos aparecen enmascarados y nunca completos', async ({ page }) => {
    await conectarSesion(page, 'aal2');
    simulacion.administradora = true;

    await page.goto('/admin/ventas');
    await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible();
    await expect(page.getByText('c***@example.com').first()).toBeVisible();

    const texto = await page.locator('body').innerText();
    expect(texto).not.toContain(CORREO);
  });
});
