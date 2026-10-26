/**
 * Utilidades comunes de las rutas de sesión (Vercel, runtime edge). PURO: `env` y `fetch` llegan inyectados, así las
 * pruebas de api/ usan un Supabase falso sin red.
 *
 * Reglas de este módulo y de las rutas que lo usan:
 *  - Solo llega la clave ANON de Supabase (SUPABASE_ANON_KEY). La clave de servicio no se lee en ningún punto del
 *    servidor de la app: la base decide con el token de la propia persona (RLS).
 *  - Las respuestas no se cachean y nunca llevan tokens en el cuerpo ni en cabeceras que el navegador lea.
 *  - Las peticiones que cambian algo (POST y DELETE) rechazan un Origin distinto del de la app.
 */

export type FetchServidor = (entrada: string, init?: RequestInit) => Promise<Response>;

export interface DependenciasServidor {
  /** Variables del servidor: SUPABASE_URL y SUPABASE_ANON_KEY. Nunca variables VITE_. */
  env: Readonly<Record<string, string | undefined>>;
  fetch: FetchServidor;
}

export interface ConfigSupabase {
  /** URL del proyecto sin barra final, por ejemplo https://abc.supabase.co. */
  url: string;
  /** Clave anon: la única clave de Supabase que usa el servidor de sesión. */
  anonKey: string;
}

/** Configuración de Supabase, o null si falta alguna variable. Entonces las rutas responden 503 sin-backend. */
export function configuracionSupabase(
  env: Readonly<Record<string, string | undefined>>,
): ConfigSupabase | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '') ?? '';
  const anonKey = env.SUPABASE_ANON_KEY?.trim() ?? '';
  if (url === '' || anonKey === '') return null;
  return { url, anonKey };
}

/** Respuesta JSON sin caché. Las cookies se añaden como cabeceras Set-Cookie. */
export function respuestaJson(
  status: number,
  cuerpo: Record<string, unknown>,
  cookies: readonly string[] = [],
): Response {
  const cabeceras = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  for (const cookie of cookies) cabeceras.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(cuerpo), { status, headers: cabeceras });
}

export function sinBackend(): Response {
  return respuestaJson(503, { tipo: 'sin-backend' });
}

export function respuestaNoPermitida(permitidos: readonly string[]): Response {
  return new Response(JSON.stringify({ tipo: 'metodo-no-permitido' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      Allow: permitidos.join(', '),
    },
  });
}

/**
 * Un navegador envía Origin en todo POST y DELETE. Si viene y no es el de esta app, la petición es de otro sitio y se
 * rechaza. Sin cabecera (cliente que no es un navegador) no hay riesgo de CSRF: se deja pasar.
 */
export function origenPermitido(request: Request): boolean {
  const origen = request.headers.get('origin');
  return origen === null || origen === new URL(request.url).origin;
}

/** Lee el cuerpo como JSON. `limite` es el tamaño máximo en caracteres: nada grande llega a analizarse. */
export async function leerJson(
  request: Request,
  limite: number,
): Promise<
  { ok: true; valor: unknown } | { ok: false; motivo: 'demasiado-grande' | 'no-es-json' }
> {
  let texto: string;
  try {
    texto = await request.text();
  } catch {
    return { ok: false, motivo: 'no-es-json' };
  }
  if (texto.length > limite) return { ok: false, motivo: 'demasiado-grande' };
  try {
    return { ok: true, valor: JSON.parse(texto) as unknown };
  } catch {
    return { ok: false, motivo: 'no-es-json' };
  }
}

/** Cuerpo de una respuesta de Supabase como valor desconocido. Null si no es JSON. */
export async function leerJsonSeguro(respuesta: Response): Promise<unknown> {
  try {
    return (await respuesta.json()) as unknown;
  } catch {
    return null;
  }
}
