/** Limita un valor al intervalo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Redondea a un número fijo de decimales sin errores de coma flotante. */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Elemento de una lista que se repite en ciclo: el índice da la vuelta al llegar al final. */
export function cyclic<T>(items: readonly T[], index: number): T {
  const item = items[index % items.length];
  if (item === undefined) {
    throw new RangeError('cyclic: la lista está vacía');
  }
  return item;
}
