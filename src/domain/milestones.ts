/** Semanas seguidas que merecen un aviso discreto. Se muestra mientras la racha vale exactamente esa cifra. */
export const STREAK_MILESTONES = [2, 4, 8, 12, 26, 52] as const;

/** Devuelve el hito alcanzado si la racha actual es exactamente un hito; si no, null. */
export function streakMilestone(current: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(current) ? current : null;
}
