import { clamp } from '../math';
import type { ChoiceOption, ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 12;
const BEEP_HZ = 880;
const BEEP_MS = 110;

export const contarPitidos: GameSpec = {
  id: 'contar-pitidos',
  category: 'atencion-sostenida',
  modality: 'auditiva',
  name: 'Cuenta los pitidos',
  tagline: 'Una serie de pitidos cortos. Cuéntalos sin perder la cuenta.',
  instructions: [
    'Pulsa "Reproducir" para escuchar la serie de pitidos.',
    'Cuenta cuántos pitidos has oído.',
    'Toca el número. Puedes volver a escuchar la serie.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 5200,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel suben los pitidos posibles y se acortan los silencios entre ellos.
    const top = clamp(4 + Math.floor((level - 1) / 2), 4, 7);
    const gapMs = clamp(380 - 30 * (level - 1), 150, 380);
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const count = rng.int(2, top);
      const options: ChoiceOption[] = Array.from({ length: top - 1 }, (_, index) => ({
        id: String(index + 2),
        label: String(index + 2),
      }));
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Serie de pitidos. Pulsa Reproducir para escucharla.',
        prompt: '¿Cuántos pitidos has oído?',
        options,
        answerId: String(count),
        layout: 'grid',
        columns: options.length,
        visual: {
          kind: 'tonos',
          tones: Array.from({ length: count }, () => ({ hz: BEEP_HZ, ms: BEEP_MS })),
          gapMs,
        },
        limitMs: calm ? undefined : 15000,
        scorable: true,
        isiMs: 600,
      });
    }
    return trials;
  },
};
