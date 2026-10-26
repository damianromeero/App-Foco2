import { addDays, diffDays, type DateKey } from './dates';
import type { Entitlement } from './billing';
import { getGame } from './games/registry';
import type { CategoryId, Modality } from './games/types';
import type { FocusRecord, GameId, SessionRecord } from './model';
import { hashSeed } from './rng';

export type ChallengeMetric =
  | 'sesiones'
  | 'precision'
  | 'juegos-distintos'
  | 'minutos-foco'
  | 'categorias-distintas'
  | 'modalidades-distintas'
  | 'dias-seguidos';

export interface ChallengeDef {
  id: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  premium: boolean;
  /** Solo cuentan las sesiones con un juego de esta categoría (métricas de sesiones). */
  category?: CategoryId;
  /** Solo cuentan los juegos de esta modalidad (métricas de precisión). */
  modality?: Modality;
}

/**
 * Retos semanales. Todos se miden con datos que la app registra; ninguno pide rendir más de lo sano.
 * Un reto es premium solo si no se puede cumplir con los juegos gratuitos.
 */
export const CHALLENGES: readonly ChallengeDef[] = [
  {
    id: 'semana-constante',
    title: 'Semana constante',
    description: 'Completa 4 sesiones esta semana. No importa qué días: lo que cuenta es volver.',
    metric: 'sesiones',
    target: 4,
    premium: false,
  },
  {
    id: 'precision-cuidada',
    title: 'Precisión cuidada',
    description: 'Mantén una precisión media de 80 % en tus juegos esta semana.',
    metric: 'precision',
    target: 0.8,
    premium: false,
  },
  {
    id: 'todo-el-menu',
    title: 'Variedad',
    description: 'Entrena 4 juegos distintos esta semana.',
    metric: 'juegos-distintos',
    target: 4,
    premium: false,
  },
  {
    id: 'minutos-de-foco',
    title: 'Minutos de foco',
    description:
      'Suma 30 minutos en el modo foco. Si sales de la pestaña, lo anotamos sin juzgarte.',
    metric: 'minutos-foco',
    target: 30,
    premium: true,
  },
  {
    id: 'tres-modalidades',
    title: 'Tres formas de mirar',
    description:
      'Entrena 3 tipos de juego distintos esta semana, por ejemplo formas, espacio y reacción.',
    metric: 'modalidades-distintas',
    target: 3,
    premium: false,
  },
  {
    id: 'cuatro-areas',
    title: 'Cuatro áreas',
    description: 'Practica juegos de 4 de las 5 áreas de atención esta semana.',
    metric: 'categorias-distintas',
    target: 4,
    premium: false,
  },
  {
    id: 'racha-de-tres',
    title: 'Tres días seguidos',
    description: 'Completa una sesión tres días seguidos esta semana.',
    metric: 'dias-seguidos',
    target: 3,
    premium: false,
  },
  {
    id: 'mirada-espacial',
    title: 'Mirada espacial',
    description: 'Mantén una precisión media de 80 % en los juegos de espacio.',
    metric: 'precision',
    target: 0.8,
    modality: 'espacial',
    premium: false,
  },
  {
    id: 'oido-fino',
    title: 'Oído fino',
    description: 'Mantén una precisión media de 75 % en los juegos de sonido.',
    metric: 'precision',
    target: 0.75,
    modality: 'auditiva',
    premium: true,
  },
  {
    id: 'atencion-en-marcha',
    title: 'Atención en marcha',
    description: 'Juega 3 sesiones con algún juego de atención sostenida.',
    metric: 'sesiones',
    target: 3,
    category: 'atencion-sostenida',
    premium: false,
  },
];

/** Categoría y modalidad de un juego del catálogo. */
function gameInfo(gameId: GameId) {
  return getGame(gameId);
}

/** Días consecutivos más largos entre las claves dadas (sin repetir días). */
function longestRun(dateKeys: readonly DateKey[]): number {
  const days = [...new Set(dateKeys)].sort();
  let best = 0;
  let run = 0;
  let previous: DateKey | null = null;
  for (const day of days) {
    run = previous !== null && diffDays(day, previous) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

/** Reto de la semana: el mismo para todo el mundo durante siete días, elegido por semilla. */
export function challengeForWeek(weekStart: DateKey, entitlement: Entitlement): ChallengeDef {
  const pool = CHALLENGES.filter((challenge) => entitlement === 'premium' || !challenge.premium);
  const challenge = pool[hashSeed(weekStart) % pool.length];
  if (!challenge) {
    throw new RangeError('No hay retos disponibles');
  }
  return challenge;
}

/** Sesiones de la semana que empieza en `weekStart` (siete días). */
export function sessionsInWeek(
  sessions: readonly SessionRecord[],
  weekStart: DateKey,
): SessionRecord[] {
  const weekEnd = addDays(weekStart, 6);
  return sessions.filter((session) => session.dateKey >= weekStart && session.dateKey <= weekEnd);
}

export interface ChallengeProgress {
  value: number;
  target: number;
  ratio: number;
  done: boolean;
}

export function challengeProgress(
  challenge: ChallengeDef,
  weekSessions: readonly SessionRecord[],
  weekFocus: readonly FocusRecord[],
): ChallengeProgress {
  const inScope = (gameId: GameId): boolean => {
    const info = gameInfo(gameId);
    return (
      (challenge.category === undefined || info.category === challenge.category) &&
      (challenge.modality === undefined || info.modality === challenge.modality)
    );
  };
  const games = weekSessions.flatMap((session) => session.games);
  let value = 0;
  switch (challenge.metric) {
    case 'sesiones':
      value =
        challenge.category === undefined
          ? weekSessions.length
          : weekSessions.filter((session) =>
              session.games.some((game) => gameInfo(game.gameId).category === challenge.category),
            ).length;
      break;
    case 'precision': {
      const scoped = games.filter((game) => inScope(game.gameId));
      value =
        scoped.length === 0
          ? 0
          : scoped.reduce((sum, game) => sum + game.accuracy, 0) / scoped.length;
      break;
    }
    case 'juegos-distintos':
      value = new Set(games.map((game) => game.gameId)).size;
      break;
    case 'minutos-foco':
      value = Math.floor(weekFocus.reduce((sum, focus) => sum + focus.focusedSeconds, 0) / 60);
      break;
    case 'categorias-distintas':
      value = new Set(games.map((game) => gameInfo(game.gameId).category)).size;
      break;
    case 'modalidades-distintas':
      value = new Set(games.map((game) => gameInfo(game.gameId).modality)).size;
      break;
    case 'dias-seguidos':
      value = longestRun(weekSessions.map((session) => session.dateKey));
      break;
  }
  const ratio = Math.min(1, value / challenge.target);
  return { value, target: challenge.target, ratio, done: value >= challenge.target };
}
