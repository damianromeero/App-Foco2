import { env } from '../config/env';
import { cerrarSesionServidor, leerEstadoSesion } from './sesion';
import { getSupabaseComprador } from './supabase';

/**
 * Persona con sesión, tal como la conoce el servidor. `conAcceso` es la decisión de la base (accesos_vigentes); el
 * navegador no tiene el identificador ni los tokens.
 */
export interface SessionUser {
  email: string | null;
  conAcceso: boolean;
}

/** Usuario de la sesión actual según el servidor (cookie httpOnly). Null sin sesión o sin backend. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const estado = await leerEstadoSesion();
  if (estado.tipo !== 'con-acceso' && estado.tipo !== 'sin-acceso') return null;
  return { email: estado.correo, conAcceso: estado.tipo === 'con-acceso' };
}

/**
 * Envía un enlace de acceso por correo. No hay contraseñas que recordar ni que filtrar.
 * Solo entra quien ya tiene compra: no se crean cuentas nuevas desde aquí.
 */
export async function sendMagicLink(email: string): Promise<void> {
  const supabase = await getSupabaseComprador();
  if (!supabase) {
    throw new Error('La entrada con correo no está disponible ahora.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${env.appUrl}/entrar/confirmar`,
      shouldCreateUser: false,
    },
  });
  if (error) throw error;
}

/** Cierra la sesión: el servidor revoca la renovación y borra la cookie. */
export async function signOut(): Promise<void> {
  await cerrarSesionServidor();
}
