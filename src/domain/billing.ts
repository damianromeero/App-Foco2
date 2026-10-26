import type { SubscriptionSnapshot } from './model';
import { PLANS, REMINDER_DAYS_BEFORE_CHARGE, WITHDRAWAL_DAYS } from './pricing';

export type Entitlement = 'free' | 'premium';

export type BillingPhase =
  | 'gratis'
  | 'prueba'
  | 'prueba-por-terminar'
  | 'activa'
  | 'cancelando'
  | 'pago-pendiente'
  | 'cancelada';

export interface BillingView {
  entitlement: Entitlement;
  phase: BillingPhase;
  /** Días de prueba que quedan (redondeados hacia arriba), o null fuera de la prueba. */
  trialDaysLeft: number | null;
  /** Fecha del siguiente cobro. */
  nextChargeAt: Date | null;
  nextChargeCents: number | null;
  /** Hasta cuándo hay acceso premium cuando la suscripción no se renueva. */
  accessUntil: Date | null;
  canCancel: boolean;
  canResume: boolean;
  /** Desistimiento dentro de los 14 días desde el primer cobro. */
  canWithdraw: boolean;
  withdrawUntil: Date | null;
}

const DAY_MS = 86_400_000;

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

/**
 * Traduce el estado de la suscripción a lo que ve la persona: si tiene acceso premium,
 * en qué fase está y qué puede hacer. Es una función pura: el reloj se pasa como parámetro.
 */
export function describeBilling(subscription: SubscriptionSnapshot, now: Date): BillingView {
  const trialEnd = toDate(subscription.trialEndsAt);
  const periodEnd = toDate(subscription.currentPeriodEnd);
  const firstPaid = toDate(subscription.firstPaidAt);
  const planCents = subscription.plan ? PLANS[subscription.plan].cents : null;

  const withdrawUntil = firstPaid ? new Date(firstPaid.getTime() + WITHDRAWAL_DAYS * DAY_MS) : null;
  const paying = subscription.status === 'active' || subscription.status === 'past_due';
  const canWithdraw = paying && withdrawUntil !== null && now < withdrawUntil;

  const base: BillingView = {
    entitlement: 'free',
    phase: 'gratis',
    trialDaysLeft: null,
    nextChargeAt: null,
    nextChargeCents: null,
    accessUntil: null,
    canCancel: false,
    canResume: false,
    canWithdraw,
    withdrawUntil,
  };

  switch (subscription.status) {
    case 'trialing': {
      if (!trialEnd || now >= trialEnd) {
        return base;
      }
      const daysLeft = Math.max(1, Math.ceil((trialEnd.getTime() - now.getTime()) / DAY_MS));
      if (subscription.cancelAtPeriodEnd) {
        return {
          ...base,
          entitlement: 'premium',
          phase: 'cancelando',
          trialDaysLeft: daysLeft,
          accessUntil: trialEnd,
          canResume: true,
        };
      }
      const ending = daysLeft <= REMINDER_DAYS_BEFORE_CHARGE;
      return {
        ...base,
        entitlement: 'premium',
        phase: ending ? 'prueba-por-terminar' : 'prueba',
        trialDaysLeft: daysLeft,
        nextChargeAt: trialEnd,
        nextChargeCents: planCents,
        canCancel: true,
      };
    }
    case 'active': {
      if (subscription.cancelAtPeriodEnd) {
        if (periodEnd && now < periodEnd) {
          return {
            ...base,
            entitlement: 'premium',
            phase: 'cancelando',
            accessUntil: periodEnd,
            canResume: true,
          };
        }
        return { ...base, phase: 'cancelada' };
      }
      return {
        ...base,
        entitlement: 'premium',
        phase: 'activa',
        nextChargeAt: periodEnd,
        nextChargeCents: planCents,
        canCancel: true,
      };
    }
    case 'past_due': {
      // Ya pagado hasta el fin del periodo: no se corta el acceso por un cobro fallido de inmediato.
      const hasAccess = periodEnd !== null && now < periodEnd;
      return {
        ...base,
        entitlement: hasAccess ? 'premium' : 'free',
        phase: 'pago-pendiente',
        accessUntil: periodEnd,
        canCancel: true,
      };
    }
    case 'canceled':
      return { ...base, phase: 'cancelada' };
    case 'none':
    case 'incomplete':
    case 'unpaid':
      return base;
  }
}

/**
 * Nivel premium de la persona con acceso vigente en la tabla de accesos (regla única de Hotmart). Un acceso vigente
 * (accesos_vigentes) da premium, sin importar el modo de cobro. Qué desbloquea exactamente el plan es una decisión de
 * producto: [VERIFICAR: lista de funciones premium del plan de Hotmart].
 */
export function aplicarAccesoPremium(vista: BillingView, conAcceso: boolean): BillingView {
  if (!conAcceso) return vista;
  return { ...vista, entitlement: 'premium', phase: 'activa' };
}
