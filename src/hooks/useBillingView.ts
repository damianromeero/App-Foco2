import { useMemo } from 'react';
import {
  aplicarAccesoPremium,
  describeBilling,
  type BillingView,
  type Entitlement,
} from '../domain/billing';
import { useAuthStore } from '../store/authStore';
import { useBillingStore } from '../store/billingStore';
import { useNow } from './useNow';

/**
 * Vista de la suscripción para la interfaz: acceso premium, fase y acciones permitidas. El premium lo da un acceso
 * vigente en la tabla de accesos (servidor) o la suscripción de facturación, lo que haya.
 */
export function useBillingView(): BillingView {
  const snapshot = useBillingStore((state) => state.snapshot);
  const conAcceso = useAuthStore((state) => state.user?.conAcceso === true);
  const now = useNow();
  const base = useMemo(() => describeBilling(snapshot, now), [snapshot, now]);
  return useMemo(() => aplicarAccesoPremium(base, conAcceso), [base, conAcceso]);
}

export function useEntitlement(): Entitlement {
  return useBillingView().entitlement;
}
