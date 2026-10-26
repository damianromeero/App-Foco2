/** Fecha local en formato AAAA-MM-DD. Es la clave de cada día dentro de la app. */
export type DateKey = string;

const DAY_MS = 86_400_000;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function parts(key: DateKey): [number, number, number] {
  const [year, month, day] = key.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new RangeError(`Fecha no válida: ${key}`);
  }
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new RangeError(`Fecha no válida: ${key}`);
  }
  return [year, month, day];
}

/** Clave de día (hora local) para una fecha concreta. */
export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fecha local a medianoche correspondiente a la clave. */
export function parseDateKey(key: DateKey): Date {
  const [year, month, day] = parts(key);
  return new Date(year, month - 1, day);
}

/** Suma días a una clave. Funciona con cambios de mes, de año y de hora de verano. */
export function addDays(key: DateKey, days: number): DateKey {
  const [year, month, day] = parts(key);
  return toDateKey(new Date(year, month - 1, day + days));
}

/** Días completos entre dos claves (later − earlier). Ignora el cambio de hora. */
export function diffDays(later: DateKey, earlier: DateKey): number {
  const [y1, m1, d1] = parts(later);
  const [y2, m2, d2] = parts(earlier);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / DAY_MS);
}

/** Clave del lunes de la semana a la que pertenece el día. */
export function weekStartKey(key: DateKey): DateKey {
  const weekday = parseDateKey(key).getDay(); // 0 = domingo
  return addDays(key, -((weekday + 6) % 7));
}

/** Abreviatura del día de la semana en español, p. ej. "lun". */
export function weekdayShort(key: DateKey): string {
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
    .format(parseDateKey(key))
    .replace('.', '');
}
