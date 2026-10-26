import { useState } from 'react';
import { BarrasDiarias } from '../../components/admin/BarrasDiarias';
import { CLASE_CELDA, CLASE_FILA, TablaAdmin } from '../../components/admin/TablaAdmin';
import { etiquetaEvento } from '../../admin/config';
import { leerUso, type UsoPeriodo } from '../../admin/consultas';
import { formatearNumero, formatearPorcentaje } from '../../admin/formato';
import {
  conteoPorTipo,
  dispositivosUnicos,
  eventosPorDia,
  retencionSimple,
} from '../../admin/metricas';
import { PERIODO_INICIAL, type Periodo } from '../../admin/periodo';
import { useConsulta } from '../../admin/useConsulta';
import { ErrorCarga } from '../../components/admin/ErrorCarga';
import { EstadoCarga } from '../../components/admin/EstadoCarga';
import { SelectorPeriodo } from '../../components/admin/SelectorPeriodo';
import { TarjetaKpi } from '../../components/admin/TarjetaKpi';
import { Card } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

const DIAS_RETENCION = [1, 7] as const;

/** Uso de la app: cifras anónimas, sin nombres, textos de cuentos ni identificadores de dispositivo. */
export default function Uso() {
  useDocumentMeta({ title: 'Uso de la app' });
  const [periodo, setPeriodo] = useState<Periodo>(PERIODO_INICIAL);
  const { estado, reintentar } = useConsulta(leerUso, periodo);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Uso de la app</h1>
          <p className="mt-1 text-base text-ink-soft">
            Cuántas personas abren la app y qué hacen en ella. Cifras anónimas.
          </p>
        </div>
        <SelectorPeriodo valor={periodo} alCambiar={setPeriodo} />
      </div>

      {estado.tipo === 'cargando' ? <EstadoCarga /> : null}
      {estado.tipo === 'error' ? (
        <ErrorCarga mensaje={estado.mensaje} alReintentar={reintentar} />
      ) : null}
      {estado.tipo === 'listo' ? <Contenido uso={estado.datos} periodo={periodo} /> : null}
    </div>
  );
}

function Contenido({ uso, periodo }: { uso: UsoPeriodo; periodo: Periodo }) {
  const { eventos, rango, ahora } = uso;
  const sinActividad = eventos.length === 0;
  const personas = dispositivosUnicos(eventos);
  const serie = eventosPorDia(eventos, rango).map((punto) => ({
    dia: punto.dia,
    valor: punto.eventos,
  }));
  const retencion = retencionSimple(eventos, DIAS_RETENCION, ahora);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TarjetaKpi
          etiqueta="Personas activas"
          valor={formatearNumero(personas)}
          nota="Dispositivos distintos con actividad"
        />
        <TarjetaKpi etiqueta="Eventos registrados" valor={formatearNumero(eventos.length)} />
      </div>

      {sinActividad ? (
        <Card as="section" labelledBy="titulo-sin-actividad">
          <h2 id="titulo-sin-actividad" className="text-lg font-semibold text-ink">
            Sin actividad en este periodo
          </h2>
          <p className="mt-2 text-base text-ink-soft">
            Prueba con otro periodo para ver actividad anterior.
          </p>
        </Card>
      ) : (
        <>
          <Card as="section" labelledBy="titulo-serie" className="flex flex-col gap-4">
            <h2 id="titulo-serie" className="text-lg font-semibold text-ink">
              Eventos por día
            </h2>
            {periodo === 'todo' ? (
              <p className="text-base text-ink-soft">Se muestran como mucho los últimos 90 días.</p>
            ) : null}
            <BarrasDiarias titulo="Eventos por día" puntos={serie} formatear={formatearNumero} />
          </Card>

          <Card as="section" labelledBy="titulo-tipos" className="flex flex-col gap-4">
            <h2 id="titulo-tipos" className="text-lg font-semibold text-ink">
              Eventos por tipo
            </h2>
            <TablaAdmin titulo="Eventos por tipo" encabezados={['Evento', 'Veces']}>
              {conteoPorTipo(eventos).map((fila) => (
                <tr key={fila.tipo} className={CLASE_FILA}>
                  <td data-etiqueta="Evento" className={CLASE_CELDA}>
                    {etiquetaEvento(fila.tipo)}
                  </td>
                  <td data-etiqueta="Veces" className={CLASE_CELDA}>
                    {formatearNumero(fila.veces)}
                  </td>
                </tr>
              ))}
            </TablaAdmin>
          </Card>

          <Card as="section" labelledBy="titulo-retencion" className="flex flex-col gap-4">
            <h2 id="titulo-retencion" className="text-lg font-semibold text-ink">
              Vuelven a la app
            </h2>
            <p className="text-base text-ink-soft">
              De las personas que empezaron a usar la app en este periodo, cuántas tuvieron
              actividad después.
            </p>
            <TablaAdmin
              titulo="Retención a 1 y 7 días"
              encabezados={['Vuelta', 'Porcentaje', 'Personas en la base']}
            >
              {retencion.map((fila) => (
                <tr key={fila.dias} className={CLASE_FILA}>
                  <td data-etiqueta="Vuelta" className={CLASE_CELDA}>
                    {fila.dias === 1 ? 'Al día siguiente' : `A los ${String(fila.dias)} días`}
                  </td>
                  <td data-etiqueta="Porcentaje" className={CLASE_CELDA}>
                    {fila.base === 0
                      ? 'Sin datos suficientes'
                      : formatearPorcentaje(fila.porcentaje)}
                  </td>
                  <td data-etiqueta="Personas en la base" className={CLASE_CELDA}>
                    {formatearNumero(fila.base)}
                  </td>
                </tr>
              ))}
            </TablaAdmin>
          </Card>
        </>
      )}
    </div>
  );
}
