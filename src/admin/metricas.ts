/**
 * Indicadores del panel a partir de filas ya leídas. PURAS: no leen la base ni el reloj; la hora llega como parámetro.
 * Las filas llegan ya acotadas al periodo y ya enmascaradas (ver consultas.ts).
 *
 * Definiciones:
 * - Ingresos: suma de `montoUsd` solo de las compras aprobadas.
 * - Compras por plan: compras aprobadas de cada plan.
 * - Embudo: un dispositivo cuenta en una etapa de evento solo si tiene ese evento Y contó en la etapa anterior. Cada
 *   etapa es así un subconjunto de la anterior: nunca crece. La etapa de compra cuenta compras aprobadas (vienen de
 *   Hotmart, no de un dispositivo), así que puede superar a los clics de la app. Porcentajes: 0 si no hay base.
 * - Retención simple: de los dispositivos cuya primera actividad cae en el periodo, cuántos tuvieron actividad el día
 *   calendario N después. Solo cuentan días ya terminados. Con datos de un periodo, quien ya usaba la app antes del
 *   periodo parece nuevo: es una cifra orientativa.
 * - Gráfica diaria: dispositivos distintos por día; como máximo los últimos 90 días.
 */
import {
  ESTADOS_AVISO_REVISION,
  type EstadoAvisoRevision,
  ETAPAS_EMBUDO,
  type EtapaEmbudo,
} from './config';
import { ADMIN_APP } from './config';
import { diaDelPanel, diasEntre, inicioDelDia, MILISEGUNDOS_DIA } from './periodo';
import { medianocheDesplazada } from './zona';

export type PlanCompra = 'mensual' | 'anual';
export type EstadoCompra = 'aprobada' | 'reembolsada' | 'cancelada';

/** Compra del periodo, enmascarada: nunca lleva el correo ni el identificador completos. */
export interface CompraFila {
  /** Últimos 6 caracteres del identificador de Hotmart. */
  referencia: string;
  correoEnmascarado: string;
  plan: PlanCompra;
  montoUsd: number;
  estado: EstadoCompra;
  creadoEn: string;
}

/** Evento de la app del periodo. Sin nombres ni valores: solo tipo, dispositivo anónimo y momento. */
export interface EventoFila {
  tipo: string;
  dispositivo: string;
  creadoEn: string;
}

/** Aviso de Hotmart del periodo, con su identificador acortado. */
export interface AvisoFila {
  referencia: string;
  estado: string;
  recibidoEn: string;
}

export interface PasoEmbudo {
  id: string;
  etiqueta: string;
  valor: number;
  porcentajeDelAnterior: number;
  porcentajeDelInicio: number;
}

export interface FilaRetencion {
  dias: number;
  base: number;
  volvieron: number;
  porcentaje: number;
}

const redondearCentavos = (valor: number): number => Math.round(valor * 100) / 100;
const sumar = (valores: number[]): number =>
  redondearCentavos(valores.reduce((total, valor) => total + valor, 0));

/** Porcentaje con un decimal. Sin base (cero o no numérica), cero: nunca NaN ni división entre cero. */
export function porcentaje(parte: number, total: number): number {
  if (!(total > 0) || !Number.isFinite(parte)) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

const aprobadas = (compras: readonly CompraFila[]): CompraFila[] =>
  compras.filter((compra) => compra.estado === 'aprobada');

/** Suma de los montos (US$) de las compras aprobadas. */
export function ingresosAprobados(compras: readonly CompraFila[]): number {
  return sumar(aprobadas(compras).map((compra) => compra.montoUsd));
}

/** Número de compras aprobadas. */
export function comprasAprobadas(compras: readonly CompraFila[]): number {
  return aprobadas(compras).length;
}

/** Compras aprobadas de cada plan. Los dos planes siempre están presentes, aunque valgan cero. */
export function comprasAprobadasPorPlan(
  compras: readonly CompraFila[],
): Record<PlanCompra, number> {
  const conteo: Record<PlanCompra, number> = { mensual: 0, anual: 0 };
  for (const compra of aprobadas(compras)) {
    conteo[compra.plan] += 1;
  }
  return conteo;
}

/** Embudo encadenado (ver la definición arriba). La etapa de origen «compras» debe ser la última. */
export function embudoCompra(
  eventos: readonly EventoFila[],
  compras: readonly CompraFila[],
  etapas: readonly EtapaEmbudo[] = ETAPAS_EMBUDO,
): PasoEmbudo[] {
  const conteos: { id: string; etiqueta: string; valor: number }[] = [];
  let anteriores: Set<string> | null = null;

  for (const etapa of etapas) {
    if (etapa.origen === 'compras') {
      conteos.push({ id: etapa.id, etiqueta: etapa.etiqueta, valor: comprasAprobadas(compras) });
      continue;
    }
    const actuales = new Set<string>();
    for (const evento of eventos) {
      if (evento.tipo !== etapa.id) continue;
      if (anteriores === null || anteriores.has(evento.dispositivo))
        actuales.add(evento.dispositivo);
    }
    conteos.push({ id: etapa.id, etiqueta: etapa.etiqueta, valor: actuales.size });
    anteriores = actuales;
  }

  const inicio = conteos[0]?.valor ?? 0;
  return conteos.map((paso, indice) => {
    const anterior = indice === 0 ? paso.valor : (conteos[indice - 1]?.valor ?? 0);
    return {
      ...paso,
      porcentajeDelAnterior: porcentaje(paso.valor, anterior),
      porcentajeDelInicio: porcentaje(paso.valor, inicio),
    };
  });
}

/** Dispositivos distintos con al menos un evento del periodo. */
export function dispositivosUnicos(eventos: readonly EventoFila[]): number {
  return new Set(eventos.map((evento) => evento.dispositivo)).size;
}

/** Eventos del periodo por tipo, de más a menos frecuentes (desempate alfabético). */
export function conteoPorTipo(eventos: readonly EventoFila[]): { tipo: string; veces: number }[] {
  const conteo = new Map<string, number>();
  for (const evento of eventos) {
    conteo.set(evento.tipo, (conteo.get(evento.tipo) ?? 0) + 1);
  }
  return [...conteo]
    .map(([tipo, veces]) => ({ tipo, veces }))
    .sort((a, b) => b.veces - a.veces || a.tipo.localeCompare(b.tipo));
}

/** Día (AAAA-MM-DD, zona horaria del panel) de la última actividad del periodo, o null si no hubo. */
export function ultimoDiaActivo(eventos: readonly EventoFila[]): string | null {
  let ultimo: number | null = null;
  for (const evento of eventos) {
    const ms = Date.parse(evento.creadoEn);
    if (ultimo === null || ms > ultimo) ultimo = ms;
  }
  return ultimo === null ? null : diaDelPanel(ultimo);
}

/**
 * Recuento de eventos por día dentro del rango. Los días sin eventos cuentan cero. Como mucho, los últimos `maxDias`
 * días (con «todo» la gráfica no crece sin límite).
 */
export function eventosPorDia(
  eventos: readonly EventoFila[],
  rango: { desde: string; hasta: string },
  maxDias = 90,
): { dia: string; eventos: number }[] {
  const fin = Date.parse(rango.hasta);
  const inicio = Math.max(Date.parse(rango.desde), fin - maxDias * MILISEGUNDOS_DIA);
  const porDia = new Map<string, number>();
  for (const dia of diasEntre(inicio, fin)) {
    porDia.set(dia, 0);
  }
  for (const evento of eventos) {
    const ms = Date.parse(evento.creadoEn);
    if (ms < inicio || ms >= fin) continue;
    const dia = diaDelPanel(ms);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  return [...porDia].map(([dia, total]) => ({ dia, eventos: total }));
}

/** Retención simple a N días (ver la definición arriba). Solo cuentan los días ya terminados. */
export function retencionSimple(
  eventos: readonly EventoFila[],
  dias: readonly number[],
  ahora: number,
): FilaRetencion[] {
  const primera = new Map<string, number>();
  const diasActivos = new Map<string, Set<string>>();
  for (const evento of eventos) {
    const ms = Date.parse(evento.creadoEn);
    const previa = primera.get(evento.dispositivo);
    if (previa === undefined || ms < previa) primera.set(evento.dispositivo, ms);
    const conjunto = diasActivos.get(evento.dispositivo) ?? new Set<string>();
    conjunto.add(diaDelPanel(ms));
    diasActivos.set(evento.dispositivo, conjunto);
  }

  const hoy = inicioDelDia(ahora);
  return dias.map((numeroDias) => {
    let base = 0;
    let volvieron = 0;
    for (const [dispositivo, inicio] of primera) {
      // Medianoche local de `numeroDias` días después: sumar 24 h no cae siempre en la medianoche con horario de verano.
      const objetivo = medianocheDesplazada(inicio, numeroDias, ADMIN_APP.zonaHoraria);
      if (objetivo >= hoy) continue;
      base += 1;
      if (diasActivos.get(dispositivo)?.has(diaDelPanel(objetivo))) volvieron += 1;
    }
    return { dias: numeroDias, base, volvieron, porcentaje: porcentaje(volvieron, base) };
  });
}

export function esEstadoRevision(estado: string): estado is EstadoAvisoRevision {
  return ESTADOS_AVISO_REVISION.some((revision) => revision === estado);
}

/** Aviso cuyo estado ya es uno de los que necesitan revisión. */
export type AvisoRevision = AvisoFila & { estado: EstadoAvisoRevision };

/** Avisos que necesitan una revisión manual (ver ESTADOS_AVISO_REVISION). */
export function avisosARevisar(avisos: readonly AvisoFila[]): AvisoRevision[] {
  return avisos.filter((aviso): aviso is AvisoRevision => esEstadoRevision(aviso.estado));
}
