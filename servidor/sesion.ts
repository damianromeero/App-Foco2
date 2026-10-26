/**
 * Resuelve la sesión de una petición: comprueba el token de acceso y, si caducó, usa la renovación. Lo usan las tres
 * rutas (sesión, sincronización y cuenta). PURO: el fetch llega inyectado.
 *
 * Si la renovación cambia los tokens, `renovada` indica que la cookie debe volver a fijarse en la misma respuesta.
 * Si la renovación ya no vale, `borrarCookie` indica que la cookie debe borrarse.
 */
import type { ConfigSupabase, FetchServidor } from './http';
import type { TokensSesion } from './cookie';
import { renovarTokens, verificarUsuario } from './supabase';

export interface UsuarioSesion {
  id: string;
  email: string | null;
}

export type ResolucionSesion =
  | { tipo: 'sin-sesion'; borrarCookie: boolean }
  | { tipo: 'error' }
  | { tipo: 'valida'; usuario: UsuarioSesion; tokens: TokensSesion; renovada: boolean };

export type SesionValida = Extract<ResolucionSesion, { tipo: 'valida' }>;

export async function resolverSesion(
  tokens: TokensSesion | null,
  config: ConfigSupabase,
  fetch: FetchServidor,
): Promise<ResolucionSesion> {
  if (tokens === null) return { tipo: 'sin-sesion', borrarCookie: false };

  const directo = await verificarUsuario(config, fetch, tokens.accessToken);
  if (directo.tipo === 'ok') {
    return {
      tipo: 'valida',
      usuario: { id: directo.id, email: directo.email },
      tokens,
      renovada: false,
    };
  }
  if (directo.tipo === 'error') return { tipo: 'error' };

  // El token de acceso caducó: se cambia la renovación por un par nuevo.
  const renovado = await renovarTokens(config, fetch, tokens.refreshToken);
  if (renovado.tipo === 'no-valido') return { tipo: 'sin-sesion', borrarCookie: true };
  if (renovado.tipo === 'error') return { tipo: 'error' };

  const verificado = await verificarUsuario(config, fetch, renovado.tokens.accessToken);
  if (verificado.tipo === 'ok') {
    return {
      tipo: 'valida',
      usuario: { id: verificado.id, email: verificado.email },
      tokens: renovado.tokens,
      renovada: true,
    };
  }
  if (verificado.tipo === 'no-valido') return { tipo: 'sin-sesion', borrarCookie: true };
  return { tipo: 'error' };
}
