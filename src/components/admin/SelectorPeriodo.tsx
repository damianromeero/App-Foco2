import { PERIODOS, type Periodo } from '../../admin/periodo';

/** Botones de periodo. El periodo activo lleva aria-pressed; cambiarlo no toca la URL ni el almacenamiento. */
export function SelectorPeriodo({
  valor,
  alCambiar,
}: {
  valor: Periodo;
  alCambiar: (periodo: Periodo) => void;
}) {
  return (
    <div role="group" aria-label="Periodo" className="flex flex-wrap gap-2">
      {PERIODOS.map((periodo) => {
        const activo = periodo.valor === valor;
        return (
          <button
            key={periodo.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => {
              alCambiar(periodo.valor);
            }}
            className={`min-h-11 rounded-2xl px-4 text-base font-medium transition-colors ${
              activo
                ? 'fill-brand text-brand-ink'
                : 'glass ring-gradient text-ink hover:brightness-125'
            }`}
          >
            {periodo.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
