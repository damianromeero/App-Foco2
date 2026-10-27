import { addDays, diffDays, weekStartKey, type DateKey } from './dates';

/**
 * Racha semanal: cuenta semanas, no días. Una semana (de lunes a domingo) queda cumplida con sesiones completas en
 * al menos WEEKLY_GOAL_DAYS días distintos, los que a la persona le vengan bien. Faltar un día, o varios, no rompe
 * nada mientras la semana llegue a la meta. La semana en curso nunca rompe la racha: aún se puede completar.
 */
export const WEEKLY_GOAL_DAYS = 3;

export interface StreakInfo {
  /** Semanas seguidas cumplidas. Incluye la semana en curso solo si ya está cumplida. */
  current: number;
  best: number;
  /** Días distintos con sesión completa en la semana en curso. */
  weekDays: number;
  /** La semana en curso ya llegó a la meta. */
  weekGoalMet: boolean;
  /** Días que quedan en la semana en curso, hoy incluido. */
  daysLeftInWeek: number;
}

/** Calcula la racha semanal con las semanas desde la primera sesión hasta la semana de hoy. */
export function computeStreak(todayKey: DateKey, completedKeys: ReadonlySet<DateKey>): StreakInfo {
  const currentWeek = weekStartKey(todayKey);
  const daysLeftInWeek = 7 - diffDays(todayKey, currentWeek);

  const daysPerWeek = new Map<DateKey, number>();
  for (const key of completedKeys) {
    if (key > todayKey) continue;
    const week = weekStartKey(key);
    daysPerWeek.set(week, (daysPerWeek.get(week) ?? 0) + 1);
  }

  const weekDays = daysPerWeek.get(currentWeek) ?? 0;
  const weekGoalMet = weekDays >= WEEKLY_GOAL_DAYS;
  if (daysPerWeek.size === 0) {
    return { current: 0, best: 0, weekDays, weekGoalMet, daysLeftInWeek };
  }

  let earliest = currentWeek;
  for (const week of daysPerWeek.keys()) {
    if (week < earliest) earliest = week;
  }

  let run = 0;
  let best = 0;
  for (let week = earliest; week <= currentWeek; week = addDays(week, 7)) {
    if ((daysPerWeek.get(week) ?? 0) >= WEEKLY_GOAL_DAYS) {
      run += 1;
      best = Math.max(best, run);
    } else if (week !== currentWeek) {
      run = 0;
    }
  }

  return { current: run, best, weekDays, weekGoalMet, daysLeftInWeek };
}
