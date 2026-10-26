import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCloudEnabled } from '../services/supabase';
import {
  cerrarSesionAdmin,
  confirmarEnlaceAdmin,
  estadoAdmin,
  fijarSesionAdmin,
  RUTA_SESION_ADMIN,
} from './sesion';

vi.mock('../services/supabase', () => ({
  isCloudEnabled: vi.fn(() => true),
}));

/** Respuesta JSON del servidor de sesión. */
const respuesta = (status: number, cuerpo: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(cuerpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

/** Simula /api/admin/sesion: cada llamada recibe la siguiente respuesta de la lista. */
function servidor(...respuestas: (() => Promise<Response>)[]) {
  const red = vi.spyOn(globalThis, 'fetch');
  for (const responder of respuestas) red.mockImplementationOnce(responder);
  return red;
}

describe('estado del panel (servidor)', () => {
  beforeEach(() => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sin nube responde sin-backend y no hace ninguna llamada', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(false);
    const red = vi.spyOn(globalThis, 'fetch');
    expect(await estadoAdmin()).toBe('sin-backend');
    expect(red).not.toHaveBeenCalled();
  });

  it('pide el estado al servidor con cookies de la app, nunca a Supabase', async () => {
    const red = servidor(() => respuesta(200, { tipo: 'admin', correo: 'a@example.com' }));
    await estadoAdmin();
    expect(red).toHaveBeenCalledWith(
      RUTA_SESION_ADMIN,
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it.each([
    ['sin-sesion', 'sin-sesion'],
    ['sin-admin', 'sin-permiso'],
    ['sin-mfa', 'segundo-factor-pendiente'],
    ['admin', 'listo'],
  ] as const)('el tipo %s del servidor se muestra como %s', async (tipo, esperado) => {
    servidor(() => respuesta(200, { tipo, correo: null }));
    expect(await estadoAdmin()).toBe(esperado);
  });

  it('un 503 del servidor significa sin backend configurado', async () => {
    servidor(() => respuesta(503, { tipo: 'sin-backend' }));
    expect(await estadoAdmin()).toBe('sin-backend');
  });

  it('un error del servidor, una red caída o una respuesta mal formada son error, sin dejar pasar', async () => {
    servidor(() => respuesta(502, { tipo: 'error', correo: null }));
    expect(await estadoAdmin()).toBe('error');
    servidor(() => Promise.reject(new TypeError('red caída')));
    expect(await estadoAdmin()).toBe('error');
    servidor(() => respuesta(200, { tipo: 'inventado' }));
    expect(await estadoAdmin()).toBe('error');
  });
});

describe('fijar, confirmar y cerrar la sesión del panel', () => {
  beforeEach(() => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fijarSesionAdmin envía los tokens al servidor y responde si los aceptó', async () => {
    const red = servidor(() => respuesta(200, { ok: true }));
    expect(await fijarSesionAdmin({ accessToken: 'a', refreshToken: 'r' })).toBe(true);
    expect(red).toHaveBeenCalledWith(
      RUTA_SESION_ADMIN,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ accessToken: 'a', refreshToken: 'r' }),
      }),
    );
  });

  it('confirmarEnlaceAdmin con tokens en el hash los entrega antes de leer el estado', async () => {
    const red = servidor(
      () => respuesta(200, { ok: true }),
      () => respuesta(200, { tipo: 'admin', correo: null }),
    );
    expect(await confirmarEnlaceAdmin('#access_token=a&refresh_token=r&type=magiclink')).toBe(
      'listo',
    );
    expect(red.mock.calls.map((llamada) => llamada[1]?.method)).toEqual(['POST', 'GET']);
  });

  it('si el servidor no acepta los tokens, confirmar responde sin-sesion y no lee el estado', async () => {
    const red = servidor(() => respuesta(401, { ok: false, tipo: 'sin-sesion' }));
    expect(await confirmarEnlaceAdmin('#access_token=a&refresh_token=r')).toBe('sin-sesion');
    expect(red).toHaveBeenCalledTimes(1);
  });

  it('sin tokens en el hash confirmar usa la cookie que ya exista', async () => {
    servidor(() => respuesta(200, { tipo: 'sin-mfa', correo: null }));
    expect(await confirmarEnlaceAdmin('')).toBe('segundo-factor-pendiente');
  });

  it('cerrar la sesión llama al servidor y lanza si falla', async () => {
    servidor(() => respuesta(200, { ok: true }));
    await expect(cerrarSesionAdmin()).resolves.toBeUndefined();
    servidor(() => Promise.reject(new TypeError('red caída')));
    await expect(cerrarSesionAdmin()).rejects.toThrow(/No pudimos cerrar la sesión/);
  });
});
