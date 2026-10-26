import { useEffect } from 'react';
import { LESSONS } from '../content/lessons';
import { sessionStepSchema } from '../domain/model';
import { buildDailySession, eligibleGames, gameIdsOf } from '../domain/plan';
import { useAppStore } from '../store/appStore';
import type { SessionStep } from '../domain/model';
import { useEntitlement } from './useBillingView';

/**
 * Plan de la sesión de hoy. Si todavía no existe, o ya no es válido (por ejemplo, tras activar
 * el modo sin colores), se genera aquí mismo. Así cualquier pantalla que lo necesite lo obtiene.
 * Devuelve null cuando la sesión de hoy ya está hecha o aún no hay plan.
 */
export function useDailyPlan(todayKey: string): SessionStep[] | null {
  const entitlement = useEntitlement();
  const dailyPlan = useAppStore((state) => state.dailyPlan);
  const sessions = useAppStore((state) => state.sessions);
  const settings = useAppStore((state) => state.settings);
  const levels = useAppStore((state) => state.levels);
  const lastPlayed = useAppStore((state) => state.lastPlayed);
  const lessonsRead = useAppStore((state) => state.lessonsRead);
  const setDailyPlan = useAppStore((state) => state.setDailyPlan);

  const sessionToday = sessions.some((session) => session.dateKey === todayKey);
  const eligibleIds = new Set(eligibleGames(entitlement, settings.sinColor).map((game) => game.id));
  const valid =
    dailyPlan !== null &&
    dailyPlan.dateKey === todayKey &&
    gameIdsOf(dailyPlan.steps).every((id) => eligibleIds.has(id));

  useEffect(() => {
    if (sessionToday || valid) return;
    const unreadLessonIds = LESSONS.filter(
      (lesson) => (entitlement === 'premium' || lesson.free) && !lessonsRead.includes(lesson.id),
    ).map((lesson) => lesson.id);
    const steps = buildDailySession({
      dateKey: todayKey,
      levels,
      lastPlayed,
      entitlement,
      sinColor: settings.sinColor,
      unreadLessonIds,
    });
    // Validamos antes de guardar: un plan mal formado no debe llegar al almacenamiento.
    const checked = steps.every((step) => sessionStepSchema.safeParse(step).success);
    if (checked) {
      setDailyPlan({ dateKey: todayKey, steps });
    }
  }, [
    sessionToday,
    valid,
    todayKey,
    entitlement,
    lessonsRead,
    levels,
    lastPlayed,
    settings.sinColor,
    setDailyPlan,
  ]);

  return valid ? dailyPlan.steps : null;
}
