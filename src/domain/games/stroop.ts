import { clamp } from '../math';
import type { ChoiceTrial, GameSpec } from './types';

const TRIAL_COUNT = 24;

const COLORS = [
  { id: 'rojo', label: 'ROJO' },
  { id: 'azul', label: 'AZUL' },
  { id: 'verde', label: 'VERDE' },
  { id: 'amarillo', label: 'AMARILLO' },
] as const;

type ColorEntry = (typeof COLORS)[number];

export const stroop: GameSpec = {
  id: 'stroop',
  category: 'control-inhibitorio',
  modality: 'simbolos',
  name: 'Tinta y palabra',
  tagline: 'Una palabra escrita en otro color. Tu cerebro quiere leer; tú dices el color.',
  instructions: [
    'Verás una palabra de color.',
    'Di el color de la tinta, no lo que dice la palabra.',
    'Toca el botón del color de la tinta.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 1900,
  free: false,
  requiresColor: true,
  build(rng, level, calm) {
    // Con el nivel bajan los ensayos "fáciles" (palabra y tinta iguales).
    const pCongruent = clamp(0.75 - 0.055 * (level - 1), 0.25, 0.75);
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const word: ColorEntry = rng.pick(COLORS);
      const ink: ColorEntry = rng.chance(pCongruent)
        ? word
        : rng.pick(COLORS.filter((color) => color.id !== word.id));
      trials.push({
        mode: 'choice',
        display: word.label,
        displayLabel: `La palabra ${word.label}, escrita en color ${ink.id}`,
        displayColor: ink.id,
        prompt: 'Di el color de la tinta, no la palabra',
        options: COLORS.map((color) => ({ id: color.id, label: color.label })),
        answerId: ink.id,
        layout: 'row',
        limitMs: calm ? undefined : 4500,
        scorable: true,
        isiMs: 400,
      });
    }
    return trials;
  },
};
