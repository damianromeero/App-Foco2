/**
 * Lógica de /api/admin/sesion (api/admin/sesion.ts la conecta a Vercel). PURO: el fetch llega inyectado.
 *
 * La sesión de la administradora vive en la cookie httpOnly `foco_admin` (distinta de la del comprador). Nunca llega
 * al navegador ni en el cuerpo de una respuesta.
 *
 *  GET     lee la cookie, valida o renueva la sesión y responde { tipo, correo }:
 *            'sin-sesion'  no hay cookie válida.
 *            'sin-admin'   la sesión es válida, pero la base no reconoce a la persona como administradora.
 *            'sin-mfa'     es administradora, pero entró sin segundo factor (claim `aal` = aal1).
 *            'admin'       es administradora y el token tiene el claim `aal` = aal2.
 *          «Administradora» lo decide la base con su propia función (soy_administrador) y el token de la persona.
 *          El nivel `aal` se lee del propio token ya verificado con Supabase.
 *  POST    recibe { accessToken, refreshToken } del enlace de acceso. Comprueba el token de acceso con Supabase y
 *          fija la cookie. Sin token válido responde 401 y no fija nada.
 *  DELETE  borra la cookie y revoca la sesión en Supabase (intento best effort).
 *
 * La clave de servicio no se usa aquí: solo el token de la persona y la clave anon.
 */
import { normalizarCorreo } from '../src/domain/acceso';
import {
  cookieBorrada,
  cookieDeSesion,
  NOMBRE_COOKIE_ADMIN,
  tokensDeLaPeticion,
  tokensValidos,
} from './cookie';
import {
  configuracionSupabase,
  leerJson,
  origenPermitido,
  respuestaJson,
  respuestaNoPermitida,
  sinBackend,
  type ConfigSupabase,
  type DependenciasServidor,
  type FetchServidor,
} from './http';
import { resolverSesion } from './sesion';
import { cerrarSesionEnSupabase, pedirRest, verificarUsuario } from './supabase';

const METODOS = ['GET', 'POST', 'DELETE'] as const;
const LIMITE_CUERPO = 16_000;

/** Función de base que dice si la persona de la sesión está en la lista de administradoras. */
export const FUNCION_ADMIN = 'soy_administrador';

export type EstadoAdminServidor = 'sin-sesion' | 'sin-admin' | 'sin-mfa' | 'admin';

/** Nivel de seguridad (`aal`) del token, leído de su carga. Solo se llama con tokens ya verificados. Null si no se lee. */
export function aalDeToken(token: string): string | null {
  const [, carga] = token.split('.');
  if (carga === undefined || carga === '') return null;
  try {
    const base64 = carga.replace(/-/g, '+').replace(/_/g, '/');
    const binario = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
    const datos = JSON.parse(new TextDecoder().decode(bytes)) as { aal?: unknown };
    return typeof datos.aal === 'string' ? datos.aal : null;
  } catch {
    return null;
  }
}

/** Pregunta a la base si la persona es administradora. `error` si la consulta falló. */
export async function esAdministradora(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
): Promise<boolean | 'error'> {
  try {
    const respuesta = await pedirRest(config, fetch, accessToken, {
      metodo: 'POST',
      ruta: `/rpc/${FUNCION_ADMIN}`,
      cuerpo: {},
    });
    if (!respuesta.ok) return 'error';
    const valor: unknown = await respuesta.json();
    return valor === true ? true : valor === false ? false : 'error';
  } catch {
    return 'error';
  }
}

/** Mapa del estado: administradora y segundo factor, leídos de la base y del token. */
export function clasificarAdmin(administradora: boolean, aal: string | null): EstadoAdminServidor {
  if (!administradora) return 'sin-admin';
  return aal === 'aal2' ? 'admin' : 'sin-mfa';
}

export async function manejarSesionAdmin(
  request: Request,
  deps: DependenciasServidor,
): Promise<Response> {
  switch (request.method) {
    case 'GET':
      return leer(request, deps);
    case 'POST':
      return establecer(request, deps);
    case 'DELETE':
      return cerrar(request, deps);
    default:
      return respuestaNoPermitida(METODOS);
  }
}

async function leer(request: Request, deps: DependenciasServidor): Promise<Response> {
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const tokens = tokensDeLaPeticion(request, NOMBRE_COOKIE_ADMIN);
  if (tokens === null) return respuestaJson(200, { tipo: 'sin-sesion', correo: null });

  const sesion = await resolverSesion(tokens, config, deps.fetch);
  if (sesion.tipo === 'sin-sesion') {
    return respuestaJson(
      200,
      { tipo: 'sin-sesion', correo: null },
      sesion.borrarCookie ? [cookieBorrada(request, NOMBRE_COOKIE_ADMIN)] : [],
    );
  }
  if (sesion.tipo === 'error') return respuestaJson(502, { tipo: 'error', correo: null });

  const cookies = sesion.renovada
    ? [cookieDeSesion(sesion.tokens, request, NOMBRE_COOKIE_ADMIN)]
    : [];
  const correo = normalizarCorreo(sesion.usuario.email ?? '') || null;
  const administradora = await esAdministradora(config, deps.fetch, sesion.tokens.accessToken);
  if (administradora === 'error') {
    return respuestaJson(502, { tipo: 'error', correo: null }, cookies);
  }
  const tipo = clasificarAdmin(administradora, aalDeToken(sesion.tokens.accessToken));
  return respuestaJson(200, { tipo, correo }, cookies);
}

async function establecer(request: Request, deps: DependenciasServidor): Promise<Response> {
  if (!origenPermitido(request))
    return respuestaJson(403, { ok: false, tipo: 'origen-no-permitido' });
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const lectura = await leerJson(request, LIMITE_CUERPO);
  const tokens = lectura.ok ? tokensValidos(lectura.valor) : null;
  if (tokens === null) return respuestaJson(400, { ok: false, tipo: 'datos-no-validos' });

  const usuario = await verificarUsuario(config, deps.fetch, tokens.accessToken);
  if (usuario.tipo === 'no-valido') return respuestaJson(401, { ok: false, tipo: 'sin-sesion' });
  if (usuario.tipo === 'error') return respuestaJson(502, { ok: false, tipo: 'error' });
  return respuestaJson(200, { ok: true }, [cookieDeSesion(tokens, request, NOMBRE_COOKIE_ADMIN)]);
}

async function cerrar(request: Request, deps: DependenciasServidor): Promise<Response> {
  if (!origenPermitido(request))
    return respuestaJson(403, { ok: false, tipo: 'origen-no-permitido' });
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const tokens = tokensDeLaPeticion(request, NOMBRE_COOKIE_ADMIN);
  if (tokens !== null) await cerrarSesionEnSupabase(config, deps.fetch, tokens.accessToken);
  return respuestaJson(200, { ok: true }, [cookieBorrada(request, NOMBRE_COOKIE_ADMIN)]);
}
