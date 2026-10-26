import { START_LEVEL, clampLevel } from './adaptive';
import { diffDays, type DateKey } from './dates';
import type { Entitlement } from './billing';
import { GAMES } from './games/registry';
import type { CategoryId, GameSpec } from './games/types';
import type { GameId, SessionStep } from './model';
import { createRng } from './rng';

export const BREATH_SECONDS = 30;
export const GAME_INTRO_SECONDS = 5;
export const REFLECTION_SECONDS = 30;
export const LESSON_SECONDS = 30;
export const GAMES_PER_SESSION = 3;

export interface PlanInput {
  dateKey: DateKey;
  levels: Partial<Record<string, number>>;
  lastPlayed: Partial<Record<string, DateKey>>;
  entitlement: Entitlement;
  sinColor: boolean;
  /** Lección que todavía no se ha leído, en orden de preferencia. */
  unreadLessonIds: readonly string[];
}

/** Juegos disponibles según el plan y la preferencia de color. */
export function eligibleGames(entitlement: Entitlement, sinColor: boolean): GameSpec[] {
  return GAMES.filter(
    (game) => (entitlement === 'premium' || game.free) && !(sinColor && game.requiresColor),
  );
}

/**
 * Plan de la sesión diaria de 5 minutos: respiración, tres juegos de categorías distintas,
 * reflexión y, si hay, una micro-lección. Prioriza los juegos que llevan más días sin jugarse.
 * Es determinista para cada día: el mismo día y el mismo historial dan el mismo plan.
 */
export function buildDailySession(input: PlanInput): SessionStep[] {
  const pool = eligibleGames(input.entitlement, input.sinColor);
  const rng = createRng(`${input.dateKey}|foco5`);

  const ranked = pool
    .map((game) => {
      const last = input.lastPlayed[game.id];
      // Un juego que nunca se ha jugado tiene prioridad absoluta.
      const daysSince = last ? diffDays(input.dateKey, last) : Number.MAX_SAFE_INTEGER;
      return { game, daysSince, tiebreak: rng.next() };
    })
    .sort((a, b) => b.daysSince - a.daysSince || a.tiebreak - b.tiebreak);

  const picked: GameSpec[] = [];
  const usedCategories = new Set<CategoryId>();
  for (const { game } of ranked) {
    if (picked.length >= GAMES_PER_SESSION) break;
    if (usedCategories.has(game.category)) continue;
    picked.push(game);
    usedCategories.add(game.category);
  }
  // Si no hay suficientes categorías distintas, completa con el resto del orden.
  for (const { game } of ranked) {
    if (picked.length >= GAMES_PER_SESSION) break;
    if (!picked.includes(game)) picked.push(game);
  }

  const steps: SessionStep[] = [{ kind: 'breath', seconds: BREATH_SECONDS }];
  for (const game of picked) {
    steps.push({
      kind: 'game',
      gameId: game.id,
      level: clampLevel(input.levels[game.id] ?? START_LEVEL),
    });
  }
  steps.push({ kind: 'reflection' });
  const lessonId = input.unreadLessonIds[0];
  if (lessonId) {
    steps.push({ kind: 'lesson', lessonId });
  }
  return steps;
}

/** Duración estimada de un plan, en segundos. El modo sin prisa tarda alrededor de un 30 % más. */
export function estimateSessionSeconds(steps: readonly SessionStep[], calm: boolean): number {
  let total = 0;
  for (const step of steps) {
    if (step.kind === 'breath') {
      total += step.seconds;
    } else if (step.kind === 'reflection') {
      total += REFLECTION_SECONDS;
    } else if (step.kind === 'lesson') {
      total += LESSON_SECONDS;
    } else {
      const game = GAMES.find((candidate) => candidate.id === step.gameId);
      if (game) {
        const perTrialMs = game.typicalTrialMs * (calm ? 1.3 : 1);
        total += GAME_INTRO_SECONDS + (game.trialCount * perTrialMs) / 1000;
      }
    }
  }
  return Math.round(total);
}

/** Identificadores de juegos del plan, en el orden en que aparecen. */
export function gameIdsOf(steps: readonly SessionStep[]): GameId[] {
  return steps.flatMap((step) => (step.kind === 'game' ? [step.gameId] : []));
}
