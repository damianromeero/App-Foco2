import type { GameId } from '../model';
import type { Rng } from '../rng';
import type { TrialOutcome } from '../scoring';

export type CategoryId =
  | 'atencion-sostenida'
  | 'control-inhibitorio'
  | 'memoria-de-trabajo'
  | 'flexibilidad'
  | 'atencion-selectiva';

/** Canal y tipo de tarea. Sirve para repartir el catálogo y para los retos por modalidad. */
export type Modality = 'simbolos' | 'formas' | 'espacial' | 'auditiva' | 'reaccion';

/** Punto en un cuadrado de 0 a 100. */
export type Point = readonly [number, number];

export type ShapeName =
  'circulo' | 'cuadrado' | 'triangulo' | 'estrella' | 'rombo' | 'cruz' | 'flecha' | 'hexagono';

/** Polígono libre dibujado dentro de un cuadrado de 0 a 100. */
export interface Polygon {
  points: readonly Point[];
}

export type FigureSize = 'pequena' | 'mediana' | 'grande';

/**
 * Figura dibujada con SVG. Forma, relleno, giro y reflejo son independientes del color,
 * así que ninguna pista depende de distinguir colores.
 */
export interface FigureVisual {
  kind: 'figura';
  form: ShapeName | Polygon;
  /** Giro en grados, en el sentido de las agujas del reloj. */
  rotation: number;
  /** Refleja la figura de izquierda a derecha, antes de girarla. */
  mirror: boolean;
  filled: boolean;
  size: FigureSize;
  /** Dibuja la línea de simetría vertical. */
  axis: boolean;
}

/** Cuadrícula cuadrada: columns × columns casillas. */
export interface GridVisual {
  kind: 'cuadricula';
  columns: number;
  /** Índices de las casillas iluminadas. */
  lit: readonly number[];
  /** Figura de cada casilla (null = vacía). Si falta, todas las casillas están vacías. */
  cells?: readonly (FigureVisual | null)[];
}

/** Varios dibujos en fila, para comparar o para mostrar una serie. */
export interface SetVisual {
  kind: 'conjunto';
  items: readonly Visual[];
}

/** Hueco de la serie que el usuario debe adivinar. */
export interface UnknownVisual {
  kind: 'incognita';
}

export interface DotVisual {
  /** Posición al empezar (0 a 100). */
  from: Point;
  /** Posición al final del movimiento. */
  to: Point;
  /** Punto que hay que seguir: se ilumina al principio. */
  lit: boolean;
  /** Letra que identifica el punto al responder. */
  letter?: string;
}

/**
 * Puntos que se iluminan y después se mueven. Sin litMs ni moveMs, los puntos se muestran
 * en la posición final, quietos.
 */
export interface DotsVisual {
  kind: 'puntos';
  dots: readonly DotVisual[];
  litMs?: number;
  moveMs?: number;
}

export interface Tone {
  hz: number;
  ms: number;
}

/** Serie de tonos. Se reproduce con un botón; sin audio se muestra como barras que se iluminan. */
export interface TonesVisual {
  kind: 'tonos';
  tones: readonly Tone[];
  gapMs: number;
}

export type Visual =
  FigureVisual | GridVisual | SetVisual | UnknownVisual | DotsVisual | TonesVisual;

/**
 * Ensayo "tocar o no tocar": el usuario decide si responde a un estímulo que se muestra
 * durante un tiempo fijo. Sirve para vigilancia, semáforo, el eco de letras y los juegos de reacción.
 */
export interface TapTrial {
  mode: 'tap';
  shape: 'letter' | 'circle' | 'square';
  /** Contenido del estímulo cuando es una letra. */
  display: string;
  /** Descripción accesible del estímulo para lectores de pantalla. */
  displayLabel: string;
  /** Instrucción breve que se muestra encima del estímulo. */
  prompt: string;
  /** ¿Debe responder el usuario en este ensayo? */
  target: boolean;
  /** Los ensayos de calentamiento no puntúan. */
  scorable: boolean;
  showMs: number;
  isiMs: number;
  /**
   * Espera antes de mostrar el estímulo, en ms. Durante la espera tocar cuenta como
   * respuesta anticipada (error). Sin valor, el estímulo aparece de inmediato.
   */
  waitMs?: number;
}

export interface ChoiceOption {
  id: string;
  label: string;
  /** Nombre accesible si la etiqueta visible no basta (p. ej. una casilla sin texto). */
  ariaLabel?: string;
  /** Dibujo de la opción. Si existe, se muestra en lugar de la etiqueta. */
  visual?: Visual;
}

/** Vista previa que se muestra sin opciones antes del ensayo, p. ej. una casilla iluminada. */
export interface TrialPreview {
  visual: Visual;
  ms: number;
  /** Descripción accesible de la vista previa. */
  label: string;
}

/**
 * Ensayo de elección: el usuario elige una opción. Sirve para Stroop, cambio de regla,
 * búsqueda visual, memoria espacial, comparaciones de figuras y tonos.
 */
export interface ChoiceTrial {
  mode: 'choice';
  display: string;
  displayLabel: string;
  /** Id del color de la tinta (solo en Stroop). La interfaz lo traduce a un color del tema. */
  displayColor?: string;
  prompt: string;
  options: readonly ChoiceOption[];
  answerId: string;
  layout: 'row' | 'grid';
  columns?: number;
  /** Dibujo del enunciado, que se muestra encima de las opciones. */
  visual?: Visual;
  /** Vista previa que se muestra antes de las opciones; el reloj de respuesta empieza después. */
  preview?: TrialPreview;
  /** Tiempo máximo para responder. Sin valor = sin límite (modo sin prisa). */
  limitMs?: number;
  scorable: boolean;
  isiMs: number;
}

export type Trial = TapTrial | ChoiceTrial;

export type Response =
  | { kind: 'tap'; tapped: boolean; rtMs: number | null; anticipated?: boolean }
  | { kind: 'choice'; chosenId: string | null; rtMs: number | null };

export interface GameSpec {
  id: GameId;
  category: CategoryId;
  modality: Modality;
  name: string;
  /** Una frase que explica el juego sin prometer beneficios médicos. */
  tagline: string;
  instructions: readonly string[];
  /** Ensayos por partida. */
  trialCount: number;
  /** Duración típica de cada ensayo en ms, para estimar la duración de la sesión. */
  typicalTrialMs: number;
  /** Disponible en el plan gratuito. */
  free: boolean;
  /** Depende de distinguir colores; se sustituye en el modo "sin color". */
  requiresColor: boolean;
  build(rng: Rng, level: number, calm: boolean): Trial[];
}

/**
 * Evalúa una respuesta frente a su ensayo. Es el único punto donde se puntúa.
 * Lanza error si el tipo de respuesta no coincide con el del ensayo.
 */
export function evaluateResponse(trial: Trial, response: Response): TrialOutcome {
  if (trial.mode === 'tap' && response.kind === 'tap') {
    // Tocar durante la espera nunca es correcto, sea cual sea el estímulo que venga después.
    if (response.anticipated) {
      return { correct: false, rtMs: null, scorable: trial.scorable };
    }
    return {
      correct: response.tapped === trial.target,
      rtMs: response.tapped ? response.rtMs : null,
      scorable: trial.scorable,
    };
  }
  if (trial.mode === 'choice' && response.kind === 'choice') {
    return {
      correct: response.chosenId === trial.answerId,
      rtMs: response.chosenId === null ? null : response.rtMs,
      scorable: trial.scorable,
    };
  }
  throw new TypeError('La respuesta no corresponde al tipo de ensayo');
}
