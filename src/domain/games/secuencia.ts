import type { Rng } from '../rng';
import type { GameSpec, TapTrial } from './types';

const TRIAL_COUNT = 20;
const MATCH_RATE = 0.33;
/* Consonantes sin Y, sin vocales: evitan que la letra forme sílabas o palabras. */
const LETTERS = 'BCDFGHKLMNPRSTVWXZ'.split('');

function pickOther(rng: Rng, exclude: string): string {
  let candidate = rng.pick(LETTERS);
  while (candidate === exclude) {
    candidate = rng.pick(LETTERS);
  }
  return candidate;
}

export const secuencia: GameSpec = {
  id: 'secuencia',
  category: 'memoria-de-trabajo',
  modality: 'simbolos',
  name: 'Eco de letras',
  tagline: 'Recuerda las letras que ya pasaron y decide si esta coincide.',
  instructions: [
    'Verás una letra cada vez.',
    'Toca "Coincide" si la letra es igual a la de hace un número de turnos concreto.',
    'Los primeros turnos sirven para empezar: no puntúan.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 2600,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Nivel 1–3: comparar con la anterior. Nivel 4–6: dos atrás. Nivel 7 en adelante: tres atrás.
    const n = Math.min(3, 1 + Math.floor((level - 1) / 3));
    const showMs = Math.round((2400 - 100 * (level - 1)) * (calm ? 1.5 : 1));
    const prompt = n === 1 ? '¿Coincide con la anterior?' : `¿Coincide con la de hace ${n}?`;
    const sequence: string[] = [];
    const trials: TapTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const scorable = i >= n;
      let letter: string;
      let target = false;
      if (scorable) {
        const reference = sequence[i - n] ?? '';
        target = rng.chance(MATCH_RATE);
        letter = target ? reference : pickOther(rng, reference);
      } else {
        letter = rng.pick(LETTERS);
      }
      sequence.push(letter);
      trials.push({
        mode: 'tap',
        shape: 'letter',
        display: letter,
        displayLabel: `Letra ${letter}`,
        prompt,
        target,
        scorable,
        showMs,
        isiMs: 500,
      });
    }
    return trials;
  },
};
