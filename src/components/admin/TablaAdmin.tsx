import type { ReactNode } from 'react';

/** Cada fila y cada celda, para el diseño de tabla de escritorio. */
export const CLASE_FILA = 'block border-b border-line py-3 last:border-b-0 md:table-row md:py-0';
export const CLASE_CELDA =
  'flex items-baseline justify-between gap-4 py-1 text-base text-ink break-words md:table-cell md:py-3 md:align-top before:content-[attr(data-etiqueta)] before:text-ink-soft md:before:content-none';

/**
 * Tabla con caption y encabezados con scope. En móvil cada fila se apila: cada celda muestra su encabezado (data-etiqueta)
 * y no hay desplazamiento horizontal.
 */
export function TablaAdmin({
  titulo,
  encabezados,
  children,
}: {
  titulo: string;
  encabezados: readonly string[];
  children: ReactNode;
}) {
  return (
    <table className="block w-full md:table">
      <caption className="mb-3 text-left text-base font-medium text-ink">{titulo}</caption>
      <thead className="sr-only md:not-sr-only md:table-header-group">
        <tr className="md:table-row">
          {encabezados.map((encabezado) => (
            <th
              key={encabezado}
              scope="col"
              className="pb-2 text-left text-base font-normal text-ink-soft md:table-cell"
            >
              {encabezado}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="block md:table-row-group">{children}</tbody>
    </table>
  );
}
