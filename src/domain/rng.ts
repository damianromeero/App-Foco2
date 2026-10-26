export interface Rng {
  /** Número en [0, 1). */
  next(): number;
  /** Entero en [min, max], ambos incluidos. */
  int(min: number, max: number): number;
  /** Elemento al azar de una lista no vacía. */
  pick<T>(items: readonly T[]): T;
  /** Copia barajada (Fisher–Yates). No modifica la lista original. */
  shuffle<T>(items: readonly T[]): T[];
  /** true con probabilidad p (de 0 a 1). */
  chance(p: number): boolean;
}

/** Convierte un texto en una semilla numérica estable (FNV-1a de 32 bits). */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function valueAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Índice fuera de rango: ${index}`);
  }
  return item;
}

/**
 * Generador determinista (mulberry32). Con la misma semilla produce siempre la misma secuencia.
 * Así el test base es comparable entre sesiones y cada día tiene su propio plan reproducible.
 */
export function createRng(seed: string | number): Rng {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) {
      throw new RangeError('int: el máximo no puede ser menor que el mínimo');
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) {
        throw new RangeError('pick: la lista está vacía');
      }
      return valueAt(items, int(0, items.length - 1));
    },
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = int(0, i);
        const current = valueAt(copy, i);
        copy[i] = valueAt(copy, j);
        copy[j] = current;
      }
      return copy;
    },
    chance: (p: number): boolean => next() < p,
  };
}
