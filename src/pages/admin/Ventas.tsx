import { useState } from 'react';
import { CLASE_CELDA, CLASE_FILA, TablaAdmin } from '../../components/admin/TablaAdmin';
import { ETIQUETA_AVISO, ETIQUETA_COMPRA, ETIQUETA_PLAN } from '../../admin/config';
import { leerResumen, type ResumenPanel } from '../../admin/consultas';
import {
  formatearFechaHora,
  formatearNumero,
  formatearPorcentaje,
  formatearUsd,
} from '../../admin/formato';
import {
  avisosARevisar,
  comprasAprobadas,
  comprasAprobadasPorPlan,
  embudoCompra,
  ingresosAprobados,
  type CompraFila,
  type PasoEmbudo,
} from '../../admin/metricas';
import { PERIODO_INICIAL, type Periodo } from '../../admin/periodo';
import { useConsulta } from '../../admin/useConsulta';
import { ErrorCarga } from '../../components/admin/ErrorCarga';
import { EstadoCarga } from '../../components/admin/EstadoCarga';
import { SelectorPeriodo } from '../../components/admin/SelectorPeriodo';
import { TarjetaKpi } from '../../components/admin/TarjetaKpi';
import { Card } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

/** Ventas: ingresos, compras por plan, embudo de compra, compras del periodo y avisos de Hotmart que revisar. */
export default function Ventas() {
  useDocumentMeta({ title: 'Ventas' });
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);
  const { estado, reintentar } = useConsulta(leerResumen, periodo);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Ventas</h1>
          <p className="mt-1 text-base text-ink-soft">
            Cuánto entró, qué planes se compraron y dónde se pierden las personas antes de comprar.
          </p>
        </div>
        <SelectorPeriodo valor={periodo} alCambiar={setPeriodo} />
      </div>

      {estado.tipo === 'cargando' ? <EstadoCarga /> : null}
      {estado.tipo === 'error' ? (
        <ErrorCarga mensaje={estado.mensaje} alReintentar={reintentar} />
      ) : null}
      {estado.tipo === 'listo' ? <Contenido resumen={estado.datos} /> : null}
    </div>
  );
}

function Contenido({ resumen }: { resumen: ResumenPanel }) {
  const porPlan = comprasAprobadasPorPlan(resumen.compras);
  const embudo = embudoCompra(resumen.eventos, resumen.compras);
  const aRevisar = avisosARevisar(resumen.avisos);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TarjetaKpi
          etiqueta="Ingresos"
          valor={formatearUsd(ingresosAprobados(resumen.compras))}
          nota="Suma de las compras aprobadas"
        />
        <TarjetaKpi
          etiqueta="Compras aprobadas"
          valor={formatearNumero(comprasAprobadas(resumen.compras))}
          nota={`Mensual: ${formatearNumero(porPlan.mensual)} · Anual: ${formatearNumero(porPlan.anual)}`}
        />
      </div>

      <Card as="section" labelledBy="titulo-embudo" className="flex flex-col gap-4">
        <h2 id="titulo-embudo" className="text-lg font-semibold text-ink">
          Embudo de compra
        </h2>
        <p className="text-base text-ink-soft">
          Cada etapa, con su cifra y el porcentaje frente a la etapa anterior y frente al inicio.
        </p>
        <EmbudoAdmin pasos={embudo} />
        <p className="text-base text-ink-soft">
          La compra aprobada viene de Hotmart, así que puede superar a los clics registrados en la
          app.
        </p>
      </Card>

      <Card as="section" labelledBy="titulo-compras" className="flex flex-col gap-4">
        <h2 id="titulo-compras" className="text-lg font-semibold text-ink">
          Compras
        </h2>
        {resumen.compras.length === 0 ? (
          <p className="text-base text-ink-soft">
            No hay compras en este periodo. Prueba con otro periodo para ver compras anteriores.
          </p>
        ) : (
          <TablaCompras compras={resumen.compras} />
        )}
      </Card>

      <Card as="section" labelledBy="titulo-avisos" className="flex flex-col gap-4">
        <h2 id="titulo-avisos" className="text-lg font-semibold text-ink">
          Avisos de Hotmart
        </h2>
        <p className="text-base text-ink-soft">
          {formatearNumero(resumen.avisos.length)} avisos recibidos en el periodo.{' '}
          {aRevisar.length === 0
            ? 'Ninguno necesita revisión.'
            : `${formatearNumero(aRevisar.length)} necesitan revisión.`}
        </p>
        {aRevisar.length > 0 ? (
          <ul className="flex flex-col divide-y divide-line">
            {aRevisar.map((aviso, indice) => (
              <li
                key={`${aviso.referencia}-${String(indice)}`}
                className="flex flex-col gap-1 py-3"
              >
                <span className="text-base text-ink">{ETIQUETA_AVISO[aviso.estado]}</span>
                <span className="text-base text-ink-soft">
                  Referencia {aviso.referencia} · {formatearFechaHora(aviso.recibidoEn)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

function TablaCompras({ compras }: { compras: readonly CompraFila[] }) {
  const ordenadas = [...compras].sort((a, b) => Date.parse(b.creadoEn) - Date.parse(a.creadoEn));
  return (
    <TablaAdmin
      titulo="Compras del periodo, de la más reciente a la más antigua"
      encabezados={['Fecha', 'Correo', 'Plan', 'Monto', 'Estado', 'Referencia']}
    >
      {ordenadas.map((compra, indice) => (
        <tr key={`${compra.referencia}-${String(indice)}`} className={CLASE_FILA}>
          <td data-etiqueta="Fecha" className={CLASE_CELDA}>
            {formatearFechaHora(compra.creadoEn)}
          </td>
          <td data-etiqueta="Correo" className={CLASE_CELDA}>
            {compra.correoEnmascarado}
          </td>
          <td data-etiqueta="Plan" className={CLASE_CELDA}>
            {ETIQUETA_PLAN[compra.plan]}
          </td>
          <td data-etiqueta="Monto" className={CLASE_CELDA}>
            {formatearUsd(compra.montoUsd)}
          </td>
          <td data-etiqueta="Estado" className={CLASE_CELDA}>
            {ETIQUETA_COMPRA[compra.estado]}
          </td>
          <td data-etiqueta="Referencia" className={CLASE_CELDA}>
            {compra.referencia}
          </td>
        </tr>
      ))}
    </TablaAdmin>
  );
}

function EmbudoAdmin({ pasos }: { pasos: readonly PasoEmbudo[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {pasos.map((paso, indice) => {
        const ancho = Math.min(100, Math.max(0, paso.porcentajeDelInicio));
        return (
          <li key={paso.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base text-ink">{paso.etiqueta}</span>
              <span className="text-base font-medium text-ink tabular-nums">
                {formatearNumero(paso.valor)}
              </span>
            </div>
            <div aria-hidden="true" className="h-2 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${String(ancho)}%` }}
              />
            </div>
            <p className="text-base text-ink-soft">
              {indice === 0
                ? 'Inicio del embudo'
                : `${formatearPorcentaje(paso.porcentajeDelAnterior)} de la etapa anterior · ${formatearPorcentaje(paso.porcentajeDelInicio)} del inicio`}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
