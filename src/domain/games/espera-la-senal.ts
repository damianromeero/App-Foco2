import { clamp } from '../math';
import type { GameSpec, TapTrial } from './types';

const TRIAL_COUNT = 30;
const WAIT_MIN_MS = 700;
const WAIT_MAX_MS = 2300;

export const esperaLaSenal: GameSpec = {
  id: 'espera-la-senal',
  category: 'control-inhibitorio',
  modality: 'reaccion',
  name: 'Espera la señal',
  tagline: 'Espera el aviso. Tocar antes también cuenta como error.',
  instructions: [
    'Al principio verás una espera. No toques mientras dure.',
    'Cuando aparezca el círculo, toca. Con el cuadrado, no toques.',
    'La espera cambia en cada ensayo: no hay un ritmo fijo.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 2100,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel aumentan los cuadrados (hay que frenar más) y se acorta la ventana para tocar.
    const pNoGo = clamp(0.25 + 0.04 * (level - 1), 0.25, 0.5);
    const showMs = Math.round(clamp(900 - 40 * (level - 1), 500, 900) * (calm ? 2 : 1));
    const trials: TapTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const go = !rng.chance(pNoGo);
      trials.push({
        mode: 'tap',
        shape: go ? 'circle' : 'square',
        display: '',
        displayLabel: go ? 'Círculo' : 'Cuadrado',
        prompt: 'Toca solo con el círculo',
        target: go,
        scorable: true,
        waitMs: rng.int(WAIT_MIN_MS, WAIT_MAX_MS),
        showMs,
        isiMs: 450,
      });
    }
    return trials;
  },
};
