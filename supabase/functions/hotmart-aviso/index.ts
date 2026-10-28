// Función de Supabase: avisos de compra de Hotmart. Conecta el handler testable (handler.ts) con el entorno de Deno.
// Secretos del servidor (NUNCA con prefijo VITE_): HOTMART_HOTTOK lo defines tú con `supabase secrets set`;
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase en la función. Esta función llega sin sesión
// (verify_jwt = false en supabase/config.toml): su seguridad es el token HOTMART_HOTTOK, comprobado en el handler.
// Correos de la app: RESEND_API_KEY, EMAIL_FROM, APP_URL y EMAIL_RESPUESTA son secretos de Supabase (no VITE_).
import { manejarAviso } from './handler.ts';
import { sendEmail } from '../_shared/email.ts';

Deno.serve((peticion: Request) =>
  manejarAviso(peticion, {
    env: {
      HOTMART_HOTTOK: Deno.env.get('HOTMART_HOTTOK'),
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      APP_URL: Deno.env.get('APP_URL'),
      EMAIL_RESPUESTA: Deno.env.get('EMAIL_RESPUESTA'),
    },
    fetch: (entrada, init) => fetch(entrada, init),
    enviarCorreo: sendEmail,
  }),
);
