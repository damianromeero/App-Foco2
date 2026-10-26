import type { Rng } from '../rng';
import { makeFigure } from './figures';
import type { ChoiceOption, ChoiceTrial, FigureVisual, GameSpec, ShapeName, Visual } from './types';

const TRIAL_COUNT = 12;
const SHAPES: readonly ShapeName[] = [
  'circulo',
  'cuadrado',
  'triangulo',
  'estrella',
  'rombo',
  'cruz',
  'hexagono',
  'flecha',
];
/** Figuras cuyo giro se ve: un triángulo o una flecha no se parecen a sí mismos al girar. */
const TURNABLE: readonly ShapeName[] = ['triangulo', 'flecha'];
const TURNS = [0, 90, 180, 270];
const TURN_STEPS = [90, 180, 270];

function randomCell(rng: Rng): FigureVisual {
  const form = rng.pick(SHAPES);
  return makeFigure({
    form,
    size: 'mediana',
    rotation: TURNABLE.includes(form) ? rng.pick(TURNS) : 0,
  });
}

/** Figura que sí se nota girada: en niveles altos el cambio es solo de giro. */
function turnableCell(rng: Rng): FigureVisual {
  return makeFigure({ form: rng.pick(TURNABLE), size: 'mediana', rotation: rng.pick(TURNS) });
}

function alteredCell(rng: Rng, cell: FigureVisual, rotationOnly: boolean): FigureVisual {
  if (rotationOnly) {
    return { ...cell, rotation: (cell.rotation + rng.pick(TURN_STEPS)) % 360 };
  }
  const others = SHAPES.filter((shape) => shape !== cell.form);
  return { ...cell, form: rng.pick(others) };
}

export const diferenciaCuadricula: GameSpec = {
  id: 'diferencia-cuadricula',
  category: 'atencion-selectiva',
  modality: 'espacial',
  name: 'Qué ha cambiado',
  tagline: 'Dos cuadrículas casi iguales. Solo una casilla es distinta.',
  instructions: [
    'Verás dos cuadrículas iguales salvo en una casilla.',
    'Compara con calma: la figura puede tener otra forma o estar girada.',
    'Toca el número de la casilla que cambia.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 5000,
  free: true,
  requiresColor: false,
  build(rng, level, calm) {
    // Hasta el nivel 3 cambia la forma; desde el 4, solo el giro, que cuesta más ver.
    const subtle = level >= 4;
    const size = level <= 3 ? 3 : 4;
    const total = size * size;
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const changed = rng.int(0, total - 1);
      const first = Array.from({ length: total }, () => randomCell(rng));
      const cellsA = first.map((cell, index) =>
        index === changed && subtle ? turnableCell(rng) : cell,
      );
      const cellsB = cellsA.map((cell, index) =>
        index === changed ? alteredCell(rng, cell, subtle) : cell,
      );
      const visual: Visual = {
        kind: 'conjunto',
        items: [
          { kind: 'cuadricula', columns: size, lit: [], cells: cellsA },
          { kind: 'cuadricula', columns: size, lit: [], cells: cellsB },
        ],
      };
      const options: ChoiceOption[] = Array.from({ length: total }, (_, index) => ({
        id: String(index),
        label: String(index + 1),
        ariaLabel: `Casilla ${index + 1}, fila ${Math.floor(index / size) + 1}, columna ${(index % size) + 1}`,
      }));
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Dos cuadrículas iguales salvo en una casilla',
        prompt: '¿En qué casilla ha cambiado?',
        options,
        answerId: String(changed),
        layout: 'grid',
        columns: size,
        visual,
        limitMs: calm ? undefined : 15000,
        scorable: true,
        isiMs: 500,
      });
    }
    return trials;
  },
};
