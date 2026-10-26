import { clamp } from '../math';
import type { GameSpec, TapTrial } from './types';

const TRIAL_COUNT = 20;
/** Espera aleatoria antes del estímulo: el momento no es predecible. */
const WAIT_MIN_MS = 800;
const WAIT_MAX_MS = 2400;

export const reflejo: GameSpec = {
  id: 'reflejo',
  category: 'atencion-sostenida',
  modality: 'reaccion',
  name: 'Reflejo',
  tagline: 'Toca en cuanto aparezca el círculo. El momento cambia cada vez.',
  instructions: [
    'Al principio verás una espera. No toques todavía.',
    'Cuando aparezca el círculo, toca lo antes que puedas.',
    'Si tocas durante la espera, cuenta como error.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 2200,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel, la ventana para tocar se acorta. En modo sin prisa se amplía.
    const windowMs = Math.round(clamp(1100 - 80 * (level - 1), 450, 1100) * (calm ? 2 : 1));
    const trials: TapTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      trials.push({
        mode: 'tap',
        shape: 'circle',
        display: '',
        displayLabel: 'Círculo',
        prompt: 'Toca en cuanto aparezca el círculo',
        target: true,
        scorable: true,
        waitMs: rng.int(WAIT_MIN_MS, WAIT_MAX_MS),
        showMs: windowMs,
        isiMs: 500,
      });
    }
    return trials;
  },
};
