// Función de Supabase: avisos de compra de Hotmart. Conecta el handler testable (handler.ts) con el entorno de Deno.
// Secretos del servidor (NUNCA con prefijo VITE_): HOTMART_HOTTOK lo defines tú con `supabase secrets set`;
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase en la función. Esta función llega sin sesión
// (verify_jwt = false en supabase/config.toml): su seguridad es el token HOTMART_HOTTOK, comprobado en el handler.
import { manejarAviso } from './handler.ts';

Deno.serve((peticion: Request) =>
  manejarAviso(peticion, {
    env: {
      HOTMART_HOTTOK: Deno.env.get('HOTMART_HOTTOK'),
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    },
    fetch: (entrada, init) => fetch(entrada, init),
  }),
);
