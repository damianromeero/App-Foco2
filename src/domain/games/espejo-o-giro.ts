import { makeFigure } from './figures';
import type { ChoiceTrial, GameSpec, Polygon } from './types';

const TRIAL_COUNT = 14;

/**
 * Dos figuras sin simetría. Ni girándolas ni reflejándolas coinciden con otra posición:
 * así la comparación siempre tiene una sola respuesta.
 */
const GLYPHS: readonly Polygon[] = [
  {
    points: [
      [24, 14],
      [74, 14],
      [74, 28],
      [40, 28],
      [40, 46],
      [64, 46],
      [64, 60],
      [40, 60],
      [40, 86],
      [24, 86],
    ],
  },
  {
    points: [
      [22, 12],
      [38, 12],
      [38, 68],
      [70, 68],
      [70, 84],
      [22, 84],
    ],
  },
];

/** Giros posibles: con el nivel, los pasos son más finos (de 90 grados a 30). */
function turnsFor(level: number): number[] {
  const step = level <= 3 ? 90 : level <= 6 ? 45 : 30;
  return Array.from({ length: 360 / step - 1 }, (_, index) => (index + 1) * step);
}

export const espejoOGiro: GameSpec = {
  id: 'espejo-o-giro',
  category: 'atencion-selectiva',
  modality: 'espacial',
  name: 'Espejo o giro',
  tagline: 'Una figura, girada o reflejada. Decide cuál de las dos cosas ha pasado.',
  instructions: [
    'Verás dos figuras: la de la izquierda es la referencia.',
    'Si la de la derecha es la misma figura solo girada, toca "Misma, girada".',
    'Si es su imagen en un espejo, toca "Imagen en espejo".',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 3200,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    const turns = turnsFor(level);
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const glyph = rng.pick(GLYPHS);
      const turn = rng.pick(turns);
      const mirrored = rng.chance(0.5);
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Dos figuras: la de referencia y la que hay que comparar',
        prompt: '¿La segunda es la misma figura girada, o su imagen en un espejo?',
        options: [
          { id: 'girada', label: 'Misma, girada' },
          { id: 'espejo', label: 'Imagen en espejo' },
        ],
        answerId: mirrored ? 'espejo' : 'girada',
        layout: 'row',
        visual: {
          kind: 'conjunto',
          items: [
            makeFigure({ form: glyph, size: 'grande' }),
            makeFigure({ form: glyph, size: 'grande', rotation: turn, mirror: mirrored }),
          ],
        },
        limitMs: calm ? undefined : 8000,
        scorable: true,
        isiMs: 500,
      });
    }
    return trials;
  },
};
