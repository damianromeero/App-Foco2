// @vitest-environment node
// Rutas de servidor (/api/sesion, /api/sincronizacion, /api/cuenta) con Request y Response reales y un Supabase falso.
// Sin red: las peticiones a Supabase las responde servidor/falso-supabase.ts. Comprueba la cookie httpOnly, la renovación,
// que cada token solo ve sus filas, que el borrado llama solo a la función de base y que nada usa la clave de servicio.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { codificarTokens, NOMBRE_COOKIE } from './cookie';
import {
  ANON_PRUEBA,
  crearPeticion,
  crearSupabaseFalso,
  sembrarUsuario,
  URL_PRUEBA,
  type SupabaseFalso,
} from './falso-supabase';
import { manejarSesion } from './ruta-sesion';
import { manejarSincronizacion } from './ruta-sincronizacion';
import { manejarCuenta } from './ruta-cuenta';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENTORNO = { SUPABASE_URL: URL_PRUEBA, SUPABASE_ANON_KEY: ANON_PRUEBA };
const ORIGEN = 'https://foco.example.com';
const URL_SESION = `${ORIGEN}/api/sesion`;
const URL_SINCRO = `${ORIGEN}/api/sincronizacion`;
const URL_CUENTA = `${ORIGEN}/api/cuenta`;
const CORREO = 'compradora@example.com';
const ID = '11111111-1111-4111-8111-111111111111';

function usuarioSembrado(estado: SupabaseFalso, estados: string[] = ['activo']): void {
  sembrarUsuario(estado, {
    id: ID,
    email: CORREO,
    acceso: 'acceso-1',
    renovacion: 'renovacion-1',
    accesoNuevo: 'acceso-2',
    renovacionNueva: 'renovacion-2',
    estados,
  });
}

/** Valor de la cookie foco_sesion de una cabecera Set-Cookie, o null si no se fija. */
function valorCookie(respuesta: Response): string | null {
  const cookie = respuesta.headers.get('set-cookie');
  if (cookie === null) return null;
  const pareja = cookie.split(';')[0] ?? '';
  return pareja.slice(`${NOMBRE_COOKIE}=`.length);
}

function cabeceraCookie(tokens: { accessToken: string; refreshToken: string }): string {
  return `${NOMBRE_COOKIE}=${codificarTokens(tokens)}`;
}

describe('/api/sesion', () => {
  it('sin cookie responde sin-sesion y no fija nada', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesion(crearPeticion(URL_SESION), {
      env: ENTORNO,
      fetch: estado.fetch,
    });
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ tipo: 'sin-sesion', correo: null });
    expect(respuesta.headers.get('set-cookie')).toBeNull();
  });

  it('POST con tokens que Supabase no acepta responde 401 y no fija cookie', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        metodo: 'POST',
        origen: ORIGEN,
        cuerpo: { accessToken: 'falso', refreshToken: 'falso' },
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(401);
    expect(respuesta.headers.get('set-cookie')).toBeNull();
  });

  it('POST con tokens válidos fija la cookie httpOnly, SameSite=Lax y Secure por https, sin devolver los tokens', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        metodo: 'POST',
        origen: ORIGEN,
        cuerpo: { accessToken: 'acceso-1', refreshToken: 'renovacion-1' },
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(200);
    const cookie = respuesta.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(new RegExp(`^${NOMBRE_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=2592000/);
    expect(cookie).toMatch(/Secure/);
    const cuerpo = await respuesta.text();
    expect(cuerpo).not.toContain('acceso-1');
    expect(cuerpo).not.toContain('renovacion-1');
  });

  it('en http (localhost) la cookie no lleva Secure', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    const respuesta = await manejarSesion(
      crearPeticion('http://localhost:4003/api/sesion', {
        metodo: 'POST',
        origen: 'http://localhost:4003',
        cuerpo: { accessToken: 'acceso-1', refreshToken: 'renovacion-1' },
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.headers.get('set-cookie')).not.toMatch(/Secure/);
  });

  it('POST desde otro origen se rechaza con 403', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        metodo: 'POST',
        origen: 'https://otro.example.net',
        cuerpo: { accessToken: 'acceso-1', refreshToken: 'renovacion-1' },
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(403);
    expect(estado.peticiones).toHaveLength(0);
  });

  it('con cookie válida y acceso vigente responde con-acceso y el correo', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado, ['activo']);
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(await respuesta.json()).toEqual({ tipo: 'con-acceso', correo: CORREO });
    // La consulta a accesos_vigentes lleva el token de la persona, no la clave de servicio.
    const consulta = estado.peticiones.find((p) => p.ruta.startsWith('/rest/v1/accesos_vigentes'));
    expect(consulta?.autorizacion).toBe('Bearer acceso-1');
    expect(consulta?.apikey).toBe(ANON_PRUEBA);
  });

  it('con cookie válida pero sin fila en accesos_vigentes responde sin-acceso', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado, []);
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(await respuesta.json()).toEqual({ tipo: 'sin-acceso', correo: CORREO });
  });

  it('con el acceso caducado renueva con el token de renovación y fija la cookie nueva', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado, ['activo']);
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        cookie: cabeceraCookie({ accessToken: 'caducado', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(await respuesta.json()).toEqual({ tipo: 'con-acceso', correo: CORREO });
    const nueva = valorCookie(respuesta);
    expect(nueva).not.toBeNull();
    expect(nueva).toBe(codificarTokens({ accessToken: 'acceso-2', refreshToken: 'renovacion-2' }));
  });

  it('con renovación inválida responde sin-sesion y borra la cookie', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        cookie: cabeceraCookie({ accessToken: 'caducado', refreshToken: 'mala' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(await respuesta.json()).toEqual({ tipo: 'sin-sesion', correo: null });
    expect(respuesta.headers.get('set-cookie')).toMatch(/Max-Age=0/);
  });

  it('DELETE borra la cookie y revoca la sesión', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    const respuesta = await manejarSesion(
      crearPeticion(URL_SESION, {
        metodo: 'DELETE',
        origen: ORIGEN,
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    expect(estado.peticiones.some((p) => p.ruta.startsWith('/auth/v1/logout'))).toBe(true);
  });

  it('sin configuración de Supabase responde 503 sin-backend', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSesion(crearPeticion(URL_SESION), {
      env: {},
      fetch: estado.fetch,
    });
    expect(respuesta.status).toBe(503);
    expect(await respuesta.json()).toEqual({ tipo: 'sin-backend' });
  });
});

describe('/api/sincronizacion', () => {
  const fila = {
    date_key: '2026-10-24',
    completed_at: '2026-10-24T08:00:00.000Z',
    duration_sec: 300,
    payload: { games: [], reflection: null },
  };

  it('sin cookie responde 401', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarSincronizacion(crearPeticion(URL_SINCRO), {
      env: ENTORNO,
      fetch: estado.fetch,
    });
    expect(respuesta.status).toBe(401);
  });

  it('guarda las filas con el user_id del token verificado, ignorando el que llegue en el cuerpo', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    const respuesta = await manejarSincronizacion(
      crearPeticion(URL_SINCRO, {
        metodo: 'POST',
        origen: ORIGEN,
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
        cuerpo: { filas: [{ ...fila, user_id: 'otra-persona' }] },
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(200);
    expect(estado.sesiones.get(ID)?.[0]?.user_id).toBe(ID);
    expect(estado.sesiones.has('otra-persona')).toBe(false);
  });

  it('lee solo las filas de la persona que llama', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    estado.sesiones.set(ID, [{ ...fila, user_id: ID }]);
    estado.sesiones.set('otra', [{ ...fila, user_id: 'otra' }]);
    const respuesta = await manejarSincronizacion(
      crearPeticion(URL_SINCRO, {
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    const cuerpo = (await respuesta.json()) as { filas: { user_id?: string }[] };
    expect(cuerpo.filas).toHaveLength(1);
    expect(cuerpo.filas.some((f) => f.user_id === 'otra')).toBe(false);
  });

  it('DELETE borra solo las sesiones de la persona', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    estado.sesiones.set(ID, [{ ...fila, user_id: ID }]);
    estado.sesiones.set('otra', [{ ...fila, user_id: 'otra' }]);
    const respuesta = await manejarSincronizacion(
      crearPeticion(URL_SINCRO, {
        metodo: 'DELETE',
        origen: ORIGEN,
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBeLessThan(300);
    expect(estado.sesiones.has(ID)).toBe(false);
    expect(estado.sesiones.has('otra')).toBe(true);
  });
});

describe('/api/cuenta', () => {
  it('sin cookie responde 401 y no llama a la base', async () => {
    const estado = crearSupabaseFalso();
    const respuesta = await manejarCuenta(
      crearPeticion(URL_CUENTA, { metodo: 'DELETE', origen: ORIGEN }),
      {
        env: ENTORNO,
        fetch: estado.fetch,
      },
    );
    expect(respuesta.status).toBe(401);
    expect(estado.peticiones).toHaveLength(0);
  });

  it('borra la cuenta llamando solo a la función de base y borra la cookie', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    const respuesta = await manejarCuenta(
      crearPeticion(URL_CUENTA, {
        metodo: 'DELETE',
        origen: ORIGEN,
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(200);
    expect(estado.cuentasBorradas).toEqual([ID]);
    expect(respuesta.headers.get('set-cookie')).toMatch(/Max-Age=0/);
    const rutas = estado.peticiones.map((p) => p.ruta);
    expect(rutas).toContain('/rest/v1/rpc/borrar_mi_cuenta');
    expect(rutas.some((r) => r.includes('hotmart') || r.includes('stripe'))).toBe(false);
  });

  it('si la función de base falla responde 502 y conserva la cookie', async () => {
    const estado = crearSupabaseFalso();
    usuarioSembrado(estado);
    estado.rpcFalla = true;
    const respuesta = await manejarCuenta(
      crearPeticion(URL_CUENTA, {
        metodo: 'DELETE',
        origen: ORIGEN,
        cookie: cabeceraCookie({ accessToken: 'acceso-1', refreshToken: 'renovacion-1' }),
      }),
      { env: ENTORNO, fetch: estado.fetch },
    );
    expect(respuesta.status).toBe(502);
    expect(estado.cuentasBorradas).toEqual([]);
  });
});

/** Archivos .ts de una carpeta, incluidas sus subcarpetas (api/admin/), sin pruebas. */
function archivosDeServidor(carpeta: string): string[] {
  const encontrados: string[] = [];
  for (const entrada of readdirSync(join(RAIZ, carpeta), { withFileTypes: true })) {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...archivosDeServidor(ruta));
    else if (entrada.name.endsWith('.ts') && !entrada.name.endsWith('.test.ts'))
      encontrados.push(ruta);
  }
  return encontrados;
}

describe('las rutas de servidor nunca usan la clave de servicio', () => {
  it('ningún archivo de api/ ni servidor/ (ni sus subcarpetas) nombra la clave de servicio', () => {
    for (const carpeta of ['api', 'servidor']) {
      for (const archivo of archivosDeServidor(carpeta)) {
        const codigo = readFileSync(join(RAIZ, archivo), 'utf8');
        expect(codigo, archivo).not.toMatch(/SERVICE_ROLE|service_role/i);
      }
    }
  });
});
