import { afterEach, describe, expect, it, vi } from 'vitest';
import { darDeAltaFactor, listarFactores, pedirReto, verificarCodigo, RUTA_MFA_ADMIN } from './mfa';

vi.mock('../services/supabase', () => ({
  isCloudEnabled: vi.fn(() => true),
}));

const json = (status: number, cuerpo: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cliente del segundo factor', () => {
  it('verificar un código correcto responde ok y envía la acción al servidor, sin tokens', async () => {
    const red = vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(200, { ok: true }));
    expect(await verificarCodigo('f1', 'r1', '123456')).toBe('ok');
    const [ruta, init] = red.mock.calls[0] ?? [];
    expect(ruta).toBe(RUTA_MFA_ADMIN);
    expect(JSON.parse(typeof init?.body === 'string' ? init.body : '{}')).toEqual({
      accion: 'verificar',
      factorId: 'f1',
      challengeId: 'r1',
      code: '123456',
    });
  });

  it('un código que no vale responde codigo-incorrecto; un fallo del servidor lanza', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json(400, { ok: false, tipo: 'codigo-incorrecto' }),
    );
    expect(await verificarCodigo('f1', 'r1', '000000')).toBe('codigo-incorrecto');

    vi.restoreAllMocks();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(502, { ok: false, tipo: 'error' }));
    await expect(verificarCodigo('f1', 'r1', '000000')).rejects.toThrow();
  });

  it('pedir un reto devuelve su id', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json(200, { challengeId: 'reto-1' }));
    expect(await pedirReto('f1')).toBe('reto-1');
  });

  it('dar de alta un factor devuelve el QR y el código, sin ningún token', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json(200, { id: 'f1', qr: 'data:image/svg+xml;utf-8,<svg/>', secreto: 'ABC' }),
    );
    expect(await darDeAltaFactor('Mi teléfono')).toEqual({
      id: 'f1',
      qr: 'data:image/svg+xml;utf-8,<svg/>',
      secreto: 'ABC',
    });
  });

  it('la lista de factores muestra nombre por defecto y activo según el estado', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      json(200, {
        factores: [
          {
            id: 'f1',
            factor_type: 'totp',
            status: 'verified',
            friendly_name: null,
            created_at: '2026-10-24T10:00:00.000Z',
          },
        ],
      }),
    );
    expect(await listarFactores()).toEqual([
      {
        id: 'f1',
        nombre: 'Autenticador',
        tipo: 'totp',
        verificado: true,
        creadoEn: '2026-10-24T10:00:00.000Z',
      },
    ]);
  });
});
