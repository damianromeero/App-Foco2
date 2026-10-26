import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { avisoDeBorradoHotmart, borrarMiCuenta, confirmacionDeBorradoValida } from './cuenta';

vi.mock('./supabase', () => ({
  isCloudEnabled: () => true,
}));

function respuesta(status: number) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve({}) };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('eliminar la cuenta', () => {
  it('llama solo a la ruta /api/cuenta con DELETE, sin proveedores de cobros', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(respuesta(200) as unknown as Response);
    await borrarMiCuenta();
    const llamadas = vi.mocked(globalThis.fetch).mock.calls;
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0]?.[0]).toBe('/api/cuenta');
    expect(llamadas[0]?.[1]).toMatchObject({ method: 'DELETE', credentials: 'same-origin' });
  });

  it('si el servidor rechaza el borrado, lanza un error comprensible sin datos internos', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(respuesta(502) as unknown as Response);
    await expect(borrarMiCuenta()).rejects.toThrow(
      'No se pudo eliminar la cuenta. Inténtalo de nuevo.',
    );
  });

  it('si la red falla, lanza el mismo error comprensible', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('sin red'));
    await expect(borrarMiCuenta()).rejects.toThrow('No se pudo eliminar la cuenta.');
  });

  it('solo confirma con la palabra ELIMINAR (espacios de los extremos aparte)', () => {
    expect(confirmacionDeBorradoValida('ELIMINAR')).toBe(true);
    expect(confirmacionDeBorradoValida('  ELIMINAR ')).toBe(true);
    expect(confirmacionDeBorradoValida('eliminar')).toBe(false);
    expect(confirmacionDeBorradoValida('ELIMINA')).toBe(false);
    expect(confirmacionDeBorradoValida('')).toBe(false);
  });

  it('el aviso de Hotmart es el texto exacto de la regla, con el correo de soporte de la configuración', () => {
    expect(avisoDeBorradoHotmart('correo@example.com')).toBe(
      'Eliminar tu cuenta NO cancela tu suscripción en Hotmart. Si tienes una suscripción activa, ' +
        'cancélala primero en consumer.hotmart.com (Minhas compras → tu producto → Configurar pagamento → ' +
        'Cancelar sua assinatura → Sim). Para ayuda, escribe a correo@example.com.',
    );
  });
});
