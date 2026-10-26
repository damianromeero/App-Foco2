export type BillingMode = 'off' | 'demo' | 'stripe';

/** Devuelve el valor sin espacios, o undefined si está vacío. */
function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

const rawMode = optional(import.meta.env.VITE_BILLING_MODE);
const requestedMode: BillingMode = rawMode === 'demo' || rawMode === 'stripe' ? rawMode : 'off';

const supabaseUrl = optional(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = optional(import.meta.env.VITE_SUPABASE_ANON_KEY);
const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Garantías de seguridad:
 * - La prueba "demo" (cobro simulado) nunca llega a una compilación de producción.
 * - El modo "stripe" exige backend configurado; si falta, se queda en "off".
 */
function resolveBillingMode(): BillingMode {
  if (requestedMode === 'demo' && import.meta.env.PROD) return 'off';
  if (requestedMode === 'stripe' && !isCloudConfigured) return 'off';
  return requestedMode;
}

export const env = {
  billingMode: resolveBillingMode(),
  isCloudConfigured,
  supabaseUrl,
  supabaseAnonKey,
  appUrl: optional(import.meta.env.VITE_APP_URL) ?? window.location.origin,
  /** Enlace público de compra de Hotmart. Vacío = compra no configurada. */
  enlaceCompra: optional(import.meta.env.VITE_ENLACE_COMPRA),
  supportEmail: optional(import.meta.env.VITE_SUPPORT_EMAIL),
} as const;
