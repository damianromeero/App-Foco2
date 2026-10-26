// @vitest-environment node
// Rutas del panel de administración (/api/admin/sesion, /api/admin/mfa, /api/admin/datos) con Request y Response reales
// y el Supabase falso de servidor/falso-supabase.ts (sin red). Comprueban la cookie foco_admin, que el estado sale de la
// base y del claim aal, que el MFA solo reenvía sus acciones y que las tablas del panel tienen lista blanca y RLS.
import { describe, expect, it } from 'vitest';
import { codificarTokens, NOMBRE_COOKIE, NOMBRE_COOKIE_ADMIN } from './cookie';
import {
  ANON_PRUEBA,
  CODIGO_PRUEBA,
  crearJwt,
  crearPeticion,
  crearSupabaseFalso,
  sembrarUsuario,
  type SupabaseFalso,
  URL_PRUEBA,
} from './falso-supabase';
import { aalDeToken, clasificarAdmin, manejarSesionAdmin } from './admin-sesion';
import { manejarMfa } from './admin-mfa';
import { manejarDatos, rutaPostgrest, validarConsulta } from './admin-datos';

const ENTORNO = { SUPABASE_URL: URL_PRUEBA, SUPABASE_ANON_KEY: ANON_PRUEBA };
const ORIGEN = 'https://foco.example.com';
const URL_SESION = `${ORIGEN}/api/admin/sesion`;
const URL_MFA = `${ORIGEN}/api/admin/mfa`;
const URL_DATOS = `${ORIGEN}/api/admin/datos`;
const CORREO = 'administradora@example.com';
const ID = '33333333-3333-4333-8333-333333333333';

interface Sembrada {
  acceso: string;
  renovacion: string;
}

/** Siembra una persona con su sesión. `admin` decide la lista de administradoras; `aal` el nivel del token. */
function sembrar(
  estado: SupabaseFalso,
  opciones: {
    id?: string;
    email?: string;
    admin?: boolean;
    aal?: 'aal1' | 'aal2';
    serie?: string;
  } = {},
): Sembrada {
  const id = opciones.id ?? ID;
  const serie = opciones.serie ?? 'a';
  const aal = opciones.aal ?? 'aal2';
  const acceso = crearJwt(id, aal, serie);
  const renovacion = `renovacion-${serie}`;
  sembrarUsuario(estado, {
    id,
    email: opciones.email ?? CORREO,
    acceso,
    renovacion,
    accesoNuevo: crearJwt(id, aal, `${serie}-nuevo`),
    renovacionNueva: `renovacion-${serie}-nueva`,
    estados: ['activo'],
  });
  if (opciones.admin ?? true) estado.administradoras.add(id);
  return { acceso, renovacion };
}

function cookieAdmin(tokens: { accessToken: string; refreshToken: string }): string {
  return `${NOMBRE_COOKIE_ADMIN}=${codificarTokens(tokens)}`;
}

/** Valor de la cookie `nombre` de una cabecera Set-Cookie, o null si no se fija. */
function valorCookie(respuesta: Response, nombre: string): string | null {
  const cookie = respuesta.headers.get('set-cookie');
  if (!cookie?.startsWith(`${nombre}=`)) return null;
  return (cookie.split(';')[0] ?? '').slice(`${nombre}=`.length);
}

function tokensDeCookie(valor: string): { accessToken: string; refreshToken: string } {
  const bytes = Buffer.from(valor, 'base64url').toString('utf8');
  return JSON.parse(bytes) as { accessToken: string; refreshToken: string };
}

const deps = (estado: SupabaseFalso) => ({ env: ENTORNO, fetch: estado.fetch });

describe('/api/admin/sesion', () => {
  it('sin cookie responde sin-sesion y no fija nada', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesionAdmin(crearPeticion(URL_SESION), deps(estado));
    expect(await respuesta.json()).toEqual({ tipo: 'sin-sesion', correo: null });
    expect(respuesta.headers.get('set-cookie')).toBeNull();
  });

  it('POST con tokens que Supabase no acepta responde 401 y no fija cookie', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        metodo: 'POST',
        origen: ORIGEN,
        cuerpo: { accessToken: 'falso', refreshToken: 'falso' },
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(401);
    expect(respuesta.headers.get('set-cookie')).toBeNull();
  });

  it('POST válido fija la cookie foco_admin httpOnly, sin tokens en el cuerpo y sin tocar foco_sesion', async () => {
    const estado = crearSupabaseFalso();
    const { acceso, renovacion } = sembrar(estado);
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        metodo: 'POST',
        origen: ORIGEN,
        cuerpo: { accessToken: acceso, refreshToken: renovacion },
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(200);
    const cookie = respuesta.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(new RegExp(`^${NOMBRE_COOKIE_ADMIN}=`));
    expect(cookie).not.toMatch(new RegExp(`^${NOMBRE_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).toMatch(/Secure/);
    const cuerpo = await respuesta.text();
    expect(cuerpo).not.toContain(acceso);
    expect(cuerpo).not.toContain(renovacion);
  });

  it('en http (localhost) la cookie de admin no lleva Secure', async () => {
    const estado = crearSupabaseFalso();
    const { acceso, renovacion } = sembrar(estado);
    const respuesta = await manejarSesionAdmin(
      crearPeticion('http://localhost:4003/api/admin/sesion', {
        metodo: 'POST',
        origen: 'http://localhost:4003',
        cuerpo: { accessToken: acceso, refreshToken: renovacion },
      }),
      deps(estado),
    );
    expect(respuesta.headers.get('set-cookie')).not.toMatch(/Secure/);
  });

  it('POST desde otro origen se rechaza con 403 sin llamar a Supabase', async () => {
    const estado = crearSupabaseFalso();
    const { acceso, renovacion } = sembrar(estado);
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        metodo: 'POST',
        origen: 'https://otro.example.net',
        cuerpo: { accessToken: acceso, refreshToken: renovacion },
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(403);
    expect(estado.peticiones).toHaveLength(0);
  });

  it('administradora con segundo factor (aal2) responde admin, con su correo', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal2' });
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual({ tipo: 'admin', correo: CORREO });
    // La comprobación de administradora va con el token de la propia persona, no con la clave de servicio.
    const consulta = estado.peticiones.find((p) =>
      p.ruta.startsWith('/rest/v1/rpc/soy_administrador'),
    );
    expect(consulta?.autorizacion).toBe(`Bearer ${acceso}`);
    expect(consulta?.apikey).toBe(ANON_PRUEBA);
  });

  it('administradora que entró sin segundo factor (aal1) responde sin-mfa', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual({ tipo: 'sin-mfa', correo: CORREO });
  });

  it('una persona que no está en la lista responde sin-admin, aunque tenga aal2', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal2', admin: false });
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual({ tipo: 'sin-admin', correo: CORREO });
  });

  it('con el acceso caducado renueva y fija la cookie foco_admin nueva en la misma respuesta', async () => {
    const estado = crearSupabaseFalso();
    const { renovacion } = sembrar(estado, { aal: 'aal2' });
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        cookie: cookieAdmin({ accessToken: 'caducado', refreshToken: renovacion }),
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual({ tipo: 'admin', correo: CORREO });
    const nueva = valorCookie(respuesta, NOMBRE_COOKIE_ADMIN);
    expect(nueva).not.toBeNull();
    expect(tokensDeCookie(nueva ?? '').refreshToken).toBe(`${renovacion}-nueva`);
  });

  it('con renovación inválida responde sin-sesion y borra la cookie de admin', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        cookie: cookieAdmin({ accessToken: 'caducado', refreshToken: 'mala' }),
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual({ tipo: 'sin-sesion', correo: null });
    expect(respuesta.headers.get('set-cookie')).toMatch(
      new RegExp(`^${NOMBRE_COOKIE_ADMIN}=;.*Max-Age=0`),
    );
  });

  it('la cookie del comprador no abre el panel', async () => {
    const estado = crearSupabaseFalso();
    const { acceso, renovacion } = sembrar(estado, { aal: 'aal2' });
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        cookie: `${NOMBRE_COOKIE}=${codificarTokens({ accessToken: acceso, refreshToken: renovacion })}`,
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual({ tipo: 'sin-sesion', correo: null });
  });

  it('DELETE borra la cookie de admin y revoca la sesión', async () => {
    const estado = crearSupabaseFalso();
    const { acceso, renovacion } = sembrar(estado);
    const respuesta = await manejarSesionAdmin(
      crearPeticion(URL_SESION, {
        metodo: 'DELETE',
        origen: ORIGEN,
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: renovacion }),
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('set-cookie')).toMatch(
      new RegExp(`^${NOMBRE_COOKIE_ADMIN}=;.*Max-Age=0`),
    );
    expect(estado.peticiones.some((p) => p.ruta.startsWith('/auth/v1/logout'))).toBe(true);
  });

  it('sin configuración de Supabase responde 503 sin-backend', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesionAdmin(crearPeticion(URL_SESION), {
      env: {},
      fetch: estado.fetch,
    });
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toEqual({ tipo: 'sin-backend' });
  });

  it('los estados se clasifican según la lista y el claim aal', () => {
    expect(clasificarAdmin(false, 'aal2')).toBe('sin-admin');
    expect(clasificarAdmin(true, 'aal1')).toBe('sin-mfa');
    expect(clasificarAdmin(true, null)).toBe('sin-mfa');
    expect(clasificarAdmin(true, 'aal2')).toBe('admin');
    expect(aalDeToken(crearJwt(ID, 'aal2', 'x'))).toBe('aal2');
    expect(aalDeToken('no-es-un-jwt')).toBeNull();
  });
});

describe('/api/admin/mfa', () => {
  it('sin cookie responde 401 y no llama a Supabase', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarMfa(crearPeticion(URL_MFA), deps(estado));
    expect(respuesta.status).toBe(401);
    expect(estado.peticiones).toHaveLength(0);
  });

  it('alta crea un factor TOTP y devuelve QR y código sin guardar nada en la app', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const respuesta = await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
        cuerpo: { accion: 'alta', nombre: 'Mi teléfono' },
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(200);
    const datos = (await respuesta.json()) as { id: string; qr: string; secreto: string };
    expect(datos.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(datos.qr.startsWith('data:image/svg+xml;utf-8,')).toBe(true);
    expect(datos.secreto).toMatch(/^SECRETO/);
    const alta = estado.peticiones.find((p) => p.ruta === '/auth/v1/factors');
    expect(alta?.metodo).toBe('POST');
    expect(JSON.parse(alta?.cuerpo ?? '{}')).toEqual({
      factor_type: 'totp',
      friendly_name: 'Mi teléfono',
    });
    expect(alta?.autorizacion).toBe(`Bearer ${acceso}`);
  });

  it('lista los factores sin secretos ni tokens', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie,
        cuerpo: { accion: 'alta', nombre: 'A' },
      }),
      deps(estado),
    );
    const respuesta = await manejarMfa(crearPeticion(URL_MFA, { cookie }), deps(estado));
    const datos = (await respuesta.json()) as { factores: Record<string, unknown>[] };
    expect(datos.factores).toHaveLength(1);
    expect(Object.keys(datos.factores[0] ?? {}).sort()).toEqual(
      ['created_at', 'factor_type', 'friendly_name', 'id', 'status'].sort(),
    );
    expect(JSON.stringify(datos)).not.toContain('SECRETO');
    expect(JSON.stringify(datos)).not.toContain(acceso);
  });

  it('reto devuelve el id del reto', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    const alta = await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie,
        cuerpo: { accion: 'alta', nombre: 'A' },
      }),
      deps(estado),
    );
    const { id } = (await alta.json()) as { id: string };
    const reto = await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie,
        cuerpo: { accion: 'reto', factorId: id },
      }),
      deps(estado),
    );
    expect(reto.status).toBe(200);
    const datos = (await reto.json()) as { challengeId: string };
    expect(datos.challengeId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('verificar con el código correcto fija la cookie aal2 nueva y no devuelve tokens', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    const { id } = (await (
      await manejarMfa(
        crearPeticion(URL_MFA, {
          metodo: 'POST',
          origen: ORIGEN,
          cookie,
          cuerpo: { accion: 'alta', nombre: 'A' },
        }),
        deps(estado),
      )
    ).json()) as { id: string };
    const { challengeId } = (await (
      await manejarMfa(
        crearPeticion(URL_MFA, {
          metodo: 'POST',
          origen: ORIGEN,
          cookie,
          cuerpo: { accion: 'reto', factorId: id },
        }),
        deps(estado),
      )
    ).json()) as { challengeId: string };

    const respuesta = await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie,
        cuerpo: { accion: 'verificar', factorId: id, challengeId, code: CODIGO_PRUEBA },
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(200);
    const cuerpo = await respuesta.text();
    expect(cuerpo).not.toMatch(/access|refresh|eyJ/);
    const nueva = valorCookie(respuesta, NOMBRE_COOKIE_ADMIN);
    expect(nueva).not.toBeNull();
    const tokens = tokensDeCookie(nueva ?? '');
    expect(aalDeToken(tokens.accessToken)).toBe('aal2');

    // Con la cookie nueva, el estado del panel pasa a admin.
    const estadoPanel = await manejarSesionAdmin(
      crearPeticion(URL_SESION, { cookie: cookieAdmin(tokens) }),
      deps(estado),
    );
    expect(await estadoPanel.json()).toEqual({ tipo: 'admin', correo: CORREO });
  });

  it('verificar con un código incorrecto responde 400 codigo-incorrecto y no cambia la cookie', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    const { id } = (await (
      await manejarMfa(
        crearPeticion(URL_MFA, {
          metodo: 'POST',
          origen: ORIGEN,
          cookie,
          cuerpo: { accion: 'alta', nombre: 'A' },
        }),
        deps(estado),
      )
    ).json()) as { id: string };
    const { challengeId } = (await (
      await manejarMfa(
        crearPeticion(URL_MFA, {
          metodo: 'POST',
          origen: ORIGEN,
          cookie,
          cuerpo: { accion: 'reto', factorId: id },
        }),
        deps(estado),
      )
    ).json()) as { challengeId: string };
    const respuesta = await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie,
        cuerpo: { accion: 'verificar', factorId: id, challengeId, code: '000000' },
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ ok: false, tipo: 'codigo-incorrecto' });
    expect(respuesta.headers.get('set-cookie')).toBeNull();
  });

  it('rechaza acciones fuera de la lista y cuerpos mal formados con 400', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    const enviar = (cuerpo: unknown) =>
      manejarMfa(
        crearPeticion(URL_MFA, { metodo: 'POST', origen: ORIGEN, cookie, cuerpo }),
        deps(estado),
      );
    for (const cuerpo of [
      { accion: 'borrar-factor', factorId: '00000000-0000-4000-8000-000000000001' },
      { accion: 'reto', factorId: 'no-es-uuid' },
      {
        accion: 'verificar',
        factorId: '00000000-0000-4000-8000-000000000001',
        challengeId: '00000000-0000-4000-8000-000000000002',
        code: '12',
      },
      { accion: 'alta', nombre: '' },
    ]) {
      expect((await enviar(cuerpo)).status).toBe(400);
    }
    expect(estado.peticiones.filter((p) => p.ruta.startsWith('/auth/v1/factors'))).toHaveLength(0);
  });

  it('POST desde otro origen se rechaza con 403 y DELETE no está permitido', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    const otro = await manejarMfa(
      crearPeticion(URL_MFA, {
        metodo: 'POST',
        origen: 'https://otro.example.net',
        cookie,
        cuerpo: { accion: 'alta', nombre: 'A' },
      }),
      deps(estado),
    );
    expect(otro.status).toBe(403);
    const borrar = await manejarMfa(
      crearPeticion(URL_MFA, { metodo: 'DELETE', cookie }),
      deps(estado),
    );
    expect(borrar.status).toBe(405);
  });
});

describe('/api/admin/datos', () => {
  const consulta = (parametros: Record<string, string>) =>
    `${URL_DATOS}?${new URLSearchParams(parametros).toString()}`;
  const base = {
    tabla: 'compras',
    select: 'id_hotmart,plan,monto_usd,estado,correo,creado_en',
    columnaFecha: 'creado_en',
    desde: '2026-10-01T00:00:00.000Z',
    hasta: '2026-10-31T00:00:00.000Z',
    limite: '5001',
  };

  function sembrarTablas(estado: SupabaseFalso): void {
    estado.tablas.set('compras', [
      {
        id_hotmart: 'HP-1',
        plan: 'mensual',
        monto_usd: 19.99,
        estado: 'aprobada',
        correo: 'a@example.com',
        creado_en: '2026-10-05T10:00:00.000Z',
      },
      {
        id_hotmart: 'HP-2',
        plan: 'anual',
        monto_usd: 99,
        estado: 'aprobada',
        correo: 'b@example.com',
        creado_en: '2026-09-30T10:00:00.000Z',
      },
      {
        id_hotmart: 'HP-3',
        plan: 'anual',
        monto_usd: 99,
        estado: 'aprobada',
        correo: 'c@example.com',
        creado_en: '2026-10-31T00:00:00.000Z',
      },
    ]);
    estado.tablas.set('eventos_app', [
      { tipo: 'portada_vista', dispositivo: 'movil', creado_en: '2026-10-02T10:00:00.000Z' },
    ]);
  }

  it('la administradora con aal2 recibe solo las filas del rango, con las columnas pedidas', async () => {
    const estado = crearSupabaseFalso();
    sembrarTablas(estado);
    const { acceso } = sembrar(estado, { aal: 'aal2' });
    const respuesta = await manejarDatos(
      crearPeticion(consulta(base), {
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(200);
    const filas = (await respuesta.json()) as Record<string, unknown>[];
    expect(filas.map((f) => f.id_hotmart)).toEqual(['HP-1']);
    expect(Object.keys(filas[0] ?? {}).sort()).toEqual(
      ['correo', 'creado_en', 'estado', 'id_hotmart', 'monto_usd', 'plan'].sort(),
    );
    const llamada = estado.peticiones.find((p) => p.ruta.startsWith('/rest/v1/compras'));
    expect(llamada?.autorizacion).toBe(`Bearer ${acceso}`);
    expect(llamada?.apikey).toBe(ANON_PRUEBA);
  });

  it('una administradora sin segundo factor (aal1) recibe 403 sin-mfa', async () => {
    const estado = crearSupabaseFalso();
    sembrarTablas(estado);
    const { acceso } = sembrar(estado, { aal: 'aal1' });
    const respuesta = await manejarDatos(
      crearPeticion(consulta(base), {
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
      }),
      deps(estado),
    );
    expect(respuesta.status).toBe(403);
    expect(await respuesta.json()).toEqual({ tipo: 'sin-mfa' });
  });

  it('una persona que no es administradora no recibe filas (RLS)', async () => {
    const estado = crearSupabaseFalso();
    sembrarTablas(estado);
    const { acceso } = sembrar(estado, { aal: 'aal2', admin: false });
    const respuesta = await manejarDatos(
      crearPeticion(consulta(base), {
        cookie: cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' }),
      }),
      deps(estado),
    );
    expect(await respuesta.json()).toEqual([]);
  });

  it('sin cookie responde 401 y no llama a Supabase', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarDatos(crearPeticion(consulta(base)), deps(estado));
    expect(respuesta.status).toBe(401);
    expect(estado.peticiones).toHaveLength(0);
  });

  it('tablas fuera de la lista blanca responden 400 sin llamar a Supabase', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal2' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    for (const tabla of ['administradores', 'profiles', 'daily_sessions', 'compras;drop']) {
      const respuesta = await manejarDatos(
        crearPeticion(consulta({ ...base, tabla }), { cookie }),
        deps(estado),
      );
      expect(respuesta.status, tabla).toBe(400);
    }
    expect(estado.peticiones).toHaveLength(0);
  });

  it('columnas, fecha, instantes, límite y parámetros fuera de la forma acordada se rechazan con 400', async () => {
    const estado = crearSupabaseFalso();
    const { acceso } = sembrar(estado, { aal: 'aal2' });
    const cookie = cookieAdmin({ accessToken: acceso, refreshToken: 'renovacion-a' });
    const malas: Record<string, string>[] = [
      { ...base, select: 'id_hotmart,correo_secreto' },
      { ...base, select: 'id_hotmart,id_hotmart' },
      { ...base, columnaFecha: 'recibido_en' },
      { ...base, desde: '2026-10-01' },
      { ...base, hasta: 'mañana' },
      { ...base, limite: '5002' },
      { ...base, limite: '0' },
      { ...base, orden: 'monto_usd.desc' },
    ];
    for (const parametros of malas) {
      const respuesta = await manejarDatos(
        crearPeticion(consulta(parametros), { cookie }),
        deps(estado),
      );
      expect(respuesta.status, JSON.stringify(parametros)).toBe(400);
    }
    expect(estado.peticiones).toHaveLength(0);
  });

  it('la lista blanca tiene la columna de fecha de cada tabla y la ruta usa solo parámetros validados', () => {
    const url = new URL(consulta(base));
    const validada = validarConsulta(url);
    expect(validada.ok).toBe(true);
    if (!validada.ok) return;
    const ruta = rutaPostgrest(validada.consulta);
    expect(ruta.startsWith('/compras?')).toBe(true);
    expect(ruta).toContain('creado_en=gte.2026-10-01T00%3A00%3A00.000Z');
    expect(ruta).toContain('creado_en=lt.2026-10-31T00%3A00%3A00.000Z');
    expect(ruta).toContain('limit=5001');
  });
});
