import { expect, test } from '@playwright/test';

/**
 * Camino de venta en modo demostración (@demo): sin nube ni facturación. Estas pruebas protegen lo que la persona no debe
 * perder al conectar sus cobros: la portada no crea nada, el botón de compra vuelve en su estado y /onboarding se retoma.
 */

/** Clave de los datos de la app en el navegador (STORAGE_KEY en src/data/persistence.ts). */
const CLAVE_DATOS = 'foco5';

/**
 * El estado persistido de la app (zustand: { state, version }). Devuelve `demoBilling` o null si no existe. Nunca lanza.
 */
function demoBillingGuardado(texto: string | null): unknown {
  if (texto === null) return null;
  const dato: unknown = JSON.parse(texto);
  if (typeof dato !== 'object' || dato === null || !('state' in dato)) return null;
  const estado: unknown = dato.state;
  if (typeof estado !== 'object' || estado === null || !('demoBilling' in estado)) return null;
  return estado.demoBilling;
}

test.describe('venta en modo demostración @demo', () => {
  test('la portada no crea ningún plan ni cobro en el navegador', async ({ page }) => {
    const peticionesDeCobro: string[] = [];
    page.on('request', (peticion) => {
      if (/checkout|functions\/v1|hotmart/i.test(peticion.url())) {
        peticionesDeCobro.push(peticion.url());
      }
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const { claves, guardado } = await page.evaluate(
      (clave) => ({
        claves: Object.keys(window.localStorage),
        guardado: window.localStorage.getItem(clave),
      }),
      CLAVE_DATOS,
    );
    expect(claves.filter((clave) => /factur|billing|pago|suscri|plan/i.test(clave))).toEqual([]);
    expect(demoBillingGuardado(guardado)).toBeNull();
    expect(peticionesDeCobro).toEqual([]);
  });

  test('al volver a precios desde la portada, el botón de compra conserva su destino y el plan responde', async ({
    page,
  }) => {
    await page.goto('/precios');
    // Sin enlace de Hotmart en esta pasada: el botón lleva a la app, sin anunciar una demostración.
    const comprarAntes = page.getByRole('link', { name: 'Empezar a entrenar' });
    await expect(comprarAntes).toBeVisible();
    await expect(comprarAntes).toHaveAttribute('href', '/hoy');
    await expect(page.getByText(/en preparación|demostración|no hay cobros/i)).toHaveCount(0);

    // El radio es un input oculto dentro de la tarjeta: se pulsa la tarjeta (su etiqueta), como lo haría una persona.
    await page.locator('label', { has: page.getByRole('radio', { name: /Mensual/ }) }).click();
    await expect(page.getByRole('radio', { name: /Mensual/ })).toBeChecked();

    await page.locator('header a[href="/"]').first().click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/precios$/);

    const comprarDespues = page.getByRole('link', { name: 'Empezar a entrenar' });
    await expect(comprarDespues).toBeVisible();
    await expect(comprarDespues).toHaveAttribute('href', '/hoy');

    await page.locator('label', { has: page.getByRole('radio', { name: /Mensual/ }) }).click();
    await expect(page.getByRole('radio', { name: /Mensual/ })).toBeChecked();
  });

  test('recargar /onboarding vuelve al primer paso, sin errores de consola ni de página', async ({
    page,
  }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    page.on('pageerror', (error) => {
      errores.push(error.message);
    });

    const primerPaso = page.getByRole('heading', {
      level: 2,
      name: /¿Para qué quieres entrenar tu atención\?/,
    });
    const progreso = page.getByRole('progressbar', { name: 'Progreso del inicio' });

    await page.goto('/onboarding');
    await expect(primerPaso).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: /Ajustemos la experiencia a ti/ }),
    ).toBeVisible();

    await page.reload();
    await expect(primerPaso).toBeVisible();
    await expect(progreso).toHaveAttribute('aria-valuenow', '1');

    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect(
      page.getByRole('heading', { level: 2, name: /Ajustemos la experiencia a ti/ }),
    ).toBeVisible();
    expect(errores).toEqual([]);
  });
});
