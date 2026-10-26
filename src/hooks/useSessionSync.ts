import { useEffect } from 'react';
import { syncSessions } from '../services/sync';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';

/**
 * Mantiene las sesiones al día entre dispositivos mientras hay cuenta.
 * Se ejecuta al conectar y cada vez que se completa una sesión nueva. Sin conexión, se reintenta más tarde.
 */
export function useSessionSync(): void {
  const status = useAuthStore((state) => state.status);
  const markSynced = useAuthStore((state) => state.markSynced);
  const sessionCount = useAppStore((state) => state.sessions.length);
  const mergeSessions = useAppStore((state) => state.mergeSessions);

  useEffect(() => {
    if (status !== 'conectado') return;
    let cancelled = false;
    syncSessions(useAppStore.getState().sessions)
      .then((merged) => {
        if (cancelled) return;
        mergeSessions(merged);
        markSynced(new Date().toISOString());
      })
      .catch((error: unknown) => {
        console.warn('Sincronización pendiente: se reintentará', error);
      });
    return () => {
      cancelled = true;
    };
  }, [status, sessionCount, mergeSessions, markSynced]);
}
