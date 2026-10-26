/** Días seguidos que merecen un aviso discreto. Se muestra una vez, cuando la racha llega exactamente a esa cifra. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

/** Devuelve el hito alcanzado si la racha actual es exactamente un hito; si no, null. */
export function streakMilestone(current: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(current) ? current : null;
}
