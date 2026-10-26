/**
 * Ruta /api/sincronizacion (lógica pura; api/sincronizacion.ts la conecta a Vercel).
 *
 * Sustituye a las consultas directas a `daily_sessions` que hacía src/services/sync.ts. Todo va con el token de la
 * propia persona: RLS decide qué filas se leen, escriben o borran. Nunca con la clave de servicio.
 *
 *  GET     { filas: [{ date_key, completed_at, duration_sec, payload }] } de la persona.
 *  POST    { filas: [...] } con el mismo formato. El `user_id` lo pone el servidor a partir del token verificado; el
 *          que llegue en el cuerpo se ignora. Hasta 500 filas y 1 MB por petición. Upsert por (user_id, date_key).
 *  DELETE  borra todas las sesiones de la persona.
 *
 * La fusión de sesiones y la validación de cada fila siguen en el navegador (src/domain/sync.ts y sync.ts).
 */
import { z } from 'zod';
import { cookieBorrada, cookieDeSesion, tokensDeLaPeticion } from './cookie';
import {
  configuracionSupabase,
  leerJson,
  leerJsonSeguro,
  origenPermitido,
  respuestaJson,
  respuestaNoPermitida,
  sinBackend,
  type ConfigSupabase,
  type DependenciasServidor,
} from './http';
import { resolverSesion, type SesionValida } from './sesion';
import { pedirRest } from './supabase';

const METODOS = ['GET', 'POST', 'DELETE'] as const;
const LIMITE_CUERPO = 1_000_000;
export const MAXIMO_FILAS = 500;
const COLUMNAS = 'date_key,completed_at,duration_sec,payload';

const filaSchema = z.object({
  date_key: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed_at: z.string().min(1).max(64),
  duration_sec: z.number().int().min(0).max(86_400),
  payload: z.object({
    games: z.array(z.unknown()),
    reflection: z.unknown(),
  }),
});
const cuerpoSchema = z.object({ filas: z.array(filaSchema).max(MAXIMO_FILAS) });
const listaSchema = z.array(z.unknown());

type Fila = z.infer<typeof filaSchema>;

export async function manejarSincronizacion(
  request: Request,
  deps: DependenciasServidor,
): Promise<Response> {
  if (!(METODOS as readonly string[]).includes(request.method))
    return respuestaNoPermitida(METODOS);
  if (request.method !== 'GET' && !origenPermitido(request)) {
    return respuestaJson(403, { tipo: 'origen-no-permitido' });
  }
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const tokens = tokensDeLaPeticion(request);
  if (tokens === null) return respuestaJson(401, { tipo: 'sin-sesion' });

  const sesion = await resolverSesion(tokens, config, deps.fetch);
  if (sesion.tipo === 'sin-sesion') {
    return respuestaJson(
      401,
      { tipo: 'sin-sesion' },
      sesion.borrarCookie ? [cookieBorrada(request)] : [],
    );
  }
  if (sesion.tipo === 'error') return respuestaJson(502, { tipo: 'error' });

  const cookies = sesion.renovada ? [cookieDeSesion(sesion.tokens, request)] : [];
  try {
    if (request.method === 'GET') return await leer(config, deps, sesion, cookies);
    if (request.method === 'POST') return await guardar(request, config, deps, sesion, cookies);
    return await borrar(config, deps, sesion, cookies);
  } catch {
    return respuestaJson(502, { tipo: 'error' }, cookies);
  }
}

async function leer(
  config: ConfigSupabase,
  deps: DependenciasServidor,
  sesion: SesionValida,
  cookies: readonly string[],
): Promise<Response> {
  const respuesta = await pedirRest(config, deps.fetch, sesion.tokens.accessToken, {
    metodo: 'GET',
    ruta: `/daily_sessions?select=${COLUMNAS}`,
  });
  if (!respuesta.ok) return respuestaJson(502, { tipo: 'error' }, cookies);
  const filas = listaSchema.safeParse(await leerJsonSeguro(respuesta));
  if (!filas.success) return respuestaJson(502, { tipo: 'error' }, cookies);
  return respuestaJson(200, { filas: filas.data }, cookies);
}

async function guardar(
  request: Request,
  config: ConfigSupabase,
  deps: DependenciasServidor,
  sesion: SesionValida,
  cookies: readonly string[],
): Promise<Response> {
  const lectura = await leerJson(request, LIMITE_CUERPO);
  if (!lectura.ok) {
    return lectura.motivo === 'demasiado-grande'
      ? respuestaJson(413, { tipo: 'demasiado-grande' }, cookies)
      : respuestaJson(400, { tipo: 'datos-no-validos' }, cookies);
  }
  const cuerpo = cuerpoSchema.safeParse(lectura.valor);
  if (!cuerpo.success) return respuestaJson(400, { tipo: 'datos-no-validos' }, cookies);

  const filas = unicasPorDia(cuerpo.data.filas);
  if (filas.length === 0) return respuestaJson(200, { ok: true, guardadas: 0 }, cookies);

  const respuesta = await pedirRest(config, deps.fetch, sesion.tokens.accessToken, {
    metodo: 'POST',
    ruta: '/daily_sessions?on_conflict=user_id,date_key',
    prefer: 'resolution=merge-duplicates,return=minimal',
    cuerpo: filas.map((fila) => ({
      user_id: sesion.usuario.id,
      date_key: fila.date_key,
      completed_at: fila.completed_at,
      duration_sec: fila.duration_sec,
      payload: { games: fila.payload.games, reflection: fila.payload.reflection },
    })),
  });
  if (!respuesta.ok) return respuestaJson(502, { tipo: 'error' }, cookies);
  return respuestaJson(200, { ok: true, guardadas: filas.length }, cookies);
}

async function borrar(
  config: ConfigSupabase,
  deps: DependenciasServidor,
  sesion: SesionValida,
  cookies: readonly string[],
): Promise<Response> {
  const respuesta = await pedirRest(config, deps.fetch, sesion.tokens.accessToken, {
    metodo: 'DELETE',
    ruta: `/daily_sessions?user_id=eq.${encodeURIComponent(sesion.usuario.id)}`,
    prefer: 'return=minimal',
  });
  if (!respuesta.ok) return respuestaJson(502, { tipo: 'error' }, cookies);
  return respuestaJson(200, { ok: true }, cookies);
}

/** PostgreSQL no admite dos filas iguales en un mismo upsert: se queda la última de cada día. */
function unicasPorDia(filas: readonly Fila[]): Fila[] {
  const porDia = new Map<string, Fila>();
  for (const fila of filas) porDia.set(fila.date_key, fila);
  return [...porDia.values()];
}
