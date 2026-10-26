import { cyclic } from '../math';
import { describeFigure, makeFigure } from './figures';
import type {
  ChoiceOption,
  ChoiceTrial,
  FigureSize,
  FigureVisual,
  GameSpec,
  ShapeName,
  Visual,
} from './types';

const TRIAL_COUNT = 12;
type Rule = 'giro' | 'tamano' | 'forma' | 'relleno';
const RULES: readonly Rule[] = ['giro', 'tamano', 'forma', 'relleno'];
const CYCLE_SHAPES: readonly ShapeName[] = [
  'circulo',
  'cuadrado',
  'triangulo',
  'estrella',
  'rombo',
  'cruz',
];
const SIZES: readonly FigureSize[] = ['pequena', 'mediana', 'grande'];
const TURN_OPTIONS = [0, 45, 90, 135, 180, 225, 270, 315];

interface Attrs {
  form: ShapeName;
  size: FigureSize;
  filled: boolean;
  rotation: number;
}

/** Valor de la serie en la posición `index`. Todas las propiedades siguen la regla o son constantes. */
function sequenceItem(rule: Rule, index: number, turn: number, cycle: readonly ShapeName[]): Attrs {
  switch (rule) {
    case 'giro':
      return { form: 'flecha', size: 'mediana', filled: true, rotation: (index * turn) % 360 };
    case 'tamano':
      return { form: 'cuadrado', size: cyclic(SIZES, index), filled: true, rotation: 0 };
    case 'forma':
      return { form: cyclic(cycle, index), size: 'grande', filled: true, rotation: 0 };
    case 'relleno':
      return { form: 'cuadrado', size: 'mediana', filled: index % 2 === 0, rotation: 0 };
  }
}

/** Respuestas incorrectas: cada una cambia una sola propiedad de la correcta, así que ninguna sigue la serie. */
function variantsOf(answer: Attrs): Attrs[] {
  const list: Attrs[] = [];
  for (const form of CYCLE_SHAPES) {
    if (form !== answer.form) list.push({ ...answer, form });
  }
  for (const size of SIZES) {
    if (size !== answer.size) list.push({ ...answer, size });
  }
  list.push({ ...answer, filled: !answer.filled });
  if (answer.form === 'flecha' || answer.form === 'triangulo') {
    for (const rotation of TURN_OPTIONS) {
      if (rotation !== answer.rotation) list.push({ ...answer, rotation });
    }
  }
  return list;
}

function toFigure(attrs: Attrs): FigureVisual {
  return makeFigure({
    form: attrs.form,
    size: attrs.size,
    filled: attrs.filled,
    rotation: attrs.rotation,
  });
}

export const siguienteFigura: GameSpec = {
  id: 'siguiente-figura',
  category: 'flexibilidad',
  modality: 'formas',
  name: 'Siguiente figura',
  tagline: 'Una serie de figuras sigue una regla. ¿Qué viene después?',
  instructions: [
    'Verás cuatro figuras seguidas y un hueco con un signo de interrogación.',
    'Descubre cómo cambian: de forma, de tamaño, de giro o de relleno.',
    'Toca la figura que sigue la misma regla.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 3000,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel, los giros son más finos. El ciclo de formas tiene tres figuras para que
    // se repita dentro de las cuatro que se ven: así la siguiente siempre se puede deducir.
    const turn = level >= 5 ? 45 : 90;
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const rule = rng.pick(RULES);
      const start = rng.int(0, 3);
      const cycle: ShapeName[] = rng.shuffle(CYCLE_SHAPES).slice(0, 3);
      const shown = [0, 1, 2, 3].map((step) =>
        toFigure(sequenceItem(rule, start + step, turn, cycle)),
      );
      const answer = sequenceItem(rule, start + 4, turn, cycle);
      const picks = rng.shuffle(variantsOf(answer)).slice(0, 3);
      const pool = rng.shuffle([
        { attrs: answer, correct: true },
        ...picks.map((attrs) => ({ attrs, correct: false })),
      ]);
      const options: ChoiceOption[] = pool.map(({ attrs }, position) => {
        const figure = toFigure(attrs);
        return {
          id: String(position),
          label: '',
          ariaLabel: `Figura ${position + 1}: ${describeFigure(figure)}`,
          visual: figure,
        };
      });
      const visual: Visual = {
        kind: 'conjunto',
        items: [...shown, { kind: 'incognita' }],
      };
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Cuatro figuras seguidas y una incógnita',
        prompt: '¿Qué figura sigue la serie?',
        options,
        answerId: String(pool.findIndex((item) => item.correct)),
        layout: 'grid',
        columns: 4,
        visual,
        limitMs: calm ? undefined : 12000,
        scorable: true,
        isiMs: 450,
      });
    }
    return trials;
  },
};
