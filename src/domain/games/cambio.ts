import { clamp } from '../math';
import type { ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 28;
/* Sin el 5: es el límite entre "mayor" y "menor", así que no tiene una respuesta clara. */
const NUMBERS = [1, 2, 3, 4, 6, 7, 8, 9] as const;

type Rule = 'paridad' | 'magnitud';

const RULES: Record<Rule, { prompt: string; options: { id: string; label: string }[] }> = {
  paridad: {
    prompt: 'Par o impar',
    options: [
      { id: 'par', label: 'PAR' },
      { id: 'impar', label: 'IMPAR' },
    ],
  },
  magnitud: {
    prompt: 'Mayor o menor que 5',
    options: [
      { id: 'mayor', label: 'MAYOR' },
      { id: 'menor', label: 'MENOR' },
    ],
  },
};

export const cambio: GameSpec = {
  id: 'cambio',
  category: 'flexibilidad',
  modality: 'simbolos',
  name: 'Cambia de regla',
  tagline: 'La regla cambia sin avisar. Adaptarte rápido es el entrenamiento.',
  instructions: [
    'Verás un número y, encima, la regla que toca.',
    'Responde según esa regla: par o impar, o mayor o menor que 5.',
    'La regla cambia de vez en cuando: lee siempre el texto de arriba.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 1950,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel aumentan los cambios de regla.
    const pSwitch = clamp(0.3 + 0.045 * (level - 1), 0.3, 0.7);
    const trials: ChoiceTrial[] = [];
    let rule: Rule = rng.chance(0.5) ? 'paridad' : 'magnitud';
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      if (i > 0 && rng.chance(pSwitch)) {
        rule = rule === 'paridad' ? 'magnitud' : 'paridad';
      }
      const number = rng.pick(NUMBERS);
      const answerId =
        rule === 'paridad' ? (number % 2 === 0 ? 'par' : 'impar') : number > 5 ? 'mayor' : 'menor';
      trials.push({
        mode: 'choice',
        display: String(number),
        displayLabel: `Número ${number}`,
        prompt: RULES[rule].prompt,
        options: RULES[rule].options,
        answerId,
        layout: 'row',
        limitMs: calm ? undefined : 3500,
        scorable: true,
        isiMs: 350,
      });
    }
    return trials;
  },
};
