import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/** Hay backend configurado. Sin él, la app funciona completa en modo local, sin cuentas ni sincronización. */
export function isCloudEnabled(): boolean {
  return env.isCloudConfigured;
}

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Cliente de Supabase, creado la primera vez que hace falta. La librería se descarga solo entonces:
 * sin backend configurado devuelve null sin cargarla.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;
  if (!isCloudEnabled() || !url || !anonKey) return null;
  clientPromise ??= loadClient(url, anonKey).catch((error: unknown) => {
    // Si la descarga falla (por ejemplo, sin conexión), la siguiente llamada lo vuelve a intentar.
    clientPromise = null;
    throw error;
  });
  return clientPromise;
}

/**
 * Cliente solo para ENVIAR el enlace de acceso a la persona compradora. No guarda ninguna sesión: el enlace trae los
 * tokens en el hash, la página los envía al servidor (src/services/sesion.ts) y el servidor los guarda en una cookie
 * httpOnly. Por eso: flujo implícito, sin persistencia, sin renovación automática y sin leer la URL.
 */
let compradoraPromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseComprador(): Promise<SupabaseClient | null> {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;
  if (!isCloudEnabled() || !url || !anonKey) return null;
  compradoraPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, anonKey, {
      auth: {
        flowType: 'implicit',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  );
  return compradoraPromise;
}

async function loadClient(url: string, anonKey: string): Promise<SupabaseClient> {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
