/**
 * Ruta /api/sesion (lógica pura; api/sesion.ts la conecta a Vercel).
 *
 *  GET     lee la cookie, valida o renueva la sesión y consulta `accesos_vigentes` con el token de la persona.
 *          Responde { tipo: 'sin-sesion' | 'sin-acceso' | 'con-acceso' | 'error', correo }.
 *  POST    recibe { accessToken, refreshToken } del enlace de acceso, comprueba el token de acceso y fija la cookie.
 *          Sin token válido responde 401 y no fija nada.
 *  DELETE  borra la cookie y revoca la sesión en Supabase (intento best effort).
 *
 * Ninguna respuesta lleva los tokens: solo el estado y el correo ya enmascarado por la pantalla.
 */
import { decidirAcceso, normalizarCorreo } from '../src/domain/acceso';
import { cookieBorrada, cookieDeSesion, tokensDeLaPeticion, tokensValidos } from './cookie';
import {
  configuracionSupabase,
  leerJson,
  origenPermitido,
  respuestaJson,
  respuestaNoPermitida,
  sinBackend,
  type DependenciasServidor,
} from './http';
import { resolverSesion } from './sesion';
import { cerrarSesionEnSupabase, leerAccesoVigente, verificarUsuario } from './supabase';

const METODOS = ['GET', 'POST', 'DELETE'] as const;
const LIMITE_CUERPO = 16_000;

export async function manejarSesion(
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

  const tokens = tokensDeLaPeticion(request);
  if (tokens === null) return respuestaJson(200, { tipo: 'sin-sesion', correo: null });

  const sesion = await resolverSesion(tokens, config, deps.fetch);
  if (sesion.tipo === 'sin-sesion') {
    return respuestaJson(
      200,
      { tipo: 'sin-sesion', correo: null },
      cookiesSi(sesion.borrarCookie, request),
    );
  }
  if (sesion.tipo === 'error') return respuestaJson(502, { tipo: 'error', correo: null });

  const cookies = sesion.renovada ? [cookieDeSesion(sesion.tokens, request)] : [];
  const correo = normalizarCorreo(sesion.usuario.email ?? '');
  const filas = await leerAccesoVigente(config, deps.fetch, sesion.tokens.accessToken);
  const resultado = decidirAcceso(correo, filas);
  if (resultado.tipo === 'error')
    return respuestaJson(502, { tipo: 'error', correo: null }, cookies);
  return respuestaJson(200, { tipo: resultado.tipo, correo: resultado.correo }, cookies);
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
  return respuestaJson(200, { ok: true }, [cookieDeSesion(tokens, request)]);
}

async function cerrar(request: Request, deps: DependenciasServidor): Promise<Response> {
  if (!origenPermitido(request))
    return respuestaJson(403, { ok: false, tipo: 'origen-no-permitido' });
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const tokens = tokensDeLaPeticion(request);
  if (tokens !== null) await cerrarSesionEnSupabase(config, deps.fetch, tokens.accessToken);
  return respuestaJson(200, { ok: true }, [cookieBorrada(request)]);
}

function cookiesSi(condicion: boolean, request: Request): string[] {
  return condicion ? [cookieBorrada(request)] : [];
}
