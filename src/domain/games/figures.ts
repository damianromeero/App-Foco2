import type { FigureSize, FigureVisual, Point, Polygon, ShapeName } from './types';

const SHAPE_WORDS: Record<ShapeName, string> = {
  circulo: 'círculo',
  cuadrado: 'cuadrado',
  triangulo: 'triángulo',
  estrella: 'estrella',
  rombo: 'rombo',
  cruz: 'cruz',
  flecha: 'flecha',
  hexagono: 'hexágono',
};

const SIZE_WORDS: Record<FigureSize, string> = {
  pequena: 'pequeño',
  mediana: 'mediano',
  grande: 'grande',
};

/** Escala de cada tamaño. Se queda por debajo de 0,9 para que las figuras no salgan del dibujo al girar. */
const SIZE_SCALE: Record<FigureSize, number> = {
  pequena: 0.45,
  mediana: 0.65,
  grande: 0.85,
};

const CENTER = 50;
const CIRCLE_RADIUS = 40;
/** Para girar: 0 = hacia arriba (triángulo), 90 = hacia la derecha, etc. */
const TRIANGLE_DIRECTIONS = [
  'hacia arriba',
  'hacia la derecha',
  'hacia abajo',
  'hacia la izquierda',
] as const;

type PolygonShape = Exclude<ShapeName, 'circulo'>;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function regularPolygon(sides: number, radius: number, startDegrees: number): Point[] {
  return Array.from({ length: sides }, (_, index): Point => {
    const angle = ((startDegrees + (360 / sides) * index) * Math.PI) / 180;
    return [round(CENTER + radius * Math.cos(angle)), round(CENTER + radius * Math.sin(angle))];
  });
}

function starPoints(): Point[] {
  return Array.from({ length: 10 }, (_, index): Point => {
    const radius = index % 2 === 0 ? 46 : 20;
    const angle = ((-90 + index * 36) * Math.PI) / 180;
    return [round(CENTER + radius * Math.cos(angle)), round(CENTER + radius * Math.sin(angle))];
  });
}

/** Contorno de cada forma con nombre, en el cuadrado de 0 a 100 y sin girar. */
const BASE_POINTS: Record<PolygonShape, readonly Point[]> = {
  cuadrado: [
    [14, 14],
    [86, 14],
    [86, 86],
    [14, 86],
  ],
  triangulo: [
    [50, 8],
    [90, 71],
    [10, 71],
  ],
  rombo: [
    [50, 8],
    [92, 50],
    [50, 92],
    [8, 50],
  ],
  estrella: starPoints(),
  cruz: [
    [38, 6],
    [62, 6],
    [62, 38],
    [94, 38],
    [94, 62],
    [62, 62],
    [62, 94],
    [38, 94],
    [38, 62],
    [6, 62],
    [6, 38],
    [38, 38],
  ],
  flecha: [
    [6, 36],
    [56, 36],
    [56, 14],
    [94, 50],
    [56, 86],
    [56, 64],
    [6, 64],
  ],
  hexagono: regularPolygon(6, 44, -90),
};

export type FigureGeometry =
  { kind: 'circle'; radius: number } | { kind: 'polygon'; points: Point[] };

/**
 * Geometría final de una figura: primero se refleja, después se escala y se gira alrededor
 * del centro. Así el dibujo y las pruebas usan exactamente las mismas cuentas.
 */
export function figureGeometry(figure: FigureVisual): FigureGeometry {
  const scale = SIZE_SCALE[figure.size];
  if (figure.form === 'circulo') {
    return { kind: 'circle', radius: round(CIRCLE_RADIUS * scale) };
  }
  const source = typeof figure.form === 'string' ? BASE_POINTS[figure.form] : figure.form.points;
  const turn = (figure.rotation * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const points = source.map(([x0, y0]): Point => {
    const x = figure.mirror ? 100 - x0 : x0;
    const dx = (x - CENTER) * scale;
    const dy = (y0 - CENTER) * scale;
    return [round(CENTER + dx * cos - dy * sin), round(CENTER + dx * sin + dy * cos)];
  });
  return { kind: 'polygon', points };
}

/** Crea una figura con valores por defecto: sin giro, sin reflejo, rellena y de tamaño mediano. */
export function makeFigure(
  options: Partial<Omit<FigureVisual, 'kind'>> & { form: ShapeName | Polygon },
): FigureVisual {
  return {
    kind: 'figura',
    rotation: 0,
    mirror: false,
    filled: true,
    size: 'mediana',
    axis: false,
    ...options,
  };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Hacia dónde apunta una figura, si esa orientación se ve. Null si no aplica. */
function orientationWord(figure: FigureVisual): string | null {
  if (figure.form !== 'triangulo' && figure.form !== 'flecha') return null;
  const turns = ((figure.rotation % 360) + 360) % 360;
  if (turns % 90 !== 0) return `girada ${turns} grados`;
  const quarter = turns / 90;
  // La flecha base apunta a la derecha; el triángulo base apunta hacia arriba.
  const index = figure.form === 'flecha' ? (quarter + 1) % 4 : quarter;
  return TRIANGLE_DIRECTIONS[index] ?? null;
}

/** Descripción en español para lectores de pantalla: forma, tamaño, relleno, orientación. */
export function describeFigure(figure: FigureVisual): string {
  const parts: string[] = [
    typeof figure.form === 'string' ? SHAPE_WORDS[figure.form] : 'figura de trazo libre',
    SIZE_WORDS[figure.size],
    figure.filled ? 'relleno' : 'solo contorno',
  ];
  const orientation = orientationWord(figure);
  if (orientation) parts.push(orientation);
  if (figure.mirror) parts.push('reflejada');
  return capitalize(parts.join(', '));
}

/** Clave que identifica una figura por sus datos: sirve para comprobar que dos figuras son distintas. */
export function figureKey(figure: FigureVisual): string {
  const form =
    typeof figure.form === 'string'
      ? figure.form
      : figure.form.points.map(([x, y]) => `${x},${y}`).join(';');
  return [form, figure.size, figure.filled, figure.rotation, figure.mirror, figure.axis].join('|');
}

/** Cierto si el conjunto de puntos se refleja sobre sí mismo respecto a la línea vertical x = 50. */
export function isMirrorSymmetric(points: readonly Point[], tolerance = 0.5): boolean {
  return points.every(([x, y]) =>
    points.some(
      ([qx, qy]) => Math.abs(qx - (100 - x)) <= tolerance && Math.abs(qy - y) <= tolerance,
    ),
  );
}

/** Cierto si dos conjuntos de puntos coinciden, sin importar el orden, dentro de una tolerancia. */
export function samePoints(a: readonly Point[], b: readonly Point[], tolerance = 0.5): boolean {
  if (a.length !== b.length) return false;
  return a.every(([x, y]) =>
    b.some(([qx, qy]) => Math.abs(qx - x) <= tolerance && Math.abs(qy - y) <= tolerance),
  );
}
