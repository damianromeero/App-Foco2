import { clamp } from '../math';
import type { ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 8;

export const busqueda: GameSpec = {
  id: 'busqueda',
  category: 'atencion-selectiva',
  modality: 'simbolos',
  name: 'Buscar la O',
  tagline: 'Encuentra la O entre un mar de Qs. Lo importante está escondido a plena vista.',
  instructions: [
    'Verás una cuadrícula de letras.',
    'Hay una sola O. Todas las demás son Q.',
    'Toca la O sin prisa: equivocarte también enseña.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 5200,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel crece la cuadrícula: de 4×4 hasta 8×8.
    const size = clamp(4 + Math.floor((level - 1) / 2), 4, 8);
    const total = size * size;
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const targetIndex = rng.int(0, total - 1);
      const options = Array.from({ length: total }, (_, index) => {
        const label = index === targetIndex ? 'O' : 'Q';
        return { id: String(index), label, ariaLabel: `Letra ${label}, casilla ${index + 1}` };
      });
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: `Cuadrícula de ${size} por ${size}`,
        prompt: 'Toca la O entre las Q',
        options,
        answerId: String(targetIndex),
        layout: 'grid',
        columns: size,
        limitMs: calm ? undefined : 12000,
        scorable: true,
        isiMs: 600,
      });
    }
    return trials;
  },
};
