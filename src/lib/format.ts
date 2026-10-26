const LONG_DATE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const FULL_DATE = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** "jueves, 16 de octubre". */
export function formatLongDate(date: Date): string {
  const text = LONG_DATE.format(date);
  // Solo la primera letra en mayúscula: en español, el resto de la fecha va en minúscula.
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "16 de octubre de 2026". */
export function formatFullDate(date: Date): string {
  return FULL_DATE.format(date);
}

/** Hora local en formato HH:MM. */
export function formatTime(date: Date): string {
  return date.toTimeString().slice(0, 5);
}

/** Proporción (0–1) como porcentaje entero: "82 %". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
