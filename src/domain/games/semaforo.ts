import { clamp } from '../math';
import type { GameSpec, TapTrial } from './types';

const TRIAL_COUNT = 36;

export const semaforo: GameSpec = {
  id: 'semaforo',
  category: 'control-inhibitorio',
  modality: 'formas',
  name: 'Semáforo',
  tagline: 'Toca con el círculo y frena con el cuadrado. Frenar también entrena.',
  instructions: [
    'Verás figuras una tras otra.',
    'Toca cuando aparezca un círculo.',
    'Cuando aparezca un cuadrado, no toques y espera.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 1130,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel suben los cuadrados (hay que frenar más) y se acorta el tiempo de respuesta.
    const pSquare = clamp(0.25 + 0.015 * (level - 1), 0.25, 0.4);
    const showMs = Math.round((800 - 35 * (level - 1)) * (calm ? 1.6 : 1));
    const trials: TapTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const square = rng.chance(pSquare);
      trials.push({
        mode: 'tap',
        shape: square ? 'square' : 'circle',
        display: '',
        displayLabel: square ? 'Cuadrado' : 'Círculo',
        prompt: 'Toca solo con el círculo',
        target: !square,
        scorable: true,
        showMs,
        isiMs: 400,
      });
    }
    return trials;
  },
};
