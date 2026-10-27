import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

/** Recorre el inicio sin hacer el test base (se puede hacer después desde Progreso). */
async function completeOnboardingWithoutBaseline(page: Page): Promise<void> {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await page.getByRole('button', { name: 'Lo hago después' }).click();
  // El inicio termina en el paywall; desde ahí, el plan gratuito lleva a Hoy.
  await page.getByRole('button', { name: 'Ver planes y prueba de 7 días' }).click();
  await expect(page).toHaveURL(/\/paywall$/);
  await page.getByRole('link', { name: 'Seguir con el plan gratuito' }).click();
  await expect(page).toHaveURL(/\/hoy$/);
}

test.describe('primera sesión', () => {
  test('tras el inicio se llega a Hoy con la sesión preparada', async ({ page }) => {
    await completeOnboardingWithoutBaseline(page);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Empezar', exact: true })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('la sesión arranca con respiración y después un juego con su progreso', async ({ page }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.getByRole('link', { name: 'Empezar', exact: true }).click();
    await expect(page).toHaveURL(/\/sesion$/);

    await expect(
      page.getByRole('heading', { level: 2, name: 'Respira antes de empezar' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Saltar' }).click();

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
  });

  test('salir de la sesión pide confirmación y no guarda nada', async ({ page }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.goto('/sesion');
    await page.getByRole('button', { name: 'Saltar' }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page.getByRole('dialog', { name: '¿Salir de la sesión?' })).toBeVisible();
    await page.getByRole('button', { name: 'Salir', exact: true }).last().click();
    await expect(page).toHaveURL(/\/hoy$/);
    await expect(page.getByRole('link', { name: 'Empezar', exact: true })).toBeVisible();
  });
});

test.describe('quien vuelve', () => {
  test('entrar a /onboarding después del inicio lleva a Hoy sin repetir el proceso', async ({
    page,
  }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.goto('/onboarding');
    await expect(page).toHaveURL(/\/hoy$/);
    await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
  });

  test('los datos siguen en el navegador en una sesión nueva con el mismo almacenamiento', async ({
    page,
    browser,
  }) => {
    await completeOnboardingWithoutBaseline(page);
    const origin = new URL(page.url()).origin;
    const storage = await page.context().storageState();

    const returning = await browser.newContext({ storageState: storage });
    const again = await returning.newPage();
    await again.goto(`${origin}/hoy`);
    await expect(again).toHaveURL(/\/hoy$/);
    await expect(again.getByRole('link', { name: 'Empezar', exact: true })).toBeVisible();
    await returning.close();
  });

  test('el test base sigue disponible con ?modo=base', async ({ page }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.goto('/onboarding?modo=base');
    await expect(page).toHaveURL(/\/onboarding\?modo=base$/);
  });
});

test.describe('pantallas de la app', () => {
  // Un test por pantalla: cada análisis de axe tiene su propio límite de tiempo. Antes, las seis pantallas compartían
  // los 30 s de un solo test y fallaban por tiempo cuando la máquina iba cargada (no por contenido). Las mismas pantallas
  // y las mismas reglas WCAG se comprueban igual.
  for (const path of ['/progreso', '/biblioteca', '/retos', '/lecciones', '/ajustes', '/cuenta']) {
    test(`${path} es accesible`, async ({ page }) => {
      await completeOnboardingWithoutBaseline(page);
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await seriousViolations(page), `violaciones en ${path}`).toEqual([]);
    });
  }

  test('en Biblioteca, el juego premium aparece bloqueado en el plan gratuito', async ({
    page,
  }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.goto('/biblioteca');
    await expect(page.getByRole('link', { name: 'Desbloquear con Premium' }).first()).toBeVisible();
  });

  test('los ajustes de accesibilidad se aplican al documento', async ({ page }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.goto('/ajustes');
    await page.getByText('Grande', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-text', 'grande');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text', 'grande');
  });

  test('la exportación de datos descarga un JSON legible', async ({ page }) => {
    await completeOnboardingWithoutBaseline(page);
    await page.goto('/ajustes');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar mis datos (JSON)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^atenzo-mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
