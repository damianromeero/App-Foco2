import { clamp } from './math';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;
export const START_LEVEL = 3;

/** Por encima de este acierto la partida sube de nivel. */
export const UP_THRESHOLD = 0.85;
/** Por debajo de este acierto la partida baja de nivel. */
export const DOWN_THRESHOLD = 0.6;

export function clampLevel(level: number): number {
  return clamp(Math.round(level), MIN_LEVEL, MAX_LEVEL);
}

/**
 * Dificultad adaptativa. Sube o baja un nivel según la precisión de la última partida.
 * Mantener la precisión entre 60 % y 85 % es la zona donde más se entrena la atención.
 */
export function nextLevel(level: number, accuracy: number): number {
  if (accuracy >= UP_THRESHOLD) return clampLevel(level + 1);
  if (accuracy <= DOWN_THRESHOLD) return clampLevel(level - 1);
  return clampLevel(level);
}

/** Nivel inicial que se deriva del test base (que se hace siempre al mismo nivel, 3). */
export function startLevelFromBaseline(accuracy: number): number {
  if (accuracy >= 0.9) return 5;
  if (accuracy >= 0.8) return 4;
  if (accuracy >= 0.6) return START_LEVEL;
  return 2;
}
