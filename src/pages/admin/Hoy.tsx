import { Link } from 'react-router';
import { ETIQUETA_AVISO } from '../../admin/config';
import { leerResumen } from '../../admin/consultas';
import {
  formatearFecha,
  formatearFechaHora,
  formatearNumero,
  formatearUsd,
} from '../../admin/formato';
import {
  avisosARevisar,
  comprasAprobadas,
  ingresosAprobados,
  ultimoDiaActivo,
  type AvisoRevision,
} from '../../admin/metricas';
import type { Periodo } from '../../admin/periodo';
import { useConsulta } from '../../admin/useConsulta';
import { ErrorCarga } from '../../components/admin/ErrorCarga';
import { EstadoCarga } from '../../components/admin/EstadoCarga';
import { TarjetaKpi } from '../../components/admin/TarjetaKpi';
import { Card } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import type { ResumenPanel } from '../../admin/consultas';

/** Hoy siempre mira los últimos 7 días: lo que requiere atención ahora. */
const PERIODO_HOY: Periodo = '7d';

/** Hoy: avisos que requieren atención, ingresos del periodo y el último día con actividad. Cada cifra enlaza a su sección. */
export default function Hoy() {
  useDocumentMeta({ title: 'Hoy' });
  const { estado, reintentar } = useConsulta(leerResumen, PERIODO_HOY);

  if (estado.tipo === 'cargando') return <EstadoCarga texto="Cargando el resumen…" />;
  if (estado.tipo === 'error') {
    return <ErrorCarga mensaje={estado.mensaje} alReintentar={reintentar} />;
  }
  if (estado.tipo === 'sin-nube') return null;
  return <Resumen resumen={estado.datos} />;
}

function Resumen({ resumen }: { resumen: ResumenPanel }) {
  const aRevisar = avisosARevisar(resumen.avisos);
  const ultimoDia = ultimoDiaActivo(resumen.eventos);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Hoy</h1>
        <p className="mt-1 text-base text-ink-soft">
          Últimos 7 días: lo que necesita atención y las cifras principales.
        </p>
      </div>

      <AtencionAvisos avisos={aRevisar} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TarjetaKpi
          etiqueta="Ingresos"
          valor={formatearUsd(ingresosAprobados(resumen.compras))}
          nota="Compras aprobadas"
          enlace={{ href: '/admin/ventas', texto: 'Ver ventas' }}
        />
        <TarjetaKpi
          etiqueta="Compras aprobadas"
          valor={formatearNumero(comprasAprobadas(resumen.compras))}
          nota="Suma de los últimos 7 días"
          enlace={{ href: '/admin/ventas', texto: 'Ver compras' }}
        />
        <TarjetaKpi
          etiqueta="Último día con actividad"
          valor={ultimoDia ? formatearFecha(`${ultimoDia}T12:00:00-05:00`) : 'Sin actividad'}
          nota={ultimoDia ? undefined : 'No hubo eventos de la app en el periodo'}
          enlace={{ href: '/admin/uso', texto: 'Ver uso de la app' }}
        />
      </div>
    </div>
  );
}

function AtencionAvisos({ avisos }: { avisos: readonly AvisoRevision[] }) {
  return (
    <Card as="section" labelledBy="titulo-atencion" className="flex flex-col gap-3">
      <h2 id="titulo-atencion" className="text-lg font-semibold text-ink">
        Requiere atención
      </h2>
      {avisos.length === 0 ? (
        <p className="text-base text-ink-soft">
          Ningún aviso de Hotmart necesita revisión en los últimos 7 días.
        </p>
      ) : (
        <>
          <p className="text-base text-ink">
            {avisos.length === 1 ? 'Hay 1 aviso' : `Hay ${formatearNumero(avisos.length)} avisos`}{' '}
            de Hotmart que necesitan revisión.
          </p>
          <ul className="flex flex-col divide-y divide-line">
            {avisos.map((aviso, indice) => (
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
        </>
      )}
      <Link
        to="/admin/ventas"
        className="inline-flex min-h-11 items-center text-base font-medium text-accent-text underline underline-offset-4"
      >
        Revisar en Ventas
      </Link>
    </Card>
  );
}
