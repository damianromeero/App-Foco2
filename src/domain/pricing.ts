/**
 * Planes y condiciones comerciales. Los importes están en centavos de dólar (USD) para evitar errores de redondeo.
 * Precios: US$4,99 al mes y US$39,90 al año. Confirma tu oferta en Hotmart antes de vender.
 * El anual son ocho mensualidades, por eso se presenta como «cuatro meses gratis».
 */
export const PLAN_IDS = ['monthly', 'annual'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLANS: Record<PlanId, { label: string; cents: number; periodLabel: string }> = {
  monthly: { label: 'Mensual', cents: 499, periodLabel: 'al mes' },
  annual: { label: 'Anual', cents: 3990, periodLabel: 'al año' },
};

/** Cómo se presenta el ahorro del plan anual. Debe coincidir con `mesesGratisAnual()`. */
export const ANNUAL_BONUS = 'cuatro meses gratis';

/**
 * Días de prueba gratuita que anuncian la portada, los precios y el paywall. El cobro lo gestiona Hotmart:
 * configura la misma prueba de 7 días en tu producto de Hotmart. El modo demo simula esta prueba con este número
 * y la función de Stripe usa el mismo valor en `trial_period_days`.
 */
export const TRIAL_DAYS = 7;
/** Aviso previo al primer cobro de Stripe. Con Hotmart, la app no avisa de cobros. */
export const REMINDER_DAYS_BEFORE_CHARGE = 3;
/** Plazo legal de desistimiento de la pasarela Stripe. Confirma con tu abogado cómo encaja con la garantía (docs/LEGAL.md). */
export const WITHDRAWAL_DAYS = 14;

/** Precio mensual equivalente del plan, en centavos de dólar. */
export function monthlyEquivalentCents(plan: PlanId): number {
  return Math.round(PLANS[plan].cents / (plan === 'annual' ? 12 : 1));
}

/** Meses que el plan anual regala frente a doce mensualidades (con los precios actuales, cuatro). */
export function mesesGratisAnual(): number {
  return Math.round(12 - PLANS.annual.cents / PLANS.monthly.cents);
}

/** Porcentaje que ahorra el plan anual frente a doce mensualidades, redondeado (con los precios actuales, 33). */
export function ahorroAnualPorcentaje(): number {
  return Math.round((1 - PLANS.annual.cents / (PLANS.monthly.cents * 12)) * 100);
}

/** Etiqueta del plan anual en las tarjetas de precios. */
export function etiquetaAhorroAnual(): string {
  return `Ahorras ${ahorroAnualPorcentaje()} %`;
}

/** Formato de dólares: US$4,99 (coma decimal, dos cifras, símbolo delante). */
export function formatUSD(cents: number): string {
  const amount = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return `US$${amount}`;
}
