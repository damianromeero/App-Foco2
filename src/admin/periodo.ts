/**
 * Periodos del panel. Los días se cuentan en la zona horaria del panel (ADMIN_APP.zonaHoraria, por defecto America/Bogota).
 * El cálculo está en src/admin/zona.ts. Funciones puras: la hora llega como parámetro, así que se prueban sin reloj.
 */
import { ADMIN_APP } from './config';
import { fechaIsoLocal, medianocheDesplazada, medianocheLocal, fechaLocal } from './zona';

export const PERIODOS = [
  { valor: '7d', etiqueta: '7 días', dias: 7 },
  { valor: '30d', etiqueta: '30 días', dias: 30 },
  { valor: '90d', etiqueta: '90 días', dias: 90 },
  { valor: 'todo', etiqueta: 'Todo', dias: null },
] as const;

export type Periodo = (typeof PERIODOS)[number]['valor'];

export const PERIODO_INICIAL: Periodo = '30d';

const DIA_MS = 86_400_000;
/** Inicio de «todo»: anterior a cualquier registro de la base. */
const INICIO_TODO = '1970-01-01T00:00:00.000Z';

export function esPeriodo(valor: unknown): valor is Periodo {
  return PERIODOS.some((periodo) => periodo.valor === valor);
}

export function etiquetaPeriodo(valor: Periodo): string {
  return PERIODOS.find((periodo) => periodo.valor === valor)?.etiqueta ?? '';
}

/** Medianoche (00:00 en la zona del panel) del día al que pertenece el instante. */
export function inicioDelDia(ms: number, zona: string = ADMIN_APP.zonaHoraria): number {
  return medianocheDesplazada(ms, 0, zona);
}

/** Día del calendario de la zona del panel de un instante, en formato AAAA-MM-DD. */
export function diaDelPanel(ms: number, zona: string = ADMIN_APP.zonaHoraria): string {
  return fechaIsoLocal(ms, zona);
}

export interface RangoPeriodo {
  /** Inicio incluido, en ISO. */
  desde: string;
  /** Fin excluido (medianoche de mañana), en ISO. */
  hasta: string;
}

/**
 * Rango de un periodo. «7d» son los 7 días del calendario de la zona del panel que terminan hoy (hoy incluido).
 * «todo» empieza en el origen de la base.
 */
export function rangoPeriodo(
  periodo: Periodo,
  ahora: number,
  zona: string = ADMIN_APP.zonaHoraria,
): RangoPeriodo {
  const hasta = medianocheDesplazada(ahora, 1, zona);
  const dias = PERIODOS.find((item) => item.valor === periodo)?.dias ?? null;
  const desde =
    dias === null ? Date.parse(INICIO_TODO) : medianocheDesplazada(ahora, 1 - dias, zona);
  return { desde: new Date(desde).toISOString(), hasta: new Date(hasta).toISOString() };
}

/** Días (AAAA-MM-DD, en la zona del panel) desde el día de `desde` hasta `hasta` excluido. */
export function diasEntre(
  desde: number,
  hasta: number,
  zona: string = ADMIN_APP.zonaHoraria,
): string[] {
  const dias: string[] = [];
  const { anio, mes, dia } = fechaLocal(desde, zona);
  for (let n = 0; ; n++) {
    const inicio = medianocheLocal(anio, mes, dia + n, zona);
    // Con fechas no válidas la comparación es falsa y el bucle termina: nunca gira sin fin.
    if (!(inicio < hasta)) break;
    dias.push(new Date(Date.UTC(anio, mes, dia + n)).toISOString().slice(0, 10));
  }
  return dias;
}

export const MILISEGUNDOS_DIA = DIA_MS;
