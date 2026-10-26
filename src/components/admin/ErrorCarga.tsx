import { Button } from '../ui/Button';

/** Error con su mensaje en español y un botón para volver a intentarlo. Nunca muestra detalles técnicos. */
export function ErrorCarga({
  mensaje,
  alReintentar,
}: {
  mensaje: string;
  alReintentar?: () => void;
}) {
  return (
    <section
      role="alert"
      className="glass ring-gradient flex flex-col gap-4 rounded-card p-5 sm:p-6"
    >
      <p className="text-base text-ink">{mensaje}</p>
      {alReintentar ? (
        <Button variant="secondary" onClick={alReintentar} className="w-full sm:w-auto">
          Reintentar
        </Button>
      ) : null}
    </section>
  );
}
