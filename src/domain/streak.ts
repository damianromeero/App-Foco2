import { addDays, diffDays, type DateKey } from './dates';

/** Un día de descanso cada 7 días: un día sin entrenar no rompe la racha si ya descansaste esa semana. */
export const REST_INTERVAL_DAYS = 7;

export interface StreakInfo {
  /** Días seguidos con sesión completa. Los días de descanso no suman, pero no rompen la racha. */
  current: number;
  best: number;
  /** Días sin sesión que quedaron protegidos por el descanso. */
  protectedDays: DateKey[];
  /** Hay un día de descanso disponible ahora mismo. */
  restAvailable: boolean;
}

/**
 * Calcula la racha con una simulación día a día desde la primera sesión.
 * Hoy no cuenta como fallo mientras no termine: aún se puede completar.
 */
export function computeStreak(todayKey: DateKey, completedKeys: ReadonlySet<DateKey>): StreakInfo {
  if (completedKeys.size === 0) {
    return { current: 0, best: 0, protectedDays: [], restAvailable: true };
  }

  let earliest = todayKey;
  for (const key of completedKeys) {
    if (key < earliest) earliest = key;
  }

  let run = 0;
  let best = 0;
  let lastRest: DateKey | null = null;
  const protectedDays: DateKey[] = [];

  for (let day = earliest; day <= todayKey; day = addDays(day, 1)) {
    if (completedKeys.has(day)) {
      run += 1;
      best = Math.max(best, run);
      continue;
    }
    if (day === todayKey) break;

    const restFree = lastRest === null || diffDays(day, lastRest) >= REST_INTERVAL_DAYS;
    if (restFree) {
      lastRest = day;
      protectedDays.push(day);
    } else {
      run = 0;
    }
  }

  return {
    current: run,
    best,
    protectedDays,
    restAvailable: lastRest === null || diffDays(todayKey, lastRest) >= REST_INTERVAL_DAYS,
  };
}
