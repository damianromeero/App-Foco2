/**
 * Estado de acceso al panel. Lo decide el SERVIDOR (/api/admin/sesion) con la cookie httpOnly `foco_admin`: el navegador
 * nunca ve ni guarda tokens de Supabase. Orden de la decisión: nube → sesión → permiso de administradora → segundo factor.
 * Sin nube no hace ninguna llamada. Nunca lanza.
 */
import { isCloudEnabled } from '../services/supabase';
import { llamarApi } from '../services/sesion';

export type EstadoAdmin =
  'sin-backend' | 'sin-sesion' | 'sin-permiso' | 'segundo-factor-pendiente' | 'listo' | 'error';

export const RUTA_SESION_ADMIN = '/api/admin/sesion';

type TipoServidor = 'sin-sesion' | 'sin-admin' | 'sin-mfa' | 'admin' | 'error';

const TIPOS: Record<TipoServidor, EstadoAdmin> = {
  'sin-sesion': 'sin-sesion',
  'sin-admin': 'sin-permiso',
  'sin-mfa': 'segundo-factor-pendiente',
  admin: 'listo',
  error: 'error',
};

function tipoDeServidor(valor: unknown): EstadoAdmin {
  if (typeof valor !== 'object' || valor === null) return 'error';
  const { tipo } = valor as { tipo?: unknown };
  return typeof tipo === 'string' && Object.hasOwn(TIPOS, tipo)
    ? TIPOS[tipo as TipoServidor]
    : 'error';
}

/** Calcula el estado de acceso de la persona que usa el navegador, según el servidor. Nunca lanza. */
export async function estadoAdmin(): Promise<EstadoAdmin> {
  try {
    if (!isCloudEnabled()) return 'sin-backend';
    const respuesta = await llamarApi(RUTA_SESION_ADMIN, 'GET');
    if (respuesta === null) return 'error';
    if (respuesta.status === 503) return 'sin-backend';
    if (!respuesta.ok) return 'error';
    return tipoDeServidor(await respuesta.json());
  } catch {
    return 'error';
  }
}

/**
 * Envía los tokens del enlace de acceso al servidor, que los comprueba y los guarda en la cookie httpOnly. Devuelve false
 * si Supabase no los acepta o si el servidor no responde.
 */
export async function fijarSesionAdmin(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<boolean> {
  if (!isCloudEnabled()) return false;
  const respuesta = await llamarApi(RUTA_SESION_ADMIN, 'POST', tokens);
  return respuesta?.ok === true;
}

/**
 * Página de confirmación: si el enlace trae los tokens en el hash, los entrega al servidor y luego lee el estado. Sin
 * tokens (por ejemplo, al recargar), usa la cookie que ya exista. Nunca lanza.
 */
export async function confirmarEnlaceAdmin(hash: string): Promise<EstadoAdmin> {
  const parametros = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = parametros.get('access_token');
  const refreshToken = parametros.get('refresh_token');
  if (accessToken !== null && refreshToken !== null) {
    const guardada = await fijarSesionAdmin({ accessToken, refreshToken });
    if (!guardada) return 'sin-sesion';
  }
  return estadoAdmin();
}

/** Cierra la sesión de la administradora: el servidor revoca la renovación y borra la cookie. */
export async function cerrarSesionAdmin(): Promise<void> {
  if (!isCloudEnabled()) return;
  const respuesta = await llamarApi(RUTA_SESION_ADMIN, 'DELETE');
  if (!respuesta?.ok) {
    throw new Error('No pudimos cerrar la sesión. Vuelve a intentarlo.');
  }
}
