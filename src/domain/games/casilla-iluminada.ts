import { clamp } from '../math';
import type { ChoiceOption, ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 16;

/** Lado de la cuadrícula: 3 al principio y 6 en el nivel más alto. */
function gridSize(level: number): number {
  return clamp(3 + Math.floor((level - 1) / 3), 3, 6);
}

export const casillaIluminada: GameSpec = {
  id: 'casilla-iluminada',
  category: 'memoria-de-trabajo',
  modality: 'espacial',
  name: 'Casilla iluminada',
  tagline: 'Una casilla se ilumina un momento. Recuerda dónde estaba.',
  instructions: [
    'Verás una cuadrícula con una casilla iluminada.',
    'Cuando la luz se apague, toca la casilla donde estaba.',
    'Con el nivel, la cuadrícula crece y la luz dura menos.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 2600,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    const size = gridSize(level);
    const total = size * size;
    const previewMs = Math.round(clamp(1400 - 100 * (level - 1), 600, 1400) * (calm ? 1.5 : 1));
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const lit = rng.int(0, total - 1);
      const row = Math.floor(lit / size) + 1;
      const column = (lit % size) + 1;
      const options: ChoiceOption[] = Array.from({ length: total }, (_, index) => ({
        id: String(index),
        label: '',
        ariaLabel: `Fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1}`,
      }));
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: `Cuadrícula de ${size} por ${size}`,
        prompt: '¿En qué casilla estaba la luz?',
        options,
        answerId: String(lit),
        layout: 'grid',
        columns: size,
        preview: {
          visual: { kind: 'cuadricula', columns: size, lit: [lit] },
          ms: previewMs,
          label: `Luz en la fila ${row}, columna ${column}.`,
        },
        limitMs: calm ? undefined : 8000,
        scorable: true,
        isiMs: 500,
      });
    }
    return trials;
  },
};
