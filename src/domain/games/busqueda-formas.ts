import { clamp } from '../math';
import { describeFigure, makeFigure } from './figures';
import type { ChoiceOption, ChoiceTrial, FigureVisual, GameSpec, ShapeName } from './types';

const TRIAL_COUNT = 8;
/** Figuras que nunca son triángulos: en los niveles bajos, el triángulo se ve al primer golpe de vista. */
const DISTRACTORS: readonly ShapeName[] = [
  'circulo',
  'cuadrado',
  'estrella',
  'rombo',
  'cruz',
  'hexagono',
];
/** Desde el nivel 4 hay triángulos girados: ya no basta con buscar la forma, también hay que mirar el giro. */
const CONJUNCTION_FROM_LEVEL = 4;
const WRONG_TURNS = [90, 180, 270] as const;

export const busquedaFormas: GameSpec = {
  id: 'busqueda-formas',
  category: 'atencion-selectiva',
  modality: 'formas',
  name: 'Busca el triángulo',
  tagline: 'Muchas figuras parecidas. Encuentra el triángulo que apunta hacia arriba.',
  instructions: [
    'Verás una cuadrícula de figuras.',
    'Hay un solo triángulo que apunta hacia arriba.',
    'Desde cierto nivel, hay triángulos girados: mira también la dirección.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 4000,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel crece la cuadrícula: de 3×3 hasta 5×5.
    const size = clamp(3 + Math.floor((level - 1) / 3), 3, 5);
    const total = size * size;
    const conjunction = level >= CONJUNCTION_FROM_LEVEL;
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const target = rng.int(0, total - 1);
      const figures: FigureVisual[] = Array.from({ length: total }, (_, index) => {
        if (index === target) {
          return makeFigure({ form: 'triangulo', size: 'mediana' });
        }
        if (conjunction && rng.chance(0.5)) {
          return makeFigure({
            form: 'triangulo',
            size: 'mediana',
            rotation: rng.pick(WRONG_TURNS),
          });
        }
        return makeFigure({ form: rng.pick(DISTRACTORS), size: 'mediana' });
      });
      const options: ChoiceOption[] = figures.map((figure, index) => ({
        id: String(index),
        label: '',
        ariaLabel: `Figura ${index + 1}: ${describeFigure(figure)}`,
        visual: figure,
      }));
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: `Cuadrícula de ${size} por ${size} figuras`,
        prompt: 'Toca el triángulo que apunta hacia arriba',
        options,
        answerId: String(target),
        layout: 'grid',
        columns: size,
        limitMs: calm ? undefined : 9000,
        scorable: true,
        isiMs: 500,
      });
    }
    return trials;
  },
};
