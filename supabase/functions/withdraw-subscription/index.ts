import { adminClient, currentUser, stripeClient } from '../_shared/context.ts';
import { json, preflight } from '../_shared/http.ts';
import { sendEmail } from '../_shared/email.ts';

const WITHDRAWAL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Desistimiento del contrato (14 días desde el primer cobro, con devolución).
 * Es distinto de cancelar: cancelar detiene la renovación; desistir anula el contrato y devuelve el importe.
 */
Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return preflight(origin);
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin);

  const user = await currentUser(request);
  if (!user) return json({ error: 'Necesitas iniciar sesión.' }, 401, origin);

  const admin = adminClient();
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id, first_paid_at, status')
    .eq('user_id', user.id)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription?.first_paid_at) {
    return json({ error: 'No hay ningún cobro que desistir.' }, 404, origin);
  }

  const receivedAt = Date.now();
  const firstPaid = Date.parse(subscription.first_paid_at);
  if (receivedAt - firstPaid > WITHDRAWAL_MS) {
    return json({ error: 'El plazo de 14 días para desistir ha terminado.' }, 409, origin);
  }

  const stripe = stripeClient();
  await stripe.subscriptions.cancel(subscription.id);

  const invoices = await stripe.invoices.list({
    subscription: subscription.id,
    status: 'paid',
    limit: 1,
  });
  const invoice = invoices.data[0];
  const paymentIntent = invoice?.payments?.data[0]?.payment?.payment_intent;
  if (typeof paymentIntent === 'string') {
    await stripe.refunds.create({ payment_intent: paymentIntent });
  }

  await admin.from('subscriptions').update({ status: 'canceled' }).eq('id', subscription.id);

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: 'Hemos registrado tu desistimiento',
      text: `Hemos recibido tu desistimiento el ${new Date(receivedAt).toISOString()}. Te devolvemos el importe por el mismo medio de pago en un plazo máximo de 14 días.`,
    });
  }

  return json({ ok: true, receivedAt: new Date(receivedAt).toISOString() }, 200, origin);
});
