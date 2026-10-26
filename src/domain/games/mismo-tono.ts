import { clamp } from '../math';
import { semitoneHz } from './sound';
import type { ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 16;
const TONE_MS = 650;
const GAP_MS = 450;

export const mismoTono: GameSpec = {
  id: 'mismo-tono',
  category: 'memoria-de-trabajo',
  modality: 'auditiva',
  name: 'Mismo tono',
  tagline: 'Escucha dos tonos seguidos y decide si tienen la misma altura.',
  instructions: [
    'Pulsa "Reproducir" para escuchar dos tonos seguidos.',
    'Decide si el segundo tiene la misma altura que el primero.',
    'Toca "Igual" o "Distinto". Puedes volver a escucharlos.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 4200,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel, la diferencia entre tonos se hace más pequeña.
    const maxShift = clamp(7 - Math.floor((level - 1) / 2), 1, 6);
    const minShift = level <= 2 ? 3 : level <= 5 ? 2 : 1;
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const base = rng.int(-6, 6);
      const same = rng.chance(0.5);
      const shift = same ? 0 : rng.int(minShift, maxShift) * (rng.chance(0.5) ? 1 : -1);
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Dos tonos seguidos. Pulsa Reproducir para escucharlos.',
        prompt: '¿El segundo tono tiene la misma altura que el primero?',
        options: [
          { id: 'igual', label: 'Igual' },
          { id: 'distinto', label: 'Distinto' },
        ],
        answerId: same ? 'igual' : 'distinto',
        layout: 'row',
        visual: {
          kind: 'tonos',
          tones: [
            { hz: semitoneHz(base), ms: TONE_MS },
            { hz: semitoneHz(base + shift), ms: TONE_MS },
          ],
          gapMs: GAP_MS,
        },
        limitMs: calm ? undefined : 12000,
        scorable: true,
        isiMs: 600,
      });
    }
    return trials;
  },
};
