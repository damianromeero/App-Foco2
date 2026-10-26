import { medicionAnonima } from '../_shared/eventos.ts';
import { crearManejadorEventos } from './handler.ts';

/**
 * Medición anónima de la app. Sin sesión: la llama el navegador con la clave pública (verify_jwt = false en config.toml).
 * Está APAGADA mientras `medicionAnonima` (supabase/functions/_shared/eventos.ts) sea false: responde 204 y no guarda nada.
 * Encendida, valida el evento contra la lista cerrada y lo guarda con `registrar_evento_app`, que vuelve a validarlo y
 * aplica el límite por dispositivo y total. Solo usa la clave pública (anon): la función de la base tiene permisos mínimos.
 */
Deno.serve(
  crearManejadorEventos({
    medicionAnonima,
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    anonKey: Deno.env.get('SUPABASE_ANON_KEY'),
    fetch,
    appUrl: Deno.env.get('APP_URL'),
  }),
);
