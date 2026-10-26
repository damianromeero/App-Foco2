import { PALETA } from '../../admin/config';
import { formatearDiaCorto } from '../../admin/formato';

export interface PuntoDiario {
  /** Día AAAA-MM-DD, hora de Colombia. */
  dia: string;
  valor: number;
}

/** Barras verticales hechas con CSS (sin librerías). Cada barra tiene su texto para lectores de pantalla. */
export function BarrasDiarias({
  titulo,
  puntos,
  formatear,
}: {
  titulo: string;
  puntos: readonly PuntoDiario[];
  formatear: (valor: number) => string;
}) {
  const maximo = Math.max(0, ...puntos.map((punto) => punto.valor));
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  return (
    <figure className="flex flex-col gap-3">
      <ol aria-label={titulo} className="flex h-40 items-end gap-0.5">
        {puntos.map((punto) => {
          const alto = maximo > 0 ? Math.round((punto.valor / maximo) * 100) : 0;
          return (
            <li key={punto.dia} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <span
                aria-hidden="true"
                className="block w-full rounded-t-sm"
                style={{
                  height: `${String(alto)}%`,
                  background: PALETA.marca,
                  minHeight: punto.valor > 0 ? '2px' : undefined,
                }}
              />
              <span className="sr-only">
                {formatearDiaCorto(punto.dia)}: {formatear(punto.valor)}
              </span>
            </li>
          );
        })}
      </ol>
      {primero && ultimo ? (
        <div className="flex justify-between text-base text-ink-soft">
          <span>{formatearDiaCorto(primero.dia)}</span>
          <span>{formatearDiaCorto(ultimo.dia)}</span>
        </div>
      ) : null}
    </figure>
  );
}
