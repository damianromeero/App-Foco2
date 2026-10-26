/**
 * Ruta /api/cuenta (lógica pura; api/cuenta.ts la conecta a Vercel).
 *
 *  DELETE  llama a la función de base `borrar_mi_cuenta` con el token de la propia persona. Si la base acepta, borra
 *          la cookie. NO llama a Hotmart, a Stripe ni a ningún proveedor de cobros: la suscripción se cancela en Hotmart.
 *
 * La función de base (migración 20261025110000) usa auth.uid(): solo puede borrar la cuenta de quien llama.
 */
import { cookieBorrada, cookieDeSesion, tokensDeLaPeticion } from './cookie';
import {
  configuracionSupabase,
  origenPermitido,
  respuestaJson,
  respuestaNoPermitida,
  sinBackend,
  type DependenciasServidor,
} from './http';
import { resolverSesion } from './sesion';
import { pedirRest } from './supabase';

/** Función de base que borra la cuenta de quien llama. */
export const FUNCION_BORRAR_CUENTA = 'borrar_mi_cuenta';

export async function manejarCuenta(
  request: Request,
  deps: DependenciasServidor,
): Promise<Response> {
  if (request.method !== 'DELETE') return respuestaNoPermitida(['DELETE']);
  if (!origenPermitido(request))
    return respuestaJson(403, { ok: false, tipo: 'origen-no-permitido' });
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const tokens = tokensDeLaPeticion(request);
  if (tokens === null) return respuestaJson(401, { ok: false, tipo: 'sin-sesion' });

  const sesion = await resolverSesion(tokens, config, deps.fetch);
  if (sesion.tipo === 'sin-sesion') {
    return respuestaJson(
      401,
      { ok: false, tipo: 'sin-sesion' },
      sesion.borrarCookie ? [cookieBorrada(request)] : [],
    );
  }
  if (sesion.tipo === 'error') return respuestaJson(502, { ok: false, tipo: 'error' });

  const cookies = sesion.renovada ? [cookieDeSesion(sesion.tokens, request)] : [];
  try {
    const respuesta = await pedirRest(config, deps.fetch, sesion.tokens.accessToken, {
      metodo: 'POST',
      ruta: `/rpc/${FUNCION_BORRAR_CUENTA}`,
      cuerpo: {},
    });
    if (!respuesta.ok) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
  } catch {
    return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
  }
  // La cuenta ya no existe: la cookie que la apuntaba se borra.
  return respuestaJson(200, { ok: true }, [cookieBorrada(request)]);
}
