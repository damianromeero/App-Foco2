import { z } from 'zod';
import { env, type BillingMode } from '../config/env';
import { DAY_MS } from '../domain/time';
import {
  NO_SUBSCRIPTION,
  subscriptionSnapshotSchema,
  type SubscriptionSnapshot,
} from '../domain/model';
import { TRIAL_DAYS, type PlanId } from '../domain/pricing';
import { useAppStore } from '../store/appStore';
import { invokeFunction } from './functions';
import { getSupabase, isCloudEnabled } from './supabase';

type SupabaseClient = NonNullable<Awaited<ReturnType<typeof getSupabase>>>;

/**
 * Contrato de facturación. Hay tres implementaciones:
 * - "off": sin pagos. La app gratuita funciona entera.
 * - "demo": simula la prueba en este navegador. Solo para desarrollo y pruebas.
 * - "stripe": pagos reales a través de Supabase Edge Functions.
 */
export interface BillingProvider {
  readonly mode: BillingMode;
  getSubscription(): Promise<SubscriptionSnapshot>;
  startCheckout(plan: PlanId): Promise<void>;
  openPortal(): Promise<void>;
  cancel(): Promise<void>;
  resume(): Promise<void>;
  withdraw(): Promise<void>;
  /** Solo en demo: simula el primer cobro para probar las fases de la suscripción. */
  simulateFirstCharge?(plan: PlanId): Promise<void>;
}

const NOT_AVAILABLE = 'Esta acción no está disponible aquí. Los pagos se gestionan en Hotmart.';

class UnavailableBilling implements BillingProvider {
  readonly mode = 'off' as const;

  getSubscription(): Promise<SubscriptionSnapshot> {
    return Promise.resolve(NO_SUBSCRIPTION);
  }

  startCheckout(): Promise<void> {
    return Promise.reject(new Error(NOT_AVAILABLE));
  }

  openPortal(): Promise<void> {
    return Promise.reject(new Error(NOT_AVAILABLE));
  }

  cancel(): Promise<void> {
    return Promise.reject(new Error(NOT_AVAILABLE));
  }

  resume(): Promise<void> {
    return Promise.reject(new Error(NOT_AVAILABLE));
  }

  withdraw(): Promise<void> {
    return Promise.reject(new Error(NOT_AVAILABLE));
  }
}

class DemoBilling implements BillingProvider {
  readonly mode = 'demo' as const;

  getSubscription(): Promise<SubscriptionSnapshot> {
    return Promise.resolve(useAppStore.getState().demoBilling ?? NO_SUBSCRIPTION);
  }

  startCheckout(plan: PlanId): Promise<void> {
    const trialEnd = new Date(Date.now() + TRIAL_DAYS * DAY_MS);
    useAppStore.getState().setDemoBilling({
      status: 'trialing',
      plan,
      trialEndsAt: trialEnd.toISOString(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      firstPaidAt: null,
    });
    return Promise.resolve();
  }

  openPortal(): Promise<void> {
    return Promise.reject(new Error('El portal de pago solo existe con la facturación real.'));
  }

  cancel(): Promise<void> {
    const current = useAppStore.getState().demoBilling;
    if (current) {
      useAppStore.getState().setDemoBilling({ ...current, cancelAtPeriodEnd: true });
    }
    return Promise.resolve();
  }

  resume(): Promise<void> {
    const current = useAppStore.getState().demoBilling;
    if (current) {
      useAppStore.getState().setDemoBilling({ ...current, cancelAtPeriodEnd: false });
    }
    return Promise.resolve();
  }

  withdraw(): Promise<void> {
    useAppStore.getState().setDemoBilling({ ...NO_SUBSCRIPTION, status: 'canceled' });
    return Promise.resolve();
  }

  simulateFirstCharge(plan: PlanId): Promise<void> {
    const now = new Date();
    const days = plan === 'annual' ? 365 : 30;
    useAppStore.getState().setDemoBilling({
      status: 'active',
      plan,
      trialEndsAt: null,
      currentPeriodEnd: new Date(now.getTime() + days * DAY_MS).toISOString(),
      cancelAtPeriodEnd: false,
      firstPaidAt: now.toISOString(),
    });
    return Promise.resolve();
  }
}

interface SubscriptionRow {
  status: string;
  plan: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  first_paid_at: string | null;
}

const subscriptionRowSchema = z.object({
  status: z.string(),
  plan: z.string().nullable(),
  trial_end: z.string().nullable(),
  current_period_end: z.string().nullable(),
  cancel_at_period_end: z.boolean(),
  first_paid_at: z.string().nullable(),
});

/** Valida la fila que llega de la base de datos. Si no es válida, se trata como sin suscripción. */
function parseRow(value: unknown): SubscriptionSnapshot {
  const parsed = subscriptionRowSchema.safeParse(value);
  return parsed.success ? fromRow(parsed.data) : NO_SUBSCRIPTION;
}

function fromRow(row: SubscriptionRow): SubscriptionSnapshot {
  const parsed = subscriptionSnapshotSchema.safeParse({
    status: row.status,
    plan: row.plan,
    trialEndsAt: row.trial_end,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    firstPaidAt: row.first_paid_at,
  });
  return parsed.success ? parsed.data : NO_SUBSCRIPTION;
}

class StripeBilling implements BillingProvider {
  readonly mode = 'stripe' as const;

  /** El cliente se obtiene al usarlo, así la librería no se descarga en la primera visita. */
  private async client(): Promise<SupabaseClient> {
    const client = await getSupabase();
    if (!client) throw new Error(NOT_AVAILABLE);
    return client;
  }

  async getSubscription(): Promise<SubscriptionSnapshot> {
    const client = await this.client();
    const { data: auth } = await client.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return NO_SUBSCRIPTION;

    const { data, error } = await client
      .from('subscriptions')
      .select('status, plan, trial_end, current_period_end, cancel_at_period_end, first_paid_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return parseRow(data);
  }

  async startCheckout(plan: PlanId): Promise<void> {
    const client = await this.client();
    const data = await invokeFunction<{ url?: string }>(client, 'create-checkout-session', {
      plan,
      returnUrl: env.appUrl,
    });
    if (!data?.url) throw new Error('No se pudo abrir el pago. Inténtalo de nuevo.');
    window.location.assign(data.url);
  }

  async openPortal(): Promise<void> {
    const client = await this.client();
    const data = await invokeFunction<{ url?: string }>(client, 'create-portal-session', {
      returnUrl: `${env.appUrl}/cuenta`,
    });
    if (!data?.url) throw new Error('No se pudo abrir la gestión de pagos.');
    window.location.assign(data.url);
  }

  async cancel(): Promise<void> {
    const client = await this.client();
    await invokeFunction(client, 'cancel-subscription', { action: 'cancel' });
  }

  async resume(): Promise<void> {
    const client = await this.client();
    await invokeFunction(client, 'cancel-subscription', { action: 'resume' });
  }

  async withdraw(): Promise<void> {
    const client = await this.client();
    await invokeFunction(client, 'withdraw-subscription');
  }
}

function createBillingProvider(): BillingProvider {
  if (env.billingMode === 'demo') return new DemoBilling();
  if (env.billingMode === 'stripe' && isCloudEnabled()) return new StripeBilling();
  return new UnavailableBilling();
}

export const billing: BillingProvider = createBillingProvider();
