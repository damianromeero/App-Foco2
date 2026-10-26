/**
 * Formatos del panel: dólares (US$), números, porcentajes y fechas en español, con la zona horaria del panel.
 * `useGrouping: 'always'` agrupa miles también debajo de 10 000 (el español lo omite por defecto).
 */

import { ADMIN_APP } from './config';

const ZONA = ADMIN_APP.zonaHoraria;

const DOLARES = new Intl.NumberFormat('es', {
  useGrouping: 'always',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const ENTEROS = new Intl.NumberFormat('es', { useGrouping: 'always', maximumFractionDigits: 0 });
const UN_DECIMAL = new Intl.NumberFormat('es', {
  useGrouping: 'always',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const FECHA = new Intl.DateTimeFormat('es', {
  timeZone: ZONA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const FECHA_HORA = new Intl.DateTimeFormat('es', {
  timeZone: ZONA,
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const DIA_CORTO = new Intl.DateTimeFormat('es', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'short',
});

/** Un valor no finito (NaN o infinito) se muestra como cero: el panel nunca escribe «NaN». */
const finito = (valor: number): number => (Number.isFinite(valor) ? valor : 0);

/** Dólares: «US$1.234,50». Los negativos llevan el signo delante. */
export function formatearUsd(valor: number): string {
  const cifra = finito(valor);
  const signo = cifra < 0 ? '-' : '';
  return `${signo}US$${DOLARES.format(Math.abs(cifra))}`;
}

/** Número entero con miles: «12.345». */
export function formatearNumero(valor: number): string {
  const cifra = finito(valor);
  const signo = cifra < 0 ? '-' : '';
  return signo + ENTEROS.format(Math.abs(cifra));
}

/** Porcentaje con un decimal: «12,5 %». */
export function formatearPorcentaje(valor: number): string {
  const cifra = finito(valor);
  const signo = cifra < 0 ? '-' : '';
  return `${signo}${UN_DECIMAL.format(Math.abs(cifra))} %`;
}

function esFecha(iso: string): boolean {
  return !Number.isNaN(Date.parse(iso));
}

/** Fecha: «21 oct 2026». Si el texto no es una fecha, guion. */
export function formatearFecha(iso: string): string {
  return esFecha(iso) ? FECHA.format(new Date(iso)) : '—';
}

/** Fecha y hora: «21 oct, 22:00». */
export function formatearFechaHora(iso: string): string {
  return esFecha(iso) ? FECHA_HORA.format(new Date(iso)) : '—';
}

/** Día corto para ejes de gráficas, a partir de AAAA-MM-DD: «22 oct». */
export function formatearDiaCorto(dia: string): string {
  const [anio, mes, diaDelMes] = dia.split('-').map(Number);
  if (!anio || !mes || !diaDelMes) return '—';
  return DIA_CORTO.format(new Date(Date.UTC(anio, mes - 1, diaDelMes)));
}
