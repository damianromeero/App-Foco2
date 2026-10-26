import { challengeForWeek, challengeProgress, sessionsInWeek } from '../domain/challenges';
import { toDateKey, weekStartKey } from '../domain/dates';
import { nextAction, nextPresentation, type NextAction } from '../domain/next';
import { LESSONS } from '../content/lessons';
import { useAppStore } from '../store/appStore';
import { useBillingView } from './useBillingView';
import { useNow } from './useNow';

/** Lo que toca a continuación, calculado con los mismos datos en Hoy y en el botón central. */
export function useNextAction(): { action: NextAction; label: string; detail: string; to: string } {
  const now = useNow();
  const todayKey = toDateKey(now);
  const sessions = useAppStore((state) => state.sessions);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const lessonsRead = useAppStore((state) => state.lessonsRead);
  const billing = useBillingView();
  const entitlement = billing.entitlement;

  const weekStart = weekStartKey(todayKey);
  const challenge = challengeForWeek(weekStart, entitlement);
  const weekSessions = sessionsInWeek(sessions, weekStart);
  const weekFocus = focusSessions.filter(
    (focus) => focus.dateKey >= weekStart && focus.dateKey <= todayKey,
  );
  const progress = challengeProgress(challenge, weekSessions, weekFocus);

  const action = nextAction({
    sessionDone: sessions.some((session) => session.dateKey === todayKey),
    challenge: { id: challenge.id, title: challenge.title, done: progress.done },
    lessons: LESSONS,
    lessonsRead,
    premium: entitlement === 'premium',
  });
  return { action, ...nextPresentation(action) };
}
