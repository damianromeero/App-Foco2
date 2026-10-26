import { clamp } from '../math';
import { semitoneHz } from './sound';
import type { ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 16;
const TONE_MS = 650;
const GAP_MS = 450;

export const agudoOGrave: GameSpec = {
  id: 'agudo-o-grave',
  category: 'atencion-selectiva',
  modality: 'auditiva',
  name: 'Agudo o grave',
  tagline: 'Dos tonos seguidos. ¿El segundo sube o baja?',
  instructions: [
    'Pulsa "Reproducir" para escuchar dos tonos seguidos.',
    'Decide si el segundo es más agudo (más alto) o más grave (más bajo).',
    'Toca la respuesta. Puedes volver a escuchar los tonos.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 4200,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel, los saltos entre tonos son más pequeños.
    const maxShift = clamp(8 - Math.floor((level - 1) / 2), 2, 8);
    const minShift = clamp(4 - Math.floor((level - 1) / 3), 1, 4);
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const base = rng.int(-6, 6);
      const up = rng.chance(0.5);
      const shift = rng.int(minShift, maxShift) * (up ? 1 : -1);
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Dos tonos seguidos. Pulsa Reproducir para escucharlos.',
        prompt: '¿El segundo tono es más agudo o más grave que el primero?',
        options: [
          { id: 'agudo', label: 'Más agudo' },
          { id: 'grave', label: 'Más grave' },
        ],
        answerId: up ? 'agudo' : 'grave',
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
