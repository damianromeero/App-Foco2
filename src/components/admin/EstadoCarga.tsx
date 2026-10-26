/** Esqueleto de carga. Se anuncia una sola vez a lectores de pantalla y la animación respeta el movimiento reducido. */
export function EstadoCarga({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{texto}</span>
      <div
        aria-hidden="true"
        className="glass ring-gradient h-28 rounded-card motion-safe:animate-pulse"
      />
      <div
        aria-hidden="true"
        className="glass ring-gradient h-40 rounded-card motion-safe:animate-pulse"
      />
    </div>
  );
}
