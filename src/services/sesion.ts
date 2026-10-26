import { isCloudEnabled } from './supabase';

/**
 * Sesión de la persona compradora, leída y guardada por el SERVIDOR (/api) en una cookie httpOnly `foco_sesion`. El
 * navegador nunca ve los tokens de Supabase: ni los guarda en localStorage ni los lee. Este módulo solo habla con /api.
 * Sin backend configurado no llama a ninguna ruta (modo local).
 */

export interface RespuestaSesion {
  tipo: 'sin-backend' | 'sin-sesion' | 'sin-acceso' | 'con-acceso' | 'error';
  correo: string | null;
}

const RUTA_SESION = '/api/sesion';
const RUTA_SINCRONIZACION = '/api/sincronizacion';
const RUTA_CUENTA = '/api/cuenta';

const TIPOS = new Set<RespuestaSesion['tipo']>([
  'sin-backend',
  'sin-sesion',
  'sin-acceso',
  'con-acceso',
  'error',
]);

/** Llamada JSON a una ruta de /api, con la cookie de la sesión. Nunca lanza: un fallo de red es `null`. */
export async function llamarApi(
  ruta: string,
  metodo: 'GET' | 'POST' | 'PUT' | 'DELETE',
  cuerpo?: unknown,
): Promise<Response | null> {
  try {
    const cabeceras: Record<string, string> = {};
    if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
    return await fetch(ruta, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: cabeceras,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    return null;
  }
}

function esRespuestaSesion(valor: unknown): valor is RespuestaSesion {
  if (typeof valor !== 'object' || valor === null) return false;
  const { tipo, correo } = valor as Record<string, unknown>;
  return (
    typeof tipo === 'string' &&
    TIPOS.has(tipo as RespuestaSesion['tipo']) &&
    (correo === null || typeof correo === 'string')
  );
}

/** Estado de la sesión y del acceso, según el servidor. Nunca lanza. */
export async function leerEstadoSesion(): Promise<RespuestaSesion> {
  if (!isCloudEnabled()) return { tipo: 'sin-backend', correo: null };
  const respuesta = await llamarApi(RUTA_SESION, 'GET');
  if (respuesta === null) return { tipo: 'error', correo: null };
  if (respuesta.status === 503) return { tipo: 'sin-backend', correo: null };
  if (!respuesta.ok) return { tipo: 'error', correo: null };
  try {
    const cuerpo: unknown = await respuesta.json();
    return esRespuestaSesion(cuerpo) ? cuerpo : { tipo: 'error', correo: null };
  } catch {
    return { tipo: 'error', correo: null };
  }
}

/**
 * Envía los tokens del enlace de acceso al servidor, que los comprueba y guarda en la cookie httpOnly. Devuelve false si
 * Supabase no los acepta o si el servidor no está disponible.
 */
export async function fijarSesion(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<boolean> {
  if (!isCloudEnabled()) return false;
  const respuesta = await llamarApi(RUTA_SESION, 'POST', tokens);
  return respuesta?.ok === true;
}

/** Cierra la sesión: el servidor revoca la renovación y borra la cookie. */
export async function cerrarSesionServidor(): Promise<void> {
  if (!isCloudEnabled()) return;
  await llamarApi(RUTA_SESION, 'DELETE');
}

export { RUTA_CUENTA, RUTA_SINCRONIZACION };
