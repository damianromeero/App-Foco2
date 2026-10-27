import { create } from 'zustand';
import { NO_SUBSCRIPTION, type SubscriptionSnapshot } from '../domain/model';
import { billing } from '../services/billing';

interface BillingCache {
  snapshot: SubscriptionSnapshot;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Caché de la suscripción. Se actualiza al entrar en la app y después de cada cambio. */
export const useBillingStore = create<BillingCache>()((set) => ({
  snapshot: NO_SUBSCRIPTION,
  loaded: false,
  error: null,
  refresh: async () => {
    try {
      const snapshot = await billing.getSubscription();
      set({ snapshot, loaded: true, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No pudimos leer tu suscripción.';
      set({ loaded: true, error: message });
    }
  },
}));
