import { adminClient, planFromPrice, stripeClient } from '../_shared/context.ts';
import { json } from '../_shared/http.ts';
import { sendEmail } from '../_shared/email.ts';

/**
 * Webhook de Stripe: mantiene la tabla subscriptions al día.
 * - Verifica la firma de cada evento (si no coincide, se rechaza).
 * - Es idempotente: un evento repetido no se aplica dos veces.
 */

type SubscriptionLike = {
  id: string;
  customer: string | { id: string };
  status: string;
  cancel_at_period_end: boolean;
  trial_end: number | null;
  current_period_end?: number;
  items: { data: { price: { id: string }; current_period_end?: number }[] };
  metadata: Record<string, string>;
  created: number;
};

function unixToIso(value: number | null | undefined): string | null {
  return typeof value === 'number' ? new Date(value * 1000).toISOString() : null;
}

function customerId(value: string | { id: string }): string {
  return typeof value === 'string' ? value : value.id;
}

async function upsertSubscription(subscription: SubscriptionLike): Promise<void> {
  const admin = adminClient();
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const periodEnd =
    subscription.current_period_end ?? subscription.items.data[0]?.current_period_end ?? null;

  let userId = subscription.metadata.user_id ?? null;
  if (!userId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId(subscription.customer))
      .maybeSingle();
    userId = profile?.id ?? null;
  }
  if (!userId) {
    console.error('Suscripción sin usuario asociado', subscription.id);
    return;
  }

  const { data: existing } = await admin
    .from('subscriptions')
    .select('first_paid_at')
    .eq('id', subscription.id)
    .maybeSingle();

  await admin.from('subscriptions').upsert({
    id: subscription.id,
    user_id: userId,
    stripe_customer_id: customerId(subscription.customer),
    status: subscription.status,
    plan: planFromPrice(priceId),
    price_id: priceId,
    trial_end: unixToIso(subscription.trial_end),
    current_period_end: unixToIso(periodEnd),
    cancel_at_period_end: subscription.cancel_at_period_end,
    first_paid_at: existing?.first_paid_at ?? null,
    created_at: unixToIso(subscription.created),
  });
}

async function handleTrialWillEnd(subscription: SubscriptionLike): Promise<void> {
  const admin = adminClient();
  const { data: row } = await admin
    .from('subscriptions')
    .select('user_id')
    .eq('id', subscription.id)
    .maybeSingle();
  if (!row) return;
  const { data: profile } = await admin
    .from('profiles')
    .select('email')
    .eq('id', row.user_id)
    .maybeSingle();
  if (!profile?.email) return;
  await sendEmail({
    to: profile.email,
    subject: 'Tu prueba de Atenzo termina en tres días',
    text: 'Tu prueba termina en tres días. Si no quieres seguir, puedes cancelar desde Cuenta en la app. Sin cobros sorpresa.',
  });
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const signature = request.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return json({ error: 'Firma ausente' }, 400);

  const payload = await request.text();
  const stripe = stripeClient();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return json({ error: 'Firma no válida' }, 400);
  }

  const admin = adminClient();
  const { error: duplicate } = await admin
    .from('billing_events')
    .insert({ id: event.id, type: event.type });
  if (duplicate) {
    // Ya procesado: Stripe reintenta, así que respondemos correcto sin volver a aplicarlo.
    return json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertSubscription(event.data.object as unknown as SubscriptionLike);
        break;
      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as unknown as SubscriptionLike);
        break;
      case 'invoice.paid': {
        const invoice = event.data.object as unknown as {
          subscription: string | null;
          amount_paid: number;
          status_transitions?: { paid_at?: number | null };
        };
        if (invoice.subscription && invoice.amount_paid > 0) {
          const paidAt = unixToIso(invoice.status_transitions?.paid_at ?? null);
          await admin
            .from('subscriptions')
            .update({ first_paid_at: paidAt })
            .eq('id', invoice.subscription)
            .is('first_paid_at', null);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // Si falla, quitamos el registro del evento para que Stripe lo reintente.
    await admin.from('billing_events').delete().eq('id', event.id);
    console.error('Error procesando el evento', event.type, error);
    return json({ error: 'Error interno' }, 500);
  }

  return json({ received: true });
});
