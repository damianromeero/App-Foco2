import type { ReactNode } from 'react';
import { Button } from '../ui/Button';

/** Marco de las pantallas de acceso: una columna centrada, del mismo ancho que la entrada, sobre el fondo de la app. */
export function MarcoAcceso({ children }: { children: ReactNode }) {
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10 sm:px-6">
      {children}
    </main>
  );
}

/** Texto mientras se comprueba el acceso. Se anuncia como estado para lectores de pantalla. */
export function Comprobando() {
  return (
    <p role="status" className="text-base leading-relaxed text-ink-soft">
      Comprobando tu acceso…
    </p>
  );
}

/** Fallo al comprobar el acceso. Nunca deja pasar: explica el problema y ofrece reintentar. */
export function ErrorComprobacion({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-[2rem] leading-[1.1]">No pudimos comprobar tu acceso</h1>
      <p role="alert" className="text-base leading-relaxed text-ink-soft">
        Revisa tu conexión e inténtalo de nuevo.
      </p>
      <Button className="w-full" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  );
}
