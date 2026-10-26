import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmarEnlace,
  cerrarSesionDeAcceso,
  enmascararCorreo,
  enviarEnlaceDeAcceso,
  leerEstadoAcceso,
  normalizarCorreo,
} from './acceso';

const CORREO = 'compradora@example.com';

const estado = {
  nube: true,
  signInWithOtp: vi.fn(() => Promise.resolve({ error: null })),
};

vi.mock('./supabase', () => ({
  isCloudEnabled: () => estado.nube,
  getSupabaseComprador: vi.fn(() =>
    Promise.resolve({ auth: { signInWithOtp: estado.signInWithOtp } }),
  ),
}));

/** Respuesta mínima con la forma que usa el cliente. */
function respuesta(status: number, cuerpo?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(cuerpo),
  };
}

const llamadas = (): unknown[][] => vi.mocked(globalThis.fetch).mock.calls;

beforeEach(() => {
  estado.nube = true;
  estado.signInWithOtp.mockClear();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('leerEstadoAcceso (lee el servidor, no el navegador)', () => {
  it('sin backend configurado no llama a ninguna ruta', async () => {
    estado.nube = false;
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'sin-backend' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('con acceso vigente según el servidor, lo devuelve con el correo', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { tipo: 'con-acceso', correo: CORREO }) as unknown as Response,
    );
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'con-acceso', correo: CORREO });
    expect(llamadas()[0]?.[0]).toBe('/api/sesion');
  });

  it('sin fila de acceso, sin-acceso', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { tipo: 'sin-acceso', correo: CORREO }) as unknown as Response,
    );
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'sin-acceso', correo: CORREO });
  });

  it('sin cookie de sesión, sin-sesion', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { tipo: 'sin-sesion', correo: null }) as unknown as Response,
    );
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'sin-sesion' });
  });

  it('con acceso pero sin correo, nunca concede: error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { tipo: 'con-acceso', correo: null }) as unknown as Response,
    );
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'error' });
  });

  it('un 502 del servidor es error, nunca acceso', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(502, { tipo: 'error', correo: null }) as unknown as Response,
    );
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'error' });
  });

  it('una respuesta que no tiene la forma esperada es error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { tipo: 'concedido' }) as unknown as Response,
    );
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'error' });
  });

  it('si la red falla, error sin lanzar', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('red caída'));
    await expect(leerEstadoAcceso()).resolves.toEqual({ tipo: 'error' });
  });
});

describe('confirmarEnlace (tokens del enlace al servidor)', () => {
  it('con tokens en el hash, los envía al servidor y después lee el acceso', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respuesta(200, { ok: true }) as unknown as Response)
      .mockResolvedValueOnce(
        respuesta(200, { tipo: 'con-acceso', correo: CORREO }) as unknown as Response,
      );

    const estadoFinal = await confirmarEnlace(
      '#access_token=acceso-de-prueba&refresh_token=renovacion-de-prueba&type=magiclink',
    );

    expect(estadoFinal).toEqual({ tipo: 'con-acceso', correo: CORREO });
    const envio = llamadas()[0];
    expect(envio?.[0]).toBe('/api/sesion');
    expect(envio?.[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse((envio?.[1] as RequestInit).body as string)).toEqual({
      accessToken: 'acceso-de-prueba',
      refreshToken: 'renovacion-de-prueba',
    });
  });

  it('si el servidor no acepta los tokens, sin-sesion y no lee nada', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(401, { ok: false }) as unknown as Response,
    );
    await expect(confirmarEnlace('#access_token=malo&refresh_token=malo')).resolves.toEqual({
      tipo: 'sin-sesion',
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('sin tokens en el hash (por ejemplo, al recargar) usa la cookie que ya exista', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { tipo: 'sin-acceso', correo: CORREO }) as unknown as Response,
    );
    await expect(confirmarEnlace('')).resolves.toEqual({ tipo: 'sin-acceso', correo: CORREO });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('enviarEnlaceDeAcceso', () => {
  it('pide el enlace sin crear cuentas y con la ruta de confirmación', async () => {
    await enviarEnlaceDeAcceso(` ${CORREO.toUpperCase()} `);
    expect(estado.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: CORREO,
        options: expect.objectContaining({ shouldCreateUser: false }) as unknown,
      }),
    );
  });

  it('si Supabase responde que no se permiten registros, se trata como envío normal', async () => {
    estado.signInWithOtp.mockResolvedValueOnce({
      error: { code: 'signup_disabled', message: 'Signups not allowed' },
    } as never);
    await expect(enviarEnlaceDeAcceso(CORREO)).resolves.toBeUndefined();
  });

  it('cualquier otro fallo se lanza', async () => {
    estado.signInWithOtp.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded' },
    } as never);
    await expect(enviarEnlaceDeAcceso(CORREO)).rejects.toThrow('Email rate limit exceeded');
  });
});

describe('cerrarSesionDeAcceso', () => {
  it('pide al servidor que revoque la sesión y borre la cookie', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      respuesta(200, { ok: true }) as unknown as Response,
    );
    await cerrarSesionDeAcceso();
    expect(llamadas()[0]).toEqual(['/api/sesion', expect.objectContaining({ method: 'DELETE' })]);
  });
});

describe('utilidades de correo', () => {
  it('normaliza y enmascara el correo', () => {
    expect(normalizarCorreo('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(enmascararCorreo('ana@example.com')).toBe('a***@example.com');
    expect(enmascararCorreo('sin-arroba')).toBe('');
  });
});
