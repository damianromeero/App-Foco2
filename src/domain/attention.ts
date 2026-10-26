import { addDays, type DateKey } from './dates';
import type { BaselineRecord, FocusRecord, GameId, Reflection, SessionRecord } from './model';
import { roundTo } from './math';

export interface DayActivity {
  dateKey: DateKey;
  completed: boolean;
  minutes: number;
}

/** Actividad de cada uno de los últimos `days` días, con el más reciente al final. */
export function weeklyActivity(
  sessions: readonly SessionRecord[],
  todayKey: DateKey,
  days = 7,
): DayActivity[] {
  const byDay = new Map<DateKey, SessionRecord>();
  for (const session of sessions) {
    byDay.set(session.dateKey, session);
  }
  return Array.from({ length: days }, (_, index) => {
    const dateKey = addDays(todayKey, index - (days - 1));
    const session = byDay.get(dateKey);
    return {
      dateKey,
      completed: session !== undefined,
      minutes: session ? roundTo(session.durationSec / 60, 1) : 0,
    };
  });
}

function byCompletion<T extends { completedAt: string }>(a: T, b: T): number {
  return Date.parse(a.completedAt) - Date.parse(b.completedAt);
}

export interface AccuracyPoint {
  dateKey: DateKey;
  accuracy: number;
  level: number;
}

/** Precisión de un juego a lo largo del tiempo (las últimas `limit` partidas). */
export function accuracyTrend(
  sessions: readonly SessionRecord[],
  gameId: GameId,
  limit = 20,
): AccuracyPoint[] {
  const points: (AccuracyPoint & { completedAt: string })[] = sessions.flatMap((session) =>
    session.games
      .filter((game) => game.gameId === gameId)
      .map((game) => ({
        dateKey: session.dateKey,
        accuracy: game.accuracy,
        level: game.level,
        completedAt: game.completedAt,
      })),
  );
  return points
    .sort(byCompletion)
    .slice(-limit)
    .map(({ dateKey, accuracy, level }) => ({ dateKey, accuracy, level }));
}

export interface BaselineDelta {
  gameId: GameId;
  baselineAccuracy: number;
  baselineLevel: number;
  recentAccuracy: number | null;
  recentLevel: number | null;
  /** Diferencia en puntos porcentuales entre la precisión base y la reciente. */
  deltaPoints: number | null;
}

/**
 * Compara el test base con las tres últimas partidas de cada juego.
 * Ojo: el nivel puede haber cambiado, así que el informe muestra también el nivel.
 */
export function baselineComparison(
  baseline: BaselineRecord | null,
  sessions: readonly SessionRecord[],
): BaselineDelta[] {
  if (!baseline) return [];
  const allResults = sessions.flatMap((session) => session.games);
  return baseline.results.map((base) => {
    const recent = allResults
      .filter((game) => game.gameId === base.gameId)
      .sort((a, b) => byCompletion(b, a))
      .slice(0, 3);
    if (recent.length === 0) {
      return {
        gameId: base.gameId,
        baselineAccuracy: base.accuracy,
        baselineLevel: base.level,
        recentAccuracy: null,
        recentLevel: null,
        deltaPoints: null,
      };
    }
    const recentAccuracy = roundTo(
      recent.reduce((sum, game) => sum + game.accuracy, 0) / recent.length,
      4,
    );
    return {
      gameId: base.gameId,
      baselineAccuracy: base.accuracy,
      baselineLevel: base.level,
      recentAccuracy,
      recentLevel: recent[0]?.level ?? null,
      deltaPoints: Math.round((recentAccuracy - base.accuracy) * 100),
    };
  });
}

export interface Totals {
  sessions: number;
  minutes: number;
  games: number;
}

export function totals(sessions: readonly SessionRecord[]): Totals {
  const seconds = sessions.reduce((sum, session) => sum + session.durationSec, 0);
  return {
    sessions: sessions.length,
    minutes: Math.round(seconds / 60),
    games: sessions.reduce((sum, session) => sum + session.games.length, 0),
  };
}

/** Cuántas personas, según su propia respuesta, usaron el móvil en cada tramo horario. */
export function phoneUseCounts(
  sessions: readonly SessionRecord[],
): Record<Reflection['phoneUse'], number> {
  const counts: Record<Reflection['phoneUse'], number> = {
    'menos-30': 0,
    '30-60': 0,
    'mas-60': 0,
    'no-se': 0,
  };
  for (const session of sessions) {
    if (session.reflection) {
      counts[session.reflection.phoneUse] += 1;
    }
  }
  return counts;
}

export interface FocusTotals {
  sessions: number;
  minutes: number;
  exits: number;
}

export function focusTotals(focusSessions: readonly FocusRecord[]): FocusTotals {
  return {
    sessions: focusSessions.length,
    minutes: Math.round(focusSessions.reduce((sum, focus) => sum + focus.focusedSeconds, 0) / 60),
    exits: focusSessions.reduce((sum, focus) => sum + focus.exits, 0),
  };
}
