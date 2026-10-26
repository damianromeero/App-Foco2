import { clamp } from '../math';
import type { Rng } from '../rng';
import type { ChoiceOption, ChoiceTrial, DotVisual, GameSpec, Point } from './types';

const TRIAL_COUNT = 8;
const TARGETS = 3;
const LETTERS = ['A', 'B', 'C', 'D'] as const;
const LIT_MS = 1300;
/** Distancia mínima entre dos puntos, en el cuadrado de 0 a 100. */
const MIN_GAP = 12;

/** Posiciones repartidas al azar, sin que dos puntos se pisen. */
function spread(rng: Rng, count: number): Point[] {
  const points: Point[] = [];
  for (let attempt = 0; attempt < 2000 && points.length < count; attempt += 1) {
    const candidate: Point = [rng.int(8, 92), rng.int(8, 92)];
    if (points.every(([x, y]) => Math.hypot(x - candidate[0], y - candidate[1]) >= MIN_GAP)) {
      points.push(candidate);
    }
  }
  return points;
}

export const seguirPuntos: GameSpec = {
  id: 'seguir-puntos',
  category: 'atencion-sostenida',
  modality: 'espacial',
  name: 'Sigue los puntos',
  tagline: 'Tres puntos se iluminan y luego todos se mueven. Sigue a los iluminados.',
  instructions: [
    'Al principio, tres puntos se iluminan.',
    'Después, todos los puntos se mueven y se parecen entre sí.',
    'Cuando paren, toca la letra del punto que estaba iluminado.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 5600,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel aparecen más puntos y el movimiento es más rápido. En modo sin prisa, más lento.
    const dotCount = clamp(6 + Math.floor((level - 1) / 2), 6, 9);
    const moveMs = Math.round(clamp(2600 - 150 * (level - 1), 1400, 2600) * (calm ? 1.3 : 1));
    const indexes = Array.from({ length: dotCount }, (_, index) => index);
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const starts = spread(rng, dotCount);
      const ends = spread(rng, dotCount);
      const targets = new Set(rng.shuffle(indexes).slice(0, TARGETS));

      const previewDots: DotVisual[] = starts.map((from, index) => ({
        from,
        to: ends[index] ?? from,
        lit: targets.has(index),
      }));

      // Al responder, los puntos están quietos en su posición final y cuatro tienen letra.
      const probeTarget = rng.pick([...targets]);
      const distractors = rng.shuffle(indexes.filter((index) => !targets.has(index))).slice(0, 3);
      const picks = rng.shuffle([probeTarget, ...distractors]);
      const letterOf = new Map<number, string>(
        picks.map((dot, position): [number, string] => [dot, LETTERS[position] ?? 'A']),
      );
      const probeDots: DotVisual[] = ends.map((to, index) => ({
        from: to,
        to,
        lit: false,
        letter: letterOf.get(index),
      }));

      const options: ChoiceOption[] = picks.map((dot) => {
        const letter = letterOf.get(dot) ?? 'A';
        return { id: letter, label: letter, ariaLabel: `Punto ${letter}` };
      });

      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Puntos con letras. Toca la letra del punto que estaba iluminado.',
        prompt: 'Toca la letra del punto que estaba iluminado al principio',
        options,
        answerId: letterOf.get(probeTarget) ?? 'A',
        layout: 'grid',
        columns: options.length,
        preview: {
          visual: { kind: 'puntos', dots: previewDots, litMs: LIT_MS, moveMs },
          ms: LIT_MS + moveMs + 300,
          label: 'Tres puntos se iluminan. Después todos se mueven.',
        },
        visual: { kind: 'puntos', dots: probeDots },
        limitMs: calm ? undefined : 10000,
        scorable: true,
        isiMs: 500,
      });
    }
    return trials;
  },
};
