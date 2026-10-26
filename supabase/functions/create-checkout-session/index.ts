import { adminClient, currentUser, priceFor, stripeClient } from '../_shared/context.ts';
import { isAllowedReturnUrl, json, preflight } from '../_shared/http.ts';

/**
 * Crea una sesión de Stripe Checkout con prueba de 7 días.
 * - Se pide método de pago desde el primer momento: la prueba termina en un cobro solo si la persona sigue.
 * - Si no hay método de pago al terminar la prueba, la suscripción se cancela y no se cobra nada.
 */
Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return preflight(origin);
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin);

  const user = await currentUser(request);
  if (!user) return json({ error: 'Necesitas iniciar sesión.' }, 401, origin);

  const body = (await request.json().catch(() => null)) as {
    plan?: string;
    returnUrl?: string;
  } | null;
  if (body?.plan !== 'monthly' && body?.plan !== 'annual') {
    return json({ error: 'Plan no válido.' }, 400, origin);
  }
  const returnUrl = body.returnUrl ?? Deno.env.get('APP_URL') ?? '';
  if (!isAllowedReturnUrl(returnUrl)) {
    return json({ error: 'Dirección de retorno no permitida.' }, 400, origin);
  }

  const admin = adminClient();
  const { data: active } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .in('status', ['trialing', 'active', 'past_due'])
    .limit(1)
    .maybeSingle();
  if (active) {
    return json({ error: 'Ya tienes una suscripción activa o en prueba.' }, 409, origin);
  }

  const stripe = stripeClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  let customerId = profile?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: priceFor(body.plan), quantity: 1 }],
    payment_method_collection: 'always',
    subscription_data: {
      trial_period_days: 7,
      trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      metadata: { user_id: user.id, plan: body.plan },
    },
    success_url: `${returnUrl.replace(/\/$/, '')}/checkout?estado=ok`,
    cancel_url: `${returnUrl.replace(/\/$/, '')}/checkout?estado=cancelado`,
    locale: 'es',
    allow_promotion_codes: false,
  });

  if (!session.url) {
    return json({ error: 'No se pudo abrir el pago.' }, 502, origin);
  }
  return json({ url: session.url }, 200, origin);
});
