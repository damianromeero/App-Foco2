import { clamp } from '../math';
import type { Rng } from '../rng';
import { isMirrorSymmetric, makeFigure } from './figures';
import type { ChoiceTrial, GameSpec, Point } from './types';

const TRIAL_COUNT = 14;
const CENTER = 50;
/** Distancia mínima entre dos vértices de la misma figura, para que no se pisen. */
const MIN_GAP = 14;

/** Ordena los puntos por ángulo alrededor del centro: así la figura no se cruza consigo misma. */
function byAngle(points: readonly Point[]): Point[] {
  return [...points].sort(
    (a, b) => Math.atan2(a[1] - CENTER, a[0] - CENTER) - Math.atan2(b[1] - CENTER, b[0] - CENTER),
  );
}

/** Puntos a la izquierda, sus reflejos a la derecha y, a veces, puntos sobre el eje. */
function symmetricPoints(rng: Rng, pairs: number): Point[] {
  const left: Point[] = [];
  for (let attempt = 0; attempt < 300 && left.length < pairs; attempt += 1) {
    const candidate: Point = [rng.int(10, 44), rng.int(8, 92)];
    if (left.every(([x, y]) => Math.hypot(x - candidate[0], y - candidate[1]) >= MIN_GAP)) {
      left.push(candidate);
    }
  }
  const points: Point[] = left.flatMap(([x, y]): Point[] => [
    [x, y],
    [100 - x, y],
  ]);
  if (rng.chance(0.4)) {
    points.push([CENTER, rng.int(8, 92)]);
  }
  return byAngle(points);
}

/** Mueve un punto de la figura simétrica hasta que deje de coincidir con su reflejo. */
function breakSymmetry(rng: Rng, points: readonly Point[]): Point[] {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const index = rng.int(0, points.length - 1);
    const point = points[index];
    // Un punto sobre el eje no rompe la simetría al subirlo o bajarlo.
    if (!point || point[0] === CENTER) continue;
    const shift = rng.int(12, 22) * (rng.chance(0.5) ? 1 : -1);
    const y = clamp(point[1] + shift, 6, 94);
    const moved: Point[] = points.map((item, position): Point =>
      position === index ? [item[0], y] : item,
    );
    if (!isMirrorSymmetric(moved)) return byAngle(moved);
  }
  return [...points];
}

export const simetria: GameSpec = {
  id: 'simetria',
  category: 'atencion-selectiva',
  modality: 'formas',
  name: 'Simetría',
  tagline: 'Imagina doblar una figura por su línea central. ¿Coinciden los dos lados?',
  instructions: [
    'Verás una figura y, en el centro, una línea vertical.',
    'Imagina doblar la figura por esa línea.',
    'Toca "Sí" si los dos lados coinciden, y "No" si no.',
  ],
  trialCount: TRIAL_COUNT,
  typicalTrialMs: 3000,
  free: false,
  requiresColor: false,
  build(rng, level, calm) {
    // Con el nivel aparecen más vértices, y la figura es más difícil de comparar de un vistazo.
    const pairs = clamp(2 + Math.floor(level / 3), 2, 5);
    const trials: ChoiceTrial[] = [];
    for (let i = 0; i < TRIAL_COUNT; i += 1) {
      const symmetric = rng.chance(0.5);
      let points = symmetricPoints(rng, pairs);
      if (!symmetric) points = breakSymmetry(rng, points);
      trials.push({
        mode: 'choice',
        display: '',
        displayLabel: 'Figura con una línea de simetría vertical',
        prompt: '¿Coinciden los dos lados si la doblas por la línea?',
        options: [
          { id: 'si', label: 'Sí, es simétrica' },
          { id: 'no', label: 'No es simétrica' },
        ],
        answerId: symmetric ? 'si' : 'no',
        layout: 'row',
        visual: makeFigure({ form: { points }, size: 'grande', axis: true }),
        limitMs: calm ? undefined : 10000,
        scorable: true,
        isiMs: 500,
      });
    }
    return trials;
  },
};
