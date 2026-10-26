/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Modo de facturación: off | demo | stripe. Por defecto, off. */
  readonly VITE_BILLING_MODE?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_URL?: string;
  /** Enlace público de compra en Hotmart (https). Vacío = la compra todavía no está configurada. */
  readonly VITE_ENLACE_COMPRA?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
