import { LinkButton } from '../../components/ui/Button';
import { CountUp } from '../../components/ui/CountUp';
import { Notice } from '../../components/ui/Surfaces';
import { COPY } from '../../content/copy';
import { activityGrid, type ActivityDay } from '../../domain/activity';
import { parseDateKey, toDateKey } from '../../domain/dates';
import { formatUSD } from '../../domain/pricing';
import { streakMilestone } from '../../domain/milestones';
import { computeStreak, WEEKLY_GOAL_DAYS } from '../../domain/streak';
import { useAppStore } from '../../store/appStore';
import { useBillingView } from '../../hooks/useBillingView';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useNextAction } from '../../hooks/useNextAction';
import { useNow } from '../../hooks/useNow';
import { formatFullDate, plural } from '../../lib/format';

/**
 * Pantalla de inicio: bienvenida, racha con su mapa de actividad y un único paso siguiente.
 * Todo lo demás (retos, lecciones, biblioteca, progreso) vive en sus propias secciones.
 */
export default function Today() {
  useDocumentMeta({
    title: 'Hoy',
    description: 'Tu sesión de hoy: respiración, juegos breves y una reflexión final.',
  });
  const now = useNow();
  const todayKey = toDateKey(now);
  const sessions = useAppStore((state) => state.sessions);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const displayName = useAppStore((state) => state.displayName);
  const billing = useBillingView();
  const next = useNextAction();

  const streak = computeStreak(todayKey, new Set(sessions.map((session) => session.dateKey)));
  const grid = activityGrid(sessions, focusSessions, todayKey);
  const milestone = streakMilestone(streak.current);
  const todayDay = grid[grid.length - 1];
  const todayCount = todayDay?.count ?? 0;

  const trialEnding = billing.phase === 'prueba-por-terminar' && billing.nextChargeAt;
  const paymentIssue = billing.phase === 'pago-pendiente';
  const trialDays = billing.trialDaysLeft ?? 0;

  const faltan = WEEKLY_GOAL_DAYS - streak.weekDays;
  const streakMessage = streak.weekGoalMet
    ? `Semana cumplida: ${plural(streak.weekDays, 'día', 'días')} de entrenamiento. Lo que sumes ahora es extra.`
    : streak.current === 0 && streak.weekDays === 0
      ? COPY.streakEmpty
      : faltan <= streak.daysLeftInWeek
        ? `Esta semana llevas ${streak.weekDays} de ${WEEKLY_GOAL_DAYS} días. Te ${streak.daysLeftInWeek === 1 ? 'queda' : 'quedan'} ${plural(streak.daysLeftInWeek, 'día', 'días')} para completarla.`
        : 'Esta semana va más tranquila, y está bien. El lunes empieza otra.';

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-6">
      <header className="animate-fade-up pt-4">
        <h1 className="text-[2.7rem] leading-[1.02] break-words sm:text-6xl">
          {displayName ? (
            <>
              Hola,
              <br />
              <span className="pixel-accent">{displayName}</span>
            </>
          ) : (
            'Hola.'
          )}
        </h1>
      </header>

      {trialEnding && billing.nextChargeCents !== null && (
        <Notice
          tone="premium"
          title={`Tu prueba termina en ${plural(trialDays, 'día', 'días')}.`}
          action={
            <LinkButton to="/cuenta" variant="secondary" size="md">
              Ver mi cuenta
            </LinkButton>
          }
        >
          Te cobraremos {formatUSD(billing.nextChargeCents)} el {formatFullDate(trialEnding)}. Si no
          quieres seguir, cancelas en un clic.
        </Notice>
      )}

      {paymentIssue && (
        <Notice
          tone="accent"
          title="No pudimos cobrar tu última renovación."
          action={
            <LinkButton to="/cuenta" variant="secondary" size="md">
              Revisar pago
            </LinkButton>
          }
        >
          Mantienes el acceso hasta el final del periodo ya pagado.
        </Notice>
      )}

      <section
        aria-labelledby="racha"
        className="glass ring-gradient animate-fade-up rounded-card p-5 sm:p-7"
        style={{ animationDelay: '80ms' }}
      >
        <h2 id="racha" className="eyebrow">
          Racha
        </h2>
        <div className="mt-4 flex items-end gap-4">
          <p className="figure text-[4.5rem] sm:text-[5.5rem]">
            <CountUp value={streak.current} />
          </p>
          <p className="pb-3 text-base text-ink-soft">
            {streak.current === 1 ? 'semana seguida' : 'semanas seguidas'}
          </p>
        </div>
        <WeekGoal done={streak.weekDays} />
        <p className="mt-3 text-base text-ink-soft">{streakMessage}</p>
        {milestone !== null && (
          <p className="mt-2 text-base font-medium text-ink">
            Hito alcanzado: {milestone} semanas seguidas.
          </p>
        )}

        <ActivityMap days={grid} />

        <p className="mt-5 text-base text-ink-soft">
          {todayCount > 0
            ? `Hoy: ${plural(todayCount, 'actividad completada', 'actividades completadas')}.`
            : 'Hoy todavía no entrenas.'}{' '}
          <span className="text-ink-soft/70">
            Mejor racha: {plural(streak.best, 'semana', 'semanas')}.
          </span>
        </p>
      </section>

      <section
        aria-labelledby="siguiente"
        className="animate-fade-up mt-auto space-y-4 pt-6"
        style={{ animationDelay: '160ms' }}
      >
        <h2 id="siguiente" className="eyebrow">
          Siguiente
        </h2>
        <p className="text-lg leading-snug">{next.detail}</p>
        <LinkButton to={next.to} size="lg" className="w-full">
          {next.label}
        </LinkButton>
      </section>
    </div>
  );
}

/** Meta de la semana: una marca por cada día de entrenamiento que pide la racha. */
function WeekGoal({ done }: { done: number }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <ol className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: WEEKLY_GOAL_DAYS }, (_, index) => (
          <li
            key={index}
            className={`h-2.5 w-8 rounded-full ${index < done ? 'fill-brand' : 'bg-ink/[0.12]'}`}
          />
        ))}
      </ol>
      <p className="text-base text-ink-soft">
        <span className="sr-only">Meta de la semana: </span>
        {Math.min(done, WEEKLY_GOAL_DAYS)} de {WEEKLY_GOAL_DAYS} días
      </p>
    </div>
  );
}

/**
 * Mapa de actividad: cinco semanas en columnas, cada día es una celda con su nivel.
 * Cada celda tiene una descripción para lectores de pantalla; el color no es el único dato.
 */
function ActivityMap({ days }: { days: ActivityDay[] }) {
  const formatter = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const cellClass: Record<ActivityDay['level'], string> = {
    0: 'bg-ink/[0.07]',
    1: 'bg-ink/[0.18]',
    2: 'bg-ink/[0.36]',
    3: 'bg-ink/[0.6]',
    4: 'fill-brand',
  };
  const todayKey = days[days.length - 1]?.dateKey;
  return (
    <ol
      aria-label="Actividad de las últimas cinco semanas"
      className="mt-5 grid grid-cols-7 gap-1.5"
    >
      {days.map((day) => {
        const isToday = day.dateKey === todayKey;
        const label = `${formatter.format(parseDateKey(day.dateKey))}: ${plural(day.count, 'actividad', 'actividades')}`;
        return (
          <li
            key={day.dateKey}
            title={label}
            className={`h-6 w-full rounded-[6px] ${cellClass[day.level]} ${isToday ? 'ring-1 ring-ink/80 ring-offset-2 ring-offset-canvas' : ''}`}
          >
            <span className="sr-only">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
