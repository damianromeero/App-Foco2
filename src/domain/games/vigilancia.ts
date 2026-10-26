import { clamp } from '../math';
import type { GameSpec, TapTrial } from './types';

const TRIAL_COUNT = 36;
/* Sin I, O, Q ni X: son letras que se confunden. La X es el único estímulo objetivo. */
const DISTRACTORS = 'ABCDEFGHJKLMNPRSTUVWYZ'.split('');

export const vigilancia: GameSpec = {
  id: 'vigilancia',
  category: 'atencion-sostenida',
  modality: 'simbolos',
  name: 'Vigilancia',
  tagline: 'Entre muchas letras aparece una X. Tu tarea es no perderla.',
  instructions: [
    'Verás letras una detrás de otra.',
    'Toca la pantalla solo cuando aparezca una X.',
    'Si aparece cualquier otra letra, no toques.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 1420,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Cuanto más alto el nivel, menos X aparecen y más breve es cada letra.
    const pTarget = clamp(0.3 - 0.02 * (level - 1), 0.12, 0.3);
    const showMs = Math.round((1000 - 40 * (level - 1)) * (calm ? 1.6 : 1));
    const trials: TapTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const target = rng.chance(pTarget);
      const letter = target ? 'X' : rng.pick(DISTRACTORS);
      trials.push({
        mode: 'tap',
        shape: 'letter',
        display: letter,
        displayLabel: target ? 'Letra X' : `Letra ${letter}`,
        prompt: 'Toca solo con la X',
        target,
        scorable: true,
        showMs,
        isiMs: 500,
      });
    }
    return trials;
  },
};
