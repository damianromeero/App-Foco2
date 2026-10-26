/**
 * Cliente mínimo de Supabase con fetch inyectado: PostgREST (/rest/v1) y la API de administración de Auth (/auth/v1/admin).
 * PURO: sin API de Deno, sin `npm:` y sin supabase-js, así Vitest lo importa con un fetch falso. Usa la CLAVE DE SERVICIO,
 * que salta RLS: solo debe construirse dentro de la función del servidor, después de comprobar el token del aviso.
 *
 * Ningún fallo devuelve el cuerpo de la respuesta de la base ni la URL: así no se filtran datos en los mensajes ni en los
 * registros.
 */

/**
 * Nombre de la variable de la clave de servicio. Vive solo aquí, dentro de supabase/functions/: las pruebas lo importan
 * como clave calculada. Así el nombre literal no aparece fuera de esa carpeta (regla E5 del gate).
 */
export const NOMBRE_CLAVE_SERVICIO = 'SUPABASE_SERVICE_ROLE_KEY';

/** Firma de fetch que necesita el cliente. El `fetch` global de Deno la cumple. */
export type Fetch = (entrada: string, init?: RequestInit) => Promise<Response>;

export interface ConfigSupabase {
  /** URL base del proyecto, por ejemplo https://abc.supabase.co (sin /rest/v1). */
  url: string;
  /** Clave de servicio (SUPABASE_SERVICE_ROLE_KEY). */
  claveServicio: string;
  fetch: Fetch;
  /** Tiempo máximo por petición, en milisegundos. Por defecto 8000. */
  tiempoMaxMs?: number;
}

export interface RespuestaRest<T> {
  ok: boolean;
  status: number;
  datos: T | null;
}

export interface OpcionesRest {
  metodo?: 'GET' | 'POST' | 'PATCH';
  cuerpo?: unknown;
  /** Cabecera Prefer de PostgREST: return=minimal, return=representation, resolution=ignore-duplicates… */
  prefer?: string;
}

export type Rest = <T = unknown>(
  ruta: string,
  opciones?: OpcionesRest,
) => Promise<RespuestaRest<T>>;

/** Fallo del guardado de un aviso. El código no lleva datos personales: solo qué paso falló y el estado HTTP. */
export class ErrorAviso extends Error {
  codigo: string;
  constructor(codigo: string) {
    super(codigo);
    this.name = 'ErrorAviso';
    this.codigo = codigo;
  }
}

const TIEMPO_MAX_MS = 8_000;

const quitarBarraFinal = (url: string): string => url.trim().replace(/\/+$/, '');

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/**
 * Cliente de PostgREST con la clave de servicio. `ruta` empieza por «/» y lleva sus filtros: `/compras?id_hotmart=eq.X`.
 * Un fallo de red devuelve ok:false con status 502 (no lanza): quien llama decide.
 * Referencias (comprobadas en el código de @supabase/postgrest-js 2.118.0, que es el cliente oficial): `on_conflict` va en
 * la URL; `Prefer: resolution=ignore-duplicates` o `resolution=merge-duplicates` elige el comportamiento ante un conflicto;
 * `select=<columnas>` junto con `Prefer: return=representation` devuelve las filas escritas.
 */
export function crearRest(config: ConfigSupabase): Rest {
  const base = `${quitarBarraFinal(config.url)}/rest/v1`;
  const tiempo = config.tiempoMaxMs ?? TIEMPO_MAX_MS;
  return async <T>(
    ruta: string,
    { metodo = 'GET', cuerpo, prefer }: OpcionesRest = {},
  ): Promise<RespuestaRest<T>> => {
    const cabeceras: Record<string, string> = {
      apikey: config.claveServicio,
      Authorization: `Bearer ${config.claveServicio}`,
      'Content-Type': 'application/json',
    };
    if (prefer) cabeceras.Prefer = prefer;
    try {
      const respuesta = await config.fetch(`${base}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(tiempo),
      });
      const datos = (await respuesta.json().catch(() => null)) as T | null;
      return { ok: respuesta.ok, status: respuesta.status, datos };
    } catch {
      return { ok: false, status: 502, datos: null };
    }
  };
}

/** Códigos de error de Auth que significan «ese correo ya tiene cuenta». */
const CODIGOS_USUARIO_EXISTENTE: ReadonlySet<string> = new Set([
  'email_exists',
  'user_already_exists',
]);

/**
 * ¿La respuesta de Auth dice que el correo ya existe? Mira el código de error (`error_code`, p. ej. email_exists). Si la
 * respuesta no trae código, recurre al texto del mensaje. Un 422 por otra causa (correo inválido para Auth) NO cuenta.
 */
async function usuarioYaExiste(respuesta: Response): Promise<boolean> {
  if (respuesta.status !== 422 && respuesta.status !== 409) return false;
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!esObjeto(datos)) return false;
  const codigo = typeof datos.error_code === 'string' ? datos.error_code : null;
  if (codigo !== null) return CODIGOS_USUARIO_EXISTENTE.has(codigo);
  const mensaje = [datos.msg, datos.message, datos.error_description].find(
    (valor) => typeof valor === 'string',
  );
  return typeof mensaje === 'string' && /already (been )?registered|already exists/i.test(mensaje);
}

/**
 * Crea la cuenta de Supabase Auth del comprador con la API de administración. El registro público está apagado, así que
 * la cuenta nace aquí, con la compra aprobada. `email_confirm: true` la deja confirmada sin enviar ningún correo. Si el
 * correo ya tiene cuenta, Auth responde con un conflicto: en un aviso repetido o en una renovación es lo normal y se da
 * por bueno. Cualquier otro fallo lanza ErrorAviso, para que el handler responda 500 y Hotmart reintente.
 *
 * Endpoint: POST {SUPABASE_URL}/auth/v1/admin/users con { email, email_confirm: true }. Comprobado el 24-oct-2026 en
 * el código fuente oficial de Supabase Auth (github.com/supabase/auth: internal/api/api.go declara `r.Post("/", api.adminUserCreate)`
 * dentro de /admin/users; internal/api/admin.go acepta `email_confirm` y, si el correo existe, responde 422 con el código
 * ErrorCodeEmailExists) y en @supabase/auth-js 2.118.0 (createUser hace POST `${url}/admin/users`; `email_exists` y
 * `user_already_exists` están en sus códigos de error).
 * [VERIFICAR: las páginas de documentación de Supabase (supabase.com/docs) no listan la ruta REST ni el estado de «ya
 * existe»; esta función acepta 422 y 409 junto con el código de error, y trata cualquier otro fallo como error.]
 */
export async function crearUsuarioAuth(config: ConfigSupabase, correo: string): Promise<void> {
  let respuesta: Response;
  try {
    respuesta = await config.fetch(`${quitarBarraFinal(config.url)}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: config.claveServicio,
        Authorization: `Bearer ${config.claveServicio}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: correo, email_confirm: true }),
      signal: AbortSignal.timeout(config.tiempoMaxMs ?? TIEMPO_MAX_MS),
    });
  } catch {
    throw new ErrorAviso('usuario-no-creado-502');
  }
  if (respuesta.ok) return;
  if (await usuarioYaExiste(respuesta)) return;
  throw new ErrorAviso(`usuario-no-creado-${respuesta.status}`);
}
