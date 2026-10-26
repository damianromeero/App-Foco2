import type { SessionRecord } from './model';

/**
 * Fusiona las sesiones locales con las de la nube. Una sesión por día: si hay dos versiones del mismo día,
 * gana la completada más tarde. Así ningún dispositivo pisa un entrenamiento más reciente.
 */
export function mergeSessionRecords(
  local: readonly SessionRecord[],
  remote: readonly SessionRecord[],
): SessionRecord[] {
  const byDay = new Map<string, SessionRecord>();
  for (const session of [...local, ...remote]) {
    const current = byDay.get(session.dateKey);
    if (!current || Date.parse(session.completedAt) > Date.parse(current.completedAt)) {
      byDay.set(session.dateKey, session);
    }
  }
  return [...byDay.values()].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}

/** Sesiones que la nube no tiene, o tiene con una versión más antigua. */
export function sessionsToPush(
  merged: readonly SessionRecord[],
  remote: readonly SessionRecord[],
): SessionRecord[] {
  const remoteByDay = new Map(remote.map((session) => [session.dateKey, session]));
  return merged.filter((session) => {
    const existing = remoteByDay.get(session.dateKey);
    return !existing || Date.parse(session.completedAt) > Date.parse(existing.completedAt);
  });
}
