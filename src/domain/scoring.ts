import { roundTo } from './math';

/** Resultado de un ensayo ya evaluado. */
export interface TrialOutcome {
  correct: boolean;
  /** Tiempo de reacción en ms; null si no hubo respuesta. */
  rtMs: number | null;
  /** Los ensayos de calentamiento (p. ej. los primeros del n-back) no puntúan. */
  scorable: boolean;
}

export interface Summary {
  /** Ensayos que cuentan para la puntuación. */
  scorable: number;
  /** Aciertos entre los ensayos que cuentan. */
  correct: number;
  /** Precisión entre 0 y 1, con cuatro decimales. */
  accuracy: number;
  /** Mediana del tiempo de reacción de los aciertos, en ms. */
  medianRtMs: number | null;
}

/** Mediana de una lista de números (media de los dos centrales si la lista es par). */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) return null;
  if (sorted.length % 2 === 1) return upper;
  const lower = sorted[middle - 1];
  if (lower === undefined) return null;
  return Math.round((lower + upper) / 2);
}

/** Resume una partida: precisión y mediana de reacción de los aciertos. */
export function summarize(outcomes: readonly TrialOutcome[]): Summary {
  const scored = outcomes.filter((outcome) => outcome.scorable);
  const correct = scored.filter((outcome) => outcome.correct).length;
  const reactionTimes: number[] = [];
  for (const outcome of scored) {
    if (outcome.correct && outcome.rtMs !== null) {
      reactionTimes.push(outcome.rtMs);
    }
  }
  return {
    scorable: scored.length,
    correct,
    accuracy: scored.length === 0 ? 0 : roundTo(correct / scored.length, 4),
    medianRtMs: median(reactionTimes),
  };
}
