/** Frecuencia en Hz de un intervalo en semitonos respecto al la de 440 Hz, redondeada al entero. */
export function semitoneHz(semitones: number): number {
  return Math.round(440 * 2 ** (semitones / 12));
}
