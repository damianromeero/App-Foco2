// Cliente de Supabase con fetch inyectado (supabase/functions/_shared/rest.ts): rutas, cabeceras, fallos de red y la creación de la
// cuenta de Auth. Sin red real: el fetch es una función de la prueba. Todo inventado.
import { describe, expect, it } from 'vitest';
import {
  crearRest,
  crearUsuarioAuth,
  ErrorAviso,
  type ConfigSupabase,
} from '../functions/_shared/rest.ts';
import { CLAVE_SERVICIO, CORREO, URL_PRUEBA } from './ayudas-hotmart.ts';

interface Peticion {
  url: string;
  init: RequestInit | undefined;
}

/** Config con un fetch que responde lo que se le diga y recuerda las peticiones. */
function configurar(
  responder: (peticion: Peticion) => Response | Promise<Response>,
  url = URL_PRUEBA,
) {
  const peticiones: Peticion[] = [];
  const config: ConfigSupabase = {
    url,
    claveServicio: CLAVE_SERVICIO,
    fetch: async (entrada, init) => {
      const peticion = { url: entrada, init };
      peticiones.push(peticion);
      return responder(peticion);
    },
  };
  return { config, peticiones };
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status });

describe('crearRest: PostgREST con la clave de servicio', () => {
  it('construye la URL en /rest/v1, aunque la URL base termine en barra, y manda la clave como apikey y Bearer', async () => {
    const { config, peticiones } = configurar(() => json([{ estado: 'activo' }]), `${URL_PRUEBA}/`);
    const respuesta = await crearRest(config)<{ estado: string }[]>(
      '/accesos?correo=eq.x&select=estado',
    );
    expect(respuesta).toEqual({ ok: true, status: 200, datos: [{ estado: 'activo' }] });
    expect(peticiones[0]?.url).toBe(`${URL_PRUEBA}/rest/v1/accesos?correo=eq.x&select=estado`);
    expect(peticiones[0]?.init?.method).toBe('GET');
    expect(peticiones[0]?.init?.headers).toMatchObject({
      apikey: CLAVE_SERVICIO,
      Authorization: `Bearer ${CLAVE_SERVICIO}`,
      'Content-Type': 'application/json',
    });
    expect(peticiones[0]?.init?.body).toBeUndefined();
  });

  it('envía el método, el cuerpo en JSON y la cabecera Prefer cuando se piden', async () => {
    const { config, peticiones } = configurar(() => new Response(null, { status: 201 }));
    await crearRest(config)('/compras?on_conflict=id_hotmart', {
      metodo: 'POST',
      cuerpo: { id_hotmart: 'TRX-1' },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    });
    expect(peticiones[0]?.init?.method).toBe('POST');
    expect(peticiones[0]?.init?.body).toBe('{"id_hotmart":"TRX-1"}');
    expect((peticiones[0]?.init?.headers as Record<string, string>).Prefer).toBe(
      'resolution=ignore-duplicates,return=minimal',
    );
  });

  it('una respuesta sin cuerpo (201) da datos nulos y ok verdadero', async () => {
    const { config } = configurar(() => new Response(null, { status: 201 }));
    expect(await crearRest(config)('/compras', { metodo: 'POST', cuerpo: {} })).toEqual({
      ok: true,
      status: 201,
      datos: null,
    });
  });

  it('un error de la base devuelve ok falso con su estado y NO lanza', async () => {
    const { config } = configurar(() => json({ message: 'algo interno con datos' }, 500));
    const respuesta = await crearRest(config)('/compras');
    expect(respuesta.ok).toBe(false);
    expect(respuesta.status).toBe(500);
  });

  it('un fallo de red (fetch lanza) devuelve estado 502 y NO lanza', async () => {
    const { config } = configurar(() => {
      throw new TypeError('fetch failed');
    });
    expect(await crearRest(config)('/compras')).toEqual({ ok: false, status: 502, datos: null });
  });

  it('manda una señal de tiempo máximo en cada petición', async () => {
    const { config, peticiones } = configurar(() => json([]));
    await crearRest({ ...config, tiempoMaxMs: 1234 })('/compras');
    expect(peticiones[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('crearUsuarioAuth: POST /auth/v1/admin/users', () => {
  it('manda email y email_confirm verdadero a la API de administración, con la clave de servicio', async () => {
    const { config, peticiones } = configurar(() => json({ id: 'id-de-prueba' }));
    await crearUsuarioAuth(config, CORREO);
    expect(peticiones[0]?.url).toBe(`${URL_PRUEBA}/auth/v1/admin/users`);
    expect(peticiones[0]?.init?.method).toBe('POST');
    expect(JSON.parse(String(peticiones[0]?.init?.body))).toEqual({
      email: CORREO,
      email_confirm: true,
    });
    expect(peticiones[0]?.init?.headers).toMatchObject({
      apikey: CLAVE_SERVICIO,
      Authorization: `Bearer ${CLAVE_SERVICIO}`,
    });
  });

  it('un correo que ya tiene cuenta (422 con email_exists o user_already_exists, o 409) se da por bueno', async () => {
    for (const [status, cuerpo] of [
      [
        422,
        {
          code: 422,
          error_code: 'email_exists',
          msg: 'A user with this email address has already been registered',
        },
      ],
      [422, { error_code: 'user_already_exists', msg: 'User already registered' }],
      [409, { error_code: 'email_exists' }],
      // Versiones sin código de error: se reconoce por el mensaje.
      [422, { msg: 'A user with this email address has already been registered' }],
      [409, { message: 'User already registered' }],
    ] as const) {
      const { config } = configurar(() => json(cuerpo, status));
      await expect(
        crearUsuarioAuth(config, CORREO),
        JSON.stringify(cuerpo),
      ).resolves.toBeUndefined();
    }
  });

  it('un 422 por otra causa (correo inválido para Auth) NO se da por bueno', async () => {
    for (const cuerpo of [
      { code: 422, error_code: 'email_address_invalid', msg: 'Email address is invalid' },
      { msg: 'otra cosa' },
      {},
    ]) {
      const { config } = configurar(() => json(cuerpo, 422));
      await expect(crearUsuarioAuth(config, CORREO), JSON.stringify(cuerpo)).rejects.toMatchObject({
        codigo: 'usuario-no-creado-422',
      });
    }
  });

  it('un 422 sin cuerpo JSON tampoco se da por bueno', async () => {
    const { config } = configurar(() => new Response('no es json', { status: 422 }));
    await expect(crearUsuarioAuth(config, CORREO)).rejects.toBeInstanceOf(ErrorAviso);
  });

  it('otros fallos (401, 429, 500) lanzan ErrorAviso con el estado y sin el correo ni la clave', async () => {
    for (const status of [401, 429, 500, 503]) {
      const { config } = configurar(() => json({ msg: 'detalle interno' }, status));
      const fallo = await crearUsuarioAuth(config, CORREO).catch((error: unknown) => error);
      expect(fallo).toBeInstanceOf(ErrorAviso);
      expect((fallo as ErrorAviso).codigo).toBe(`usuario-no-creado-${status}`);
      expect((fallo as ErrorAviso).message).not.toContain('ejemplo.test');
      expect((fallo as ErrorAviso).message).not.toContain(CLAVE_SERVICIO);
    }
  });

  it('un fallo de red lanza ErrorAviso con 502', async () => {
    const { config } = configurar(() => {
      throw new TypeError('fetch failed');
    });
    await expect(crearUsuarioAuth(config, CORREO)).rejects.toMatchObject({
      codigo: 'usuario-no-creado-502',
    });
  });
});
