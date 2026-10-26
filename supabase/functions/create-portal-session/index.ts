import { adminClient, currentUser, stripeClient } from '../_shared/context.ts';
import { isAllowedReturnUrl, json, preflight } from '../_shared/http.ts';

/** Portal de Stripe para cambiar el método de pago y ver facturas. Solo para el propio usuario. */
Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return preflight(origin);
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin);

  const user = await currentUser(request);
  if (!user) return json({ error: 'Necesitas iniciar sesión.' }, 401, origin);

  const body = (await request.json().catch(() => null)) as { returnUrl?: string } | null;
  const returnUrl = body?.returnUrl ?? Deno.env.get('APP_URL') ?? '';
  if (!isAllowedReturnUrl(returnUrl)) {
    return json({ error: 'Dirección de retorno no permitida.' }, 400, origin);
  }

  const { data: profile } = await adminClient()
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile?.stripe_customer_id) {
    return json({ error: 'Todavía no tienes datos de pago.' }, 404, origin);
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: returnUrl,
  });
  return json({ url: session.url }, 200, origin);
});
