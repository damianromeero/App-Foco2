import { addDays, type DateKey } from './dates';
import type { FocusRecord, SessionRecord } from './model';

/** Nivel de actividad de un día, de 0 (nada) a 4 (un día muy completo). */
export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityDay {
  dateKey: DateKey;
  /** Juegos completados ese día más bloques de modo foco. */
  count: number;
  level: ActivityLevel;
}

/** Traduce un número de actividades a un nivel. Una sesión completa (tres juegos) ya es nivel 2. */
export function levelFor(count: number): ActivityLevel {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * Mapa de actividad de las últimas `days` jornadas, del más antiguo al más reciente.
 * Cuenta juegos completados y bloques de foco; no tiene en cuenta la hora ni el contenido.
 */
export function activityGrid(
  sessions: readonly SessionRecord[],
  focusSessions: readonly FocusRecord[],
  todayKey: DateKey,
  days = 35,
): ActivityDay[] {
  const counts = new Map<DateKey, number>();
  for (const session of sessions) {
    counts.set(session.dateKey, (counts.get(session.dateKey) ?? 0) + session.games.length);
  }
  for (const focus of focusSessions) {
    counts.set(focus.dateKey, (counts.get(focus.dateKey) ?? 0) + 1);
  }

  const grid: ActivityDay[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const dateKey = addDays(todayKey, -offset);
    const count = counts.get(dateKey) ?? 0;
    grid.push({ dateKey, count, level: levelFor(count) });
  }
  return grid;
}
