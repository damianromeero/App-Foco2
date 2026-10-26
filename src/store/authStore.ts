import { create } from 'zustand';
import { getSessionUser, type SessionUser } from '../services/auth';
import { isCloudEnabled } from '../services/supabase';

export type AuthStatus = 'cargando' | 'anonimo' | 'conectado' | 'sin-backend';

interface AuthCache {
  status: AuthStatus;
  user: SessionUser | null;
  init: () => void;
  /** Vuelve a leer la sesión del servidor (tras confirmar el enlace, cerrar sesión o borrar la cuenta). */
  refrescar: () => Promise<void>;
  lastSyncAt: string | null;
  markSynced: (at: string) => void;
}

let iniciado = false;

/** Lee la sesión que confirma el servidor (cookie httpOnly). No hay suscripción en el navegador. */
async function leerSesion(set: (partial: Partial<AuthCache>) => void): Promise<void> {
  const user = await getSessionUser();
  set({ user, status: user ? 'conectado' : 'anonimo' });
}

/** Estado de la cuenta. Sin backend configurado, siempre es "sin-backend" (modo local). */
export const useAuthStore = create<AuthCache>()((set) => ({
  status: isCloudEnabled() ? 'cargando' : 'sin-backend',
  user: null,
  lastSyncAt: null,
  markSynced: (at) => {
    set({ lastSyncAt: at });
  },
  refrescar: async () => {
    if (!isCloudEnabled()) return;
    try {
      await leerSesion(set);
    } catch {
      set({ status: 'anonimo', user: null });
    }
  },
  init: () => {
    if (!isCloudEnabled() || iniciado) return;
    iniciado = true;
    leerSesion(set).catch(() => {
      // Si el servidor no responde, la app sigue en modo local y se vuelve a intentar al siguiente montaje.
      iniciado = false;
      set({ status: 'anonimo' });
    });
  },
}));
