import { clamp } from '../math';
import type { Rng } from '../rng';
import { describeFigure, makeFigure } from './figures';
import type {
  ChoiceOption,
  ChoiceTrial,
  FigureSize,
  FigureVisual,
  GameSpec,
  ShapeName,
} from './types';

const TRIAL_COUNT = 16;

type Dimension = 'forma' | 'tamano' | 'relleno' | 'giro';
const DIMENSIONS: readonly Dimension[] = ['forma', 'tamano', 'relleno', 'giro'];
const CUE: Record<Dimension, string> = {
  forma: 'la forma',
  tamano: 'el tamaño',
  relleno: 'el relleno (lleno o vacío)',
  giro: 'el giro',
};
const SHAPES: readonly ShapeName[] = [
  'circulo',
  'cuadrado',
  'triangulo',
  'estrella',
  'rombo',
  'cruz',
  'hexagono',
];
const SIZES: readonly FigureSize[] = ['pequena', 'mediana', 'grande'];
/** La flecha no es simétrica: cada giro se ve distinto. */
const TURNS = [0, 90, 180, 270];

interface Attrs {
  form: ShapeName;
  size: FigureSize;
  filled: boolean;
  rotation: number;
}

/** Los dos valores que comparten las tres figuras "normales" y el de la figura distinta, en la dimensión pedida. */
function cuedPair(rng: Rng, dimension: Dimension, base: Attrs): [Attrs, Attrs] {
  switch (dimension) {
    case 'forma': {
      const shared = rng.pick(SHAPES);
      const odd = rng.pick(SHAPES.filter((shape) => shape !== shared));
      return [
        { ...base, form: shared },
        { ...base, form: odd },
      ];
    }
    case 'tamano': {
      const shared = rng.pick(SIZES);
      const odd = rng.pick(SIZES.filter((size) => size !== shared));
      return [
        { ...base, size: shared },
        { ...base, size: odd },
      ];
    }
    case 'relleno': {
      const shared = rng.chance(0.5);
      return [
        { ...base, filled: shared },
        { ...base, filled: !shared },
      ];
    }
    case 'giro': {
      const shared = rng.pick(TURNS);
      const odd = rng.pick(TURNS.filter((turn) => turn !== shared));
      return [
        { ...base, rotation: shared },
        { ...base, rotation: odd },
      ];
    }
  }
}

/** Con nivel alto, las propiedades que no son la pista también cambian: hay que fijarse en la pista. */
function noisy(rng: Rng, attrs: Attrs, dimension: Dimension): Attrs {
  return {
    form: dimension === 'forma' || dimension === 'giro' ? attrs.form : rng.pick(SHAPES),
    size: dimension === 'tamano' ? attrs.size : rng.pick(SIZES),
    filled: dimension === 'relleno' ? attrs.filled : rng.chance(0.5),
    rotation: attrs.rotation,
  };
}

function toFigure(attrs: Attrs): FigureVisual {
  return makeFigure({
    form: attrs.form,
    size: attrs.size,
    filled: attrs.filled,
    rotation: attrs.rotation,
  });
}

export const cualNoEncaja: GameSpec = {
  id: 'cual-no-encaja',
  category: 'flexibilidad',
  modality: 'formas',
  name: 'Cuál no encaja',
  tagline: 'La pista cambia de vez en cuando. Busca la figura que no sigue la pista.',
  instructions: [
    'Verás cuatro figuras. Tres comparten algo.',
    'Lee la pista del texto: forma, tamaño, relleno o giro.',
    'Toca la figura que no encaja. La pista cambia a veces: léela siempre.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 2600,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel, la pista cambia más a menudo y las demás propiedades también varían.
    const pSwitch = clamp(0.35 + 0.04 * (level - 1), 0.35, 0.7);
    const useNoise = level >= 5;
    const trials: ChoiceTrial[] = [];
    let dimension = rng.pick(DIMENSIONS);
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      if (i > 0 && rng.chance(pSwitch)) {
        dimension = rng.pick(DIMENSIONS.filter((item) => item !== dimension));
      }
      const base: Attrs = {
        form: dimension === 'giro' ? 'flecha' : rng.pick(SHAPES),
        size: 'mediana',
        filled: true,
        rotation: 0,
      };
      const [shared, odd] = cuedPair(rng, dimension, base);
      const oddIndex = rng.int(0, 3);
      const figures = Array.from({ length: 4 }, (_, index) => {
        const attrs = index === oddIndex ? odd : shared;
        return {
          figure: toFigure(useNoise ? noisy(rng, attrs, dimension) : attrs),
          odd: index === oddIndex,
        };
      });
      const shuffled = rng.shuffle(figures);
      const options: ChoiceOption[] = shuffled.map(({ figure }, position) => ({
        id: String(position),
        label: '',
        ariaLabel: `Figura ${position + 1}: ${describeFigure(figure)}`,
        visual: figure,
      }));
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Cuatro figuras',
        prompt: `Toca la figura que no encaja por ${CUE[dimension]}.`,
        options,
        answerId: String(shuffled.findIndex((item) => item.odd)),
        layout: 'grid',
        columns: 4,
        limitMs: calm ? undefined : 6000,
        scorable: true,
        isiMs: 400,
      });
    }
    return trials;
  },
};
