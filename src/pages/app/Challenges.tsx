import {
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CrownIcon,
  TargetIcon,
} from '@phosphor-icons/react';
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';
import {
  CHALLENGES,
  challengeForWeek,
  challengeProgress,
  sessionsInWeek,
} from '../../domain/challenges';
import { toDateKey, weekStartKey } from '../../domain/dates';
import { HABITS_PER_DAY, habitsForDay } from '../../domain/habits';
import { Badge, Card, PageHeader, ProgressBar } from '../../components/ui/Surfaces';
import { LinkButton } from '../../components/ui/Button';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';
import { useNow } from '../../hooks/useNow';
import { formatPercent, plural } from '../../lib/format';

function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <div className="animate-fade-up" style={style}>
      {children}
    </div>
  );
}

export default function Challenges() {
  useDocumentMeta({
    title: 'Retos',
    description: 'Retos de una semana y hábitos pequeños para volver al foco.',
  });
  const todayKey = toDateKey(useNow());
  const entitlement = useEntitlement();
  const sessions = useAppStore((state) => state.sessions);
  const focusSessions = useAppStore((state) => state.focusSessions);

  const weekStart = weekStartKey(todayKey);
  const weekSessions = sessionsInWeek(sessions, weekStart);
  const weekFocus = focusSessions.filter(
    (focus) => focus.dateKey >= weekStart && focus.dateKey <= todayKey,
  );
  const current = challengeForWeek(weekStart, entitlement);
  const state = challengeProgress(current, weekSessions, weekFocus);

  const valueText = (metric: string, value: number, target: number) => {
    if (metric === 'precision') return `${formatPercent(value)} de ${formatPercent(target)}`;
    if (metric === 'minutos-foco') return `${value} de ${target} min`;
    return `${value} de ${target}`;
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="pixel-accent">Retos</span>}
        lead="Metas de una semana. Si una no sale, la siguiente empieza sin deuda."
      />

      <Enter delay={120}>
        <Card variant="hero" labelledBy="reto-actual">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="eyebrow">Esta semana</p>
                <h2 id="reto-actual" className="text-3xl leading-[1.05]">
                  {current.title}
                </h2>
              </div>
              {current.premium && <Badge tone="premium">Premium</Badge>}
            </div>
            <p className="text-ink-soft">{current.description}</p>
            <ProgressBar
              value={state.ratio}
              label={`Progreso del reto ${current.title}`}
              tone={current.premium ? 'premium' : 'brand'}
            />
            <p className="flex items-center gap-2 text-lg font-semibold tabular-nums">
              {state.done && (
                <CheckCircleIcon
                  size={22}
                  weight="fill"
                  className="icon-aurora"
                  aria-hidden="true"
                />
              )}
              {state.done
                ? 'Reto cumplido. Bien hecho.'
                : valueText(current.metric, state.value, current.target)}
            </p>
            <p className="text-base text-ink-soft">
              Sesiones esta semana: {plural(weekSessions.length, 'sesión', 'sesiones')}.
            </p>
          </div>
        </Card>
      </Enter>

      <Enter delay={180}>
        <DailyHabits dateKey={todayKey} />
      </Enter>

      <Enter delay={220}>
        <section aria-labelledby="otros-retos" className="space-y-4">
          <h2 id="otros-retos" className="text-xl">
            Otros retos del catálogo
          </h2>
          <ul className="glass ring-gradient divide-y divide-line overflow-hidden rounded-card">
            {CHALLENGES.filter((challenge) => challenge.id !== current.id).map((challenge) => {
              const locked = challenge.premium && entitlement !== 'premium';
              return (
                <li key={challenge.id} className="flex items-start gap-4 p-5">
                  <span
                    aria-hidden="true"
                    className="grid size-11 shrink-0 place-items-center rounded-2xl bg-glass ring-1 ring-inset ring-line"
                  >
                    {challenge.premium ? (
                      <CrownIcon size={22} weight="duotone" className="icon-gold" />
                    ) : (
                      <TargetIcon size={22} weight="duotone" className="text-ink-soft" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3>{challenge.title}</h3>
                      {locked && <Badge tone="premium">Premium</Badge>}
                    </div>
                    <p className="text-base text-ink-soft">{challenge.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </Enter>

      <Enter delay={240}>
        <nav
          aria-label="Más secciones"
          className="glass ring-gradient divide-y divide-line rounded-card px-5"
        >
          <ExploreRow to="/biblioteca" title="Biblioteca" hint="Practica cualquier juego" />
          <ExploreRow to="/lecciones" title="Lecciones" hint="Un minuto de ciencia, con fuentes" />
          <ExploreRow to="/enfoque" title="Modo foco" hint="Un bloque de trabajo sin pestañas" />
        </nav>
      </Enter>
      <Enter delay={300}>
        <Card labelledBy="como-se-mide">
          <div className="space-y-3">
            <h2 id="como-se-mide" className="text-xl">
              Cómo se mide
            </h2>
            <p className="text-ink-soft">
              Cada reto usa los datos que registra la propia app. El reto de foco cuenta solo el
              tiempo que la pestaña está visible.
            </p>
            <div className="pt-2">
              <LinkButton to="/enfoque" variant="secondary">
                Ir al modo foco
              </LinkButton>
            </div>
          </div>
        </Card>
      </Enter>
    </div>
  );
}

/** Hábitos del día que la persona marca a mano. No cuentan para el reto semanal ni para la racha. */
function DailyHabits({ dateKey }: { dateKey: string }) {
  const habits = habitsForDay(dateKey);
  const checkedIds = useAppStore((state) => state.habitChecks[dateKey]) ?? [];
  const toggleHabit = useAppStore((state) => state.toggleHabit);
  const doneCount = habits.filter((habit) => checkedIds.includes(habit.id)).length;

  return (
    <section aria-labelledby="desafios-hoy" className="space-y-4">
      <div className="space-y-2">
        <h2 id="desafios-hoy" className="text-xl">
          Desafíos de hoy
        </h2>
        <p className="font-semibold tabular-nums">
          Hecho hoy: {doneCount} de {HABITS_PER_DAY}
        </p>
      </div>
      <ul className="glass ring-gradient divide-y divide-line overflow-hidden rounded-card">
        {habits.map((habit) => {
          const checked = checkedIds.includes(habit.id);
          return (
            <li key={habit.id}>
              <label className="pressable flex min-h-11 cursor-pointer items-start gap-4 p-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-focus">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    toggleHabit(dateKey, habit.id);
                  }}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg ring-1 ring-inset transition-colors ${checked ? 'fill-brand text-brand-ink ring-brand' : 'ring-line-strong'}`}
                >
                  {checked && <CheckIcon size={16} weight="bold" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium">{habit.title}</span>
                  <span className="mt-1 block text-base text-ink-soft">{habit.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="text-base text-ink-soft">
        Los marcas tú. No cuentan para el reto semanal ni para la racha.
      </p>
    </section>
  );
}

function ExploreRow({ to, title, hint }: { to: string; title: string; hint: string }) {
  return (
    <Link to={to} className="pressable flex min-h-16 items-center gap-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-base text-ink-soft">{hint}</span>
      </span>
      <CaretRightIcon size={18} className="shrink-0 text-ink-soft" aria-hidden="true" />
    </Link>
  );
}
