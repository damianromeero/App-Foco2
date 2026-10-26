/**
 * Cálculo de fechas del panel en una zona horaria (nombre IANA). La zona por defecto es ADMIN_APP.zonaHoraria
 * (src/admin/config.ts, America/Bogota): periodos, gráficas, días de retención y formatos la usan. El desfase se calcula
 * con Intl, así que el horario de verano de una zona que lo tenga queda bien. Sin desfases fijos en el código.
 * Funciones puras: la hora llega como parámetro, así que se prueban sin reloj.
 */

const formatos = new Map<string, Intl.DateTimeFormat>();

function formatoDe(zona: string): Intl.DateTimeFormat {
  let formato = formatos.get(zona);
  if (formato === undefined) {
    formato = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatos.set(zona, formato);
  }
  return formato;
}

/** Desfase de la zona respecto a UTC en ese instante, en ms: hora local = UTC + desfase (America/Bogota: -5 h). */
export function desfaseZona(ms: number, zona: string): number {
  if (!Number.isFinite(ms)) return Number.NaN;
  const instante = Math.floor(ms / 1000) * 1000;
  const partes = formatoDe(zona).formatToParts(new Date(instante));
  const valor = (tipo: Intl.DateTimeFormatPartTypes): number =>
    Number(partes.find((parte) => parte.type === tipo)?.value);
  const comoUtc = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second'),
  );
  return comoUtc - instante;
}

/** Fecha local de un instante: año, mes (0 = enero) y día del mes. */
export function fechaLocal(ms: number, zona: string): { anio: number; mes: number; dia: number } {
  const local = new Date(Math.floor(ms / 1000) * 1000 + desfaseZona(ms, zona));
  return { anio: local.getUTCFullYear(), mes: local.getUTCMonth(), dia: local.getUTCDate() };
}

/** Fecha AAAA-MM-DD del día local en el que cae un instante. */
export function fechaIsoLocal(ms: number, zona: string): string {
  const { anio, mes, dia } = fechaLocal(ms, zona);
  return new Date(Date.UTC(anio, mes, dia)).toISOString().slice(0, 10);
}

/**
 * Instante (ms UTC) de la medianoche local de una fecha. Acepta días fuera del mes como Date.UTC (dia 0, dia 32…).
 * Dos pasadas: si el desfase cambia justo a esa hora (horario de verano), la segunda lo corrige.
 */
export function medianocheLocal(anio: number, mes: number, dia: number, zona: string): number {
  const comoUtc = Date.UTC(anio, mes, dia);
  const primera = comoUtc - desfaseZona(comoUtc, zona);
  return comoUtc - desfaseZona(primera, zona);
}

/** Medianoche local del día que cae `dias` días después (o antes, con negativo) del día local del instante. */
export function medianocheDesplazada(ms: number, dias: number, zona: string): number {
  const { anio, mes, dia } = fechaLocal(ms, zona);
  return medianocheLocal(anio, mes, dia + dias, zona);
}
