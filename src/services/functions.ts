import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Llama a una Edge Function de Supabase y devuelve sus datos tipados.
 * Lanza el error de la función si la respuesta no es correcta, para que la interfaz pueda mostrarlo.
 */
export async function invokeFunction<T = unknown>(
  client: SupabaseClient,
  name: string,
  body?: Record<string, unknown>,
): Promise<T | null> {
  const result: { data: unknown; error: unknown } = await client.functions.invoke(name, { body });
  if (result.error) {
    throw result.error instanceof Error
      ? result.error
      : new Error('La operación no se ha completado. Inténtalo de nuevo.');
  }
  return result.data as T | null;
}
