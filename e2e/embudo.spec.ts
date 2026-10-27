import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Embudo de venta en modo demostración (@demo): portada (/) → onboarding (/onboarding) → paywall (/paywall).
 * Cada etapa es una pantalla propia con su ruta, y la siguiente repite lo que la persona eligió. A 375 px ninguna
 * pantalla se desborda en horizontal. Sin nube: el paywall ofrece el plan gratuito como salida honesta, y sin enlace de
 * compra el botón principal lleva a la app sin anunciar una demostración ni simular un cobro.
 */

async function seriousViolations(page: Page): Promise<string[]> {
  // Las entradas animadas empiezan con opacidad 0: se desactivan para medir el contraste del contenido final.
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map(
      (violation) =>
        `${violation.id}: ${violation.help} -> ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(' | ')}`,
    );
}

/** Ancho del documento menos el de la ventana: más de 0 es scroll horizontal. */
async function desborde(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const OBJETIVO = 'Usar menos el celular sin darme cuenta';

test.describe('embudo de venta @demo', () => {
  test('la portada lleva al onboarding, el onboarding al paywall y el paywall repite sus respuestas', async ({
    page,
  }) => {
    const errores: string[] = [];
    page.on('pageerror', (error) => {
      errores.push(error.message);
    });

    await page.goto('/');
    await page.locator('#cta-portada').click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole('heading', { level: 2, name: /¿Para qué quieres entrenar tu atención\?/ }),
    ).toBeVisible();

    await page.locator('label', { hasText: OBJETIVO }).click();
    await expect(page.getByRole('radio', { name: new RegExp(OBJETIVO) })).toBeChecked();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByLabel('¿Cómo te llamas? (opcional)').fill('Ana');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Lo hago después' }).click();

    // Último paso del onboarding: su plan, con su nombre, su objetivo y el test pendiente.
    await expect(
      page.getByRole('heading', { level: 2, name: 'Ana, tu plan está listo.' }),
    ).toBeVisible();
    const plan = page.getByRole('region', { name: 'Tu plan de entrenamiento' });
    await expect(plan).toContainText(OBJETIVO);
    await expect(plan).toContainText('Pendiente');
    await expect(page.getByRole('progressbar', { name: 'Progreso del inicio' })).toHaveAttribute(
      'aria-valuenow',
      '4',
    );

    await page.getByRole('button', { name: 'Ver planes y prueba de 7 días' }).click();
    await expect(page).toHaveURL(/\/paywall$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Ana, tu entrenamiento de 5 minutos para notar antes cuándo te desvía el celular.',
    );
    await expect(page.getByText(`Tu objetivo: ${OBJETIVO}`)).toBeVisible();

    // Orden fijo: titular → subtítulo → lo que incluye → precios. Nada de avisos internos en medio.
    const orden = await page
      .locator('#paywall-titulo, #incluye, #elige')
      .evaluateAll((nodos) => nodos.map((nodo) => nodo.id));
    expect(orden).toEqual(['paywall-titulo', 'incluye', 'elige']);
    await expect(page.getByRole('list', { name: 'Todo lo que incluye Premium' })).toContainText(
      'Garantía de 15 días',
    );
    const textoPaywall = await page.locator('main').innerText();
    expect(textoPaywall).not.toMatch(
      /demostraci|demo\b|simulad|en preparación|no hay cobros|todavía no|COMPLETAR|configura/i,
    );

    // El anual va recomendado y elegido; el mensual sigue a la vista con su precio completo.
    await expect(page.getByRole('radio', { name: /Anual/ })).toBeChecked();
    await expect(page.getByText('Ahorras 33 %')).toBeVisible();
    await expect(page.getByText('US$3,33', { exact: true })).toBeVisible();
    await expect(page.getByText('US$39,90 al año · cuatro meses gratis')).toBeVisible();
    await expect(page.getByRole('radio', { name: /Mensual/ })).not.toBeChecked();
    await expect(page.getByText('US$4,99', { exact: true })).toBeVisible();
    // Sin enlace de Hotmart (esta pasada), el botón principal dice adónde lleva: a la app, sin cobro ni prueba simulada.
    await expect(page.getByRole('link', { name: 'Empezar a entrenar' })).toHaveAttribute(
      'href',
      '/hoy',
    );
    await expect(page.getByRole('button', { name: 'Empezar prueba de 7 días' })).toHaveCount(0);
    await expect(
      page.getByText('No te cobran hoy. El primer cobro llega al terminar la prueba, si sigues.'),
    ).toBeVisible();
    await expect(page.getByText('Garantía de 15 días').first()).toBeVisible();

    // Elegir el mensual cambia lo que se cobra después de la prueba.
    await page.locator('label', { has: page.getByRole('radio', { name: /Mensual/ }) }).click();
    await expect(page.getByRole('radio', { name: /Mensual/ })).toBeChecked();
    await expect(page.getByText('Hotmart cobra US$4,99 al mes, si sigues.')).toBeVisible();

    // Sin pagar: el plan gratuito lleva a Hoy, con el inicio ya hecho.
    await page.getByRole('link', { name: 'Seguir con el plan gratuito' }).click();
    await expect(page).toHaveURL(/\/hoy$/);
    await expect(page.getByRole('link', { name: 'Empezar', exact: true })).toBeVisible();
    expect(errores).toEqual([]);
  });

  test('sin enlace de compra, el botón principal lleva a la app sin guardar un cobro ni mostrar un pago', async ({
    page,
  }) => {
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Lo hago después' }).click();
    await page.getByRole('button', { name: 'Ver planes y prueba de 7 días' }).click();
    await page.getByRole('link', { name: 'Empezar a entrenar' }).click();
    await expect(page).toHaveURL(/\/hoy$/);
    await expect(
      page.getByText(/prueba (demo )?iniciada|pago (realizado|confirmado)|cobro simulado/i),
    ).toHaveCount(0);
    const guardado = await page.evaluate(() => window.localStorage.getItem('foco5') ?? '');
    expect(guardado).not.toMatch(/"status":"(trialing|active)"/);
  });

  test('el paywall no inventa urgencia, testimonios ni promesas de mejora', async ({ page }) => {
    await page.goto('/paywall');
    const texto = await page.locator('main').innerText();
    expect(texto).not.toMatch(
      /quedan|solo hoy|última oportunidad|oferta termina|\d+ ?(personas|usuarios)|★|estrellas|garantizad|cura|diagnóstic|más inteligente|coeficiente/i,
    );
    expect(texto).not.toMatch(/App Store|Google Play|tienda de aplicaciones/i);
  });

  test('sin onboarding, el paywall se entiende solo y ofrece hacer el inicio', async ({ page }) => {
    await page.goto('/paywall');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Tu entrenamiento de 5 minutos para no perder el hilo.',
    );
    await page.getByRole('link', { name: 'Hacer el inicio' }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test('la ruta antigua /empezar lleva al onboarding y conserva la búsqueda', async ({ page }) => {
    await page.goto('/empezar');
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto('/empezar?modo=base');
    await expect(page).toHaveURL(/\/onboarding\?modo=base$/);
  });

  test('el paywall es accesible', async ({ page }) => {
    await page.goto('/paywall');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('a 375 px, venta, onboarding y paywall no se desbordan y el botón principal se ve', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto('/');
    await expect(page.locator('#cta-portada')).toBeInViewport();
    expect(await desborde(page), 'desborde en /').toBe(0);

    await page.goto('/onboarding');
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();
    expect(await desborde(page), 'desborde en /onboarding').toBe(0);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByLabel('¿Cómo te llamas? (opcional)').fill('Maximiliana Alejandra');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Lo hago después' }).click();
    await expect(page.getByRole('button', { name: 'Ver planes y prueba de 7 días' })).toBeVisible();
    expect(await desborde(page), 'desborde en el último paso').toBe(0);

    await page.getByRole('button', { name: 'Ver planes y prueba de 7 días' }).click();
    await expect(page).toHaveURL(/\/paywall$/);
    // Titular, lo que incluye y el comienzo de los precios se ven al bajar, sin desborde.
    await expect(page.locator('#paywall-titulo')).toBeInViewport();
    await page.getByRole('heading', { level: 2, name: 'Elige tu plan' }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('link', { name: 'Empezar a entrenar' })).toBeVisible();
    expect(await desborde(page), 'desborde en /paywall').toBe(0);
  });
});
