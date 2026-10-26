import { adminClient, currentUser, stripeClient } from '../_shared/context.ts';
import { json, preflight } from '../_shared/http.ts';

/**
 * Cancelar: detiene la renovación y conserva el acceso hasta el final del periodo pagado.
 * Reactivar: deshace la cancelación mientras el periodo siga abierto.
 * Un clic desde la app, sin llamadas ni formularios.
 */
Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return preflight(origin);
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin);

  const user = await currentUser(request);
  if (!user) return json({ error: 'Necesitas iniciar sesión.' }, 401, origin);

  const body = (await request.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== 'cancel' && body?.action !== 'resume') {
    return json({ error: 'Acción no válida.' }, 400, origin);
  }

  const admin = adminClient();
  const { data: subscription } = await admin
    .from('subscriptions')
    .select('id, status')
    .eq('user_id', user.id)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!subscription) {
    return json({ error: 'No hay ninguna suscripción que cambiar.' }, 404, origin);
  }

  const cancelAtPeriodEnd = body.action === 'cancel';
  await stripeClient().subscriptions.update(subscription.id, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
  await admin
    .from('subscriptions')
    .update({ cancel_at_period_end: cancelAtPeriodEnd })
    .eq('id', subscription.id);

  return json({ ok: true, cancelAtPeriodEnd }, 200, origin);
});
