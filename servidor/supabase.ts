/**
 * Llamadas del servidor a Supabase con la clave ANON y el token de la propia persona. PURO: el fetch llega inyectado.
 *
 * Ningún resultado incluye cuerpos de respuesta, URLs ni tokens: solo el tipo de fallo. Así no se filtran datos.
 */
import { z } from 'zod';
import type { ConfigSupabase, FetchServidor } from './http';
import { leerJsonSeguro } from './http';
import type { TokensSesion } from './cookie';

export type ResultadoUsuario =
  { tipo: 'ok'; id: string; email: string | null } | { tipo: 'no-valido' } | { tipo: 'error' };

export type ResultadoRenovacion =
  { tipo: 'ok'; tokens: TokensSesion } | { tipo: 'no-valido' } | { tipo: 'error' };

const usuarioSchema = z.object({ id: z.string().min(1), email: z.string().nullish() });
const tokensSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});
const filasAccesoSchema = z.array(z.object({ estado: z.unknown().optional() }));

/** Cabeceras de Supabase: la clave anon siempre, y el token de la persona como Bearer. */
function cabeceras(config: ConfigSupabase, token: string, conCuerpo: boolean): Headers {
  const resultado = new Headers({ apikey: config.anonKey, Authorization: `Bearer ${token}` });
  if (conCuerpo) resultado.set('Content-Type', 'application/json');
  return resultado;
}

/** Comprueba el token de acceso y devuelve el usuario. 401 y 403 significan «token no válido». */
export async function verificarUsuario(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
): Promise<ResultadoUsuario> {
  try {
    const respuesta = await fetch(`${config.url}/auth/v1/user`, {
      method: 'GET',
      headers: cabeceras(config, accessToken, false),
    });
    if (respuesta.status === 401 || respuesta.status === 403) return { tipo: 'no-valido' };
    if (!respuesta.ok) return { tipo: 'error' };
    const datos = usuarioSchema.safeParse(await leerJsonSeguro(respuesta));
    return datos.success
      ? { tipo: 'ok', id: datos.data.id, email: datos.data.email ?? null }
      : { tipo: 'error' };
  } catch {
    return { tipo: 'error' };
  }
}

/**
 * Cambia el token de renovación por tokens nuevos. Supabase rota la renovación: el par nuevo sustituye al anterior.
 * 400, 401 y 403 significan que la renovación ya no vale.
 */
export async function renovarTokens(
  config: ConfigSupabase,
  fetch: FetchServidor,
  refreshToken: string,
): Promise<ResultadoRenovacion> {
  try {
    const respuesta = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: cabeceras(config, config.anonKey, true),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if ([400, 401, 403].includes(respuesta.status)) return { tipo: 'no-valido' };
    if (!respuesta.ok) return { tipo: 'error' };
    const datos = tokensSchema.safeParse(await leerJsonSeguro(respuesta));
    return datos.success
      ? {
          tipo: 'ok',
          tokens: {
            accessToken: datos.data.access_token,
            refreshToken: datos.data.refresh_token,
          },
        }
      : { tipo: 'error' };
  } catch {
    return { tipo: 'error' };
  }
}

export interface PeticionRest {
  metodo: 'GET' | 'POST' | 'DELETE';
  /** Ruta dentro de /rest/v1, con su query string. */
  ruta: string;
  cuerpo?: unknown;
  prefer?: string;
}

/** Petición a PostgREST con el token de la persona: RLS decide qué filas se ven o se cambian. */
export function pedirRest(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
  peticion: PeticionRest,
): Promise<Response> {
  const headers = cabeceras(config, accessToken, peticion.cuerpo !== undefined);
  if (peticion.prefer !== undefined) headers.set('Prefer', peticion.prefer);
  return fetch(`${config.url}/rest/v1${peticion.ruta}`, {
    method: peticion.metodo,
    headers,
    body: peticion.cuerpo === undefined ? undefined : JSON.stringify(peticion.cuerpo),
  });
}

/** Filas de `accesos_vigentes` del propio usuario (RLS). Null si la consulta falló o la forma no es la esperada. */
export async function leerAccesoVigente(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
): Promise<readonly { estado?: unknown }[] | null> {
  try {
    const respuesta = await pedirRest(config, fetch, accessToken, {
      metodo: 'GET',
      ruta: '/accesos_vigentes?select=estado',
    });
    if (!respuesta.ok) return null;
    const datos = filasAccesoSchema.safeParse(await leerJsonSeguro(respuesta));
    return datos.success ? datos.data : null;
  } catch {
    return null;
  }
}

/** Cierra la sesión en Supabase (revoca la renovación). Es un intento: si falla, la cookie se borra igualmente. */
export async function cerrarSesionEnSupabase(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
): Promise<void> {
  try {
    await fetch(`${config.url}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers: cabeceras(config, accessToken, false),
    });
  } catch {
    // Sin conexión no se puede revocar; la cookie se borra de todas formas.
  }
}

export interface PeticionAuth {
  metodo: 'GET' | 'POST';
  /** Ruta dentro de /auth/v1, con su query string. */
  ruta: string;
  cuerpo?: unknown;
}

/** Petición a GoTrue (/auth/v1) con el token de la propia persona. Solo la usan las rutas del panel de administración. */
export function pedirAuth(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
  peticion: PeticionAuth,
): Promise<Response> {
  return fetch(`${config.url}/auth/v1${peticion.ruta}`, {
    method: peticion.metodo,
    headers: cabeceras(config, accessToken, peticion.cuerpo !== undefined),
    body: peticion.cuerpo === undefined ? undefined : JSON.stringify(peticion.cuerpo),
  });
}

export interface FactorSupabase {
  id: string;
  factor_type: string;
  status: string;
  friendly_name: string | null;
  created_at: string;
}

export type ResultadoFactores =
  { tipo: 'ok'; factores: FactorSupabase[] } | { tipo: 'no-valido' } | { tipo: 'error' };

const factoresSchema = z.object({
  factors: z
    .array(
      z.object({
        id: z.string().min(1),
        factor_type: z.string(),
        status: z.string(),
        friendly_name: z.string().nullish(),
        created_at: z.string(),
      }),
    )
    .nullish(),
});

/**
 * Factores de segundo paso de la persona. Supabase los devuelve dentro del usuario (GET /auth/v1/user, campo `factors`),
 * igual que hace la librería cliente; no hay un endpoint de lista aparte.
 */
export async function leerFactores(
  config: ConfigSupabase,
  fetch: FetchServidor,
  accessToken: string,
): Promise<ResultadoFactores> {
  try {
    const respuesta = await pedirAuth(config, fetch, accessToken, { metodo: 'GET', ruta: '/user' });
    if (respuesta.status === 401 || respuesta.status === 403) return { tipo: 'no-valido' };
    if (!respuesta.ok) return { tipo: 'error' };
    const datos = factoresSchema.safeParse(await leerJsonSeguro(respuesta));
    if (!datos.success) return { tipo: 'error' };
    return {
      tipo: 'ok',
      factores: (datos.data.factors ?? []).map((factor) => ({
        ...factor,
        friendly_name: factor.friendly_name ?? null,
      })),
    };
  } catch {
    return { tipo: 'error' };
  }
}
