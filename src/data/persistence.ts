import type { StateStorage } from 'zustand/middleware';

export const STORAGE_KEY = 'foco5';

function isJson(raw: string): boolean {
  try {
    JSON.parse(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Almacenamiento tolerante a fallos. Si el navegador bloquea localStorage (modo privado,
 * cuota llena, cookies desactivadas) la app sigue funcionando; solo deja de recordar datos.
 */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      const raw = window.localStorage.getItem(name);
      if (raw === null || isJson(raw)) return raw;
      // Un valor que no es JSON se copia antes de que la siguiente escritura lo sustituya.
      window.localStorage.setItem(`${name}.ilegible`, raw);
      return null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Sin espacio o bloqueado: se ignora. La app sigue en memoria.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nada que hacer si el almacenamiento no está disponible.
    }
  },
};

/**
 * Pide al navegador que no borre estos datos cuando le falte espacio. Es solo una petición:
 * puede no concederse, y sin la API la app sigue igual.
 */
export function requestPersistentStorage(): void {
  // Algunos navegadores no tienen esta API: por eso el tipo admite que falte.
  const storage = navigator.storage as Partial<StorageManager> | undefined;
  if (typeof storage?.persist !== 'function') return;
  storage.persist().catch(() => undefined);
}
