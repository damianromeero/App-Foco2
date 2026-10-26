import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Solo se aceptan peticiones al propio origen: la app no carga nada de terceros. */
function trackThirdPartyRequests(page: Page): string[] {
  const origin = new URL(test.info().project.use.baseURL ?? 'http://localhost').origin;
  const external: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin !== origin) external.push(request.url());
  });
  return external;
}

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

test.describe('páginas públicas', () => {
  test('la portada presenta la promesa sin prometer de más', async ({ page }) => {
    const external = trackThirdPartyRequests(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Vuelve a tu tarea sin perder el hilo.' }),
    ).toBeVisible();
    await expect(page.getByText('Sin anuncios', { exact: true })).toBeVisible();
    await expect(page.getByText('Lo que medimos y lo que no prometemos')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Arma tu plan gratis' }).first()).toBeVisible();

    expect(external, `peticiones externas: ${external.join(', ')}`).toHaveLength(0);
    expect(errors).toHaveLength(0);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('la portada muestra la pantalla real de la app, sin textos de ejemplo en el héroe', async ({
    page,
  }) => {
    await page.goto('/');
    const captura = page.getByRole('img', { name: 'Pantalla principal de la app Foco Mente' });
    await expect(captura).toBeVisible();
    await expect(captura).toHaveAttribute('fetchpriority', 'high');
    await expect(page.getByText('Sesión de 5 min')).toBeVisible();
    const heroe = await page.locator('section[aria-labelledby="hero"]').innerText();
    expect(heroe).not.toMatch(/ejemplo|demostración|demo/i);
  });

  test('los precios muestran el mensual, el anual, la prueba y la garantía de 7 días', async ({
    page,
  }) => {
    await page.goto('/precios');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Empieza gratis');
    await expect(page.getByText('US$5,99').first()).toBeVisible();
    await expect(page.getByText('US$59,90').first()).toBeVisible();
    await expect(page.getByText('Prueba de 7 días').first()).toBeVisible();
    await expect(page.getByText('dos meses gratis').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Si no te convence' })).toBeVisible();
    await expect(page.getByText('Lo que pasa después.')).toBeVisible();
    await expect(page.getByText('Garantía de 7 días').first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('la portada repite la misma acción en tres puntos, con su evento de medición', async ({
    page,
  }) => {
    await page.goto('/');
    for (const id of ['cta-portada', 'cta-medio', 'cta-final']) {
      const cta = page.locator(`#${id}`);
      await expect(cta).toHaveAttribute('href', '/onboarding');
      await expect(cta).toHaveAttribute('data-evento', 'inicio-gratis');
    }
  });

  test('la cabecera conserva el nombre en una línea a 680 px y muestra el menú', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 680, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
    const logo = await page.locator('header a[href="/"]').boundingBox();
    expect(logo?.height ?? 0).toBeLessThanOrEqual(44.5);
  });

  test('la pestaña de ciencia separa lo demostrado de lo que no', async ({ page }) => {
    await page.goto('/ciencia');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Qué está demostrado');
    await expect(page.getByText('Respaldado por la evidencia').first()).toBeVisible();
    await expect(page.getByText('Sin respaldo suficiente').first()).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('el pacto y los textos legales son accesibles y no muestran el aviso de borrador al cliente', async ({
    page,
  }) => {
    await page.goto('/pacto');
    await expect(
      page.getByRole('heading', { level: 1, name: 'El Pacto Sin Trampas' }),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await page.goto('/legal/privacidad');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
    ).toBeVisible();
    // El aviso de borrador es para quien vende la app: solo en desarrollo (la e2e usa el build de producción).
    await expect(page.getByText('Documento en borrador')).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('una ruta inexistente muestra la página de error', async ({ page }) => {
    await page.goto('/esto-no-existe');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Esta página no existe.' }),
    ).toBeVisible();
  });
});
