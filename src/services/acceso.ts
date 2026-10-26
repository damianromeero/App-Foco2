import { env } from '../config/env';
import { fijarSesion, cerrarSesionServidor, leerEstadoSesion } from './sesion';
import { getSupabaseComprador } from './supabase';

/**
 * Acceso de las personas compradoras. La decisión la toma la base de datos (vista `accesos_vigentes`, RLS) con el token de
 * la propia persona, y la consulta la hace el servidor (/api/sesion). El navegador no guarda la sesión ni los tokens.
 * Ante un error nunca se muestran datos ni se concede acceso.
 */

/** Lo que las pantallas necesitan saber sobre el acceso de la persona que entra. */
export type EstadoAcceso =
  | { tipo: 'sin-backend' }
  | { tipo: 'sin-sesion' }
  | { tipo: 'sin-acceso'; correo: string }
  | { tipo: 'con-acceso'; correo: string }
  | { tipo: 'error' };

// [VERIFICAR] Códigos de Supabase Auth para «registros no permitidos» (auth-js 2.118). Confirmar con una respuesta real.
const CODIGOS_SIN_REGISTRO = new Set(['signup_disabled', 'otp_disabled']);
const TEXTO_SIN_REGISTRO = /signups? not allowed/i;

/** Correo en minúsculas y sin espacios: la forma que se compara con `accesos`. */
export function normalizarCorreo(valor: string): string {
  return valor.trim().toLowerCase();
}

/** Correo enmascarado para mostrar en pantalla (`c***@example.com`). Vacío si el texto no tiene forma de correo. */
export function enmascararCorreo(correo: string): string {
  const limpio = correo.trim();
  const arroba = limpio.lastIndexOf('@');
  if (arroba <= 0) return '';
  return `${limpio.charAt(0)}***${limpio.slice(arroba)}`;
}

/** Enlace de compra, solo si es una dirección https. Sin enlace, la pantalla dice que la compra no está configurada. */
export function enlaceDeCompra(): string | null {
  const enlace = env.enlaceCompra;
  return enlace && /^https:\/\/\S+$/.test(enlace) ? enlace : null;
}

function esRegistroNoPermitido(error: { code?: string; message?: string }): boolean {
  if (error.code !== undefined && CODIGOS_SIN_REGISTRO.has(error.code)) return true;
  return TEXTO_SIN_REGISTRO.test(error.message ?? '');
}

/**
 * Pide el enlace de acceso. Con `shouldCreateUser: false` no se crea ninguna cuenta: si el correo no tiene compra, no llega
 * nada. Si Supabase responde que no se permiten registros, se trata como un envío normal, para que la pantalla no revele
 * si el correo tiene compra. Cualquier otro fallo se lanza.
 */
export async function enviarEnlaceDeAcceso(correo: string): Promise<void> {
  const supabase = await getSupabaseComprador();
  if (!supabase) throw new Error('La entrada con correo no está disponible ahora.');
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizarCorreo(correo),
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${env.appUrl}/entrar/confirmar`,
    },
  });
  if (error && !esRegistroNoPermitido(error)) throw error;
}

/** Estado de acceso de la sesión actual, según el servidor. Nunca lanza: cualquier fallo devuelve `error`. */
export async function leerEstadoAcceso(): Promise<EstadoAcceso> {
  const estado = await leerEstadoSesion();
  switch (estado.tipo) {
    case 'sin-backend':
      return { tipo: 'sin-backend' };
    case 'sin-sesion':
      return { tipo: 'sin-sesion' };
    case 'con-acceso':
    case 'sin-acceso':
      return estado.correo === null
        ? { tipo: 'error' }
        : { tipo: estado.tipo, correo: estado.correo };
    case 'error':
      return { tipo: 'error' };
  }
}

/**
 * Página de confirmación: si el enlace trae los tokens en el hash, los envía al servidor, que los guarda en la cookie
 * httpOnly. Sin tokens (por ejemplo, al recargar), usa la cookie que ya exista. La página borra el hash antes de llamar.
 */
export async function confirmarEnlace(hash: string): Promise<EstadoAcceso> {
  const parametros = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = parametros.get('access_token');
  const refreshToken = parametros.get('refresh_token');
  if (accessToken !== null && refreshToken !== null) {
    const guardada = await fijarSesion({ accessToken, refreshToken });
    if (!guardada) return { tipo: 'sin-sesion' };
  }
  return leerEstadoAcceso();
}

/** Cierra la sesión del servidor. Sin nube no hay sesión que cerrar. */
export async function cerrarSesionDeAcceso(): Promise<void> {
  await cerrarSesionServidor();
}
