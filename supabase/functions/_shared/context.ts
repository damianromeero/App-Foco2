import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0';
import Stripe from 'npm:stripe@23.0.0';

/** Cliente con la clave de servicio: solo para el servidor. Salta la seguridad por fila. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

/** Usuario que hace la petición, identificado por su token. Null si no hay sesión válida. */
export async function currentUser(request: Request): Promise<User | null> {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export function stripeClient(): Stripe {
  return new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '');
}

/** Precio de Stripe según el plan. Los identificadores viven en variables de entorno, no en el código. */
export function priceFor(plan: 'monthly' | 'annual'): string {
  const id =
    plan === 'monthly' ? Deno.env.get('STRIPE_PRICE_MONTHLY') : Deno.env.get('STRIPE_PRICE_ANNUAL');
  if (!id) throw new Error(`Falta el precio de Stripe para el plan ${plan}`);
  return id;
}

export function planFromPrice(priceId: string | null | undefined): 'monthly' | 'annual' | null {
  if (!priceId) return null;
  if (priceId === Deno.env.get('STRIPE_PRICE_MONTHLY')) return 'monthly';
  if (priceId === Deno.env.get('STRIPE_PRICE_ANNUAL')) return 'annual';
  return null;
}
