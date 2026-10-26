import { useEffect, useRef, useState } from 'react';
import { LinkButton, Button } from '../../components/ui/Button';
import { CountUp } from '../../components/ui/CountUp';
import { Badge, ProgressBar } from '../../components/ui/Surfaces';
import { useToast } from '../../components/ui/Toast';
import { COPY } from '../../content/copy';
import { weeklyActivity } from '../../domain/attention';
import { sessionsInWeek } from '../../domain/challenges';
import { toDateKey, weekStartKey } from '../../domain/dates';
import { getGame } from '../../domain/games/registry';
import { computeStreak } from '../../domain/streak';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useNow } from '../../hooks/useNow';
import { buzz } from '../../lib/haptics';
import { downloadBlob } from '../../lib/download';
import { plural } from '../../lib/format';
import { renderShareCard } from '../../lib/shareCard';

const REFLECTION_LABEL = {
  calmado: 'Más tranquilo que al empezar.',
  igual: 'Igual que al empezar.',
  disperso: 'Más disperso que al empezar.',
} as const;

/** Cierre a pantalla completa: la precisión manda, y las acciones flotan al alcance del pulgar. */
export default function Result() {
  useDocumentMeta({
    title: 'Resultado',
    description: 'Resultado de tu sesión de hoy.',
  });
  const todayKey = toDateKey(useNow());
  const sessions = useAppStore((state) => state.sessions);
  const toast = useToast();
  const [sharing, setSharing] = useState(false);

  const session = sessions.find((item) => item.dateKey === todayKey) ?? null;
  const haptics = useAppStore((state) => state.settings.haptics);
  const celebrated = useRef(false);
  // Un solo aviso táctil al llegar al cierre, si la persona tiene la vibración activada.
  useEffect(() => {
    if (!session || celebrated.current) return;
    celebrated.current = true;
    if (haptics) buzz([18, 60, 40]);
  }, [session, haptics]);

  if (!session) {
    return (
      <div className="animate-fade-up mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-6 px-5 py-12">
        <Badge tone="brand" dot>
          Resultado
        </Badge>
        <h1 className="text-[2.6rem] leading-[1]">
          Todavía no hay <span className="pixel-accent">resultado.</span>
        </h1>
        <p className="text-ink-soft">Completa tu sesión de hoy y lo verás aquí.</p>
        <LinkButton to="/sesion" size="lg" className="w-full">
          Ir a la sesión
        </LinkButton>
      </div>
    );
  }

  const weekStart = weekStartKey(todayKey);
  const thisWeek = sessionsInWeek(sessions, weekStart);
  const weekGames = thisWeek.flatMap((item) => item.games);
  const weekAccuracy =
    weekGames.length === 0
      ? null
      : weekGames.reduce((sum, game) => sum + game.accuracy, 0) / weekGames.length;
  const sessionAccuracy =
    session.games.length === 0
      ? 0
      : session.games.reduce((sum, game) => sum + game.accuracy, 0) / session.games.length;
  const streak = computeStreak(todayKey, new Set(sessions.map((item) => item.dateKey)));
  const week = weeklyActivity(sessions, todayKey);
  const minutes = Math.max(1, Math.round(session.durationSec / 60));
  const reflectionLine = session.reflection
    ? REFLECTION_LABEL[session.reflection.mood]
    : 'Buen trabajo por volver.';

  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderShareCard({
        streak: streak.current,
        days: week.map((day) => ({
          label: day.dateKey.slice(-2),
          completed: day.completed,
        })),
        sessionsThisWeek: thisWeek.length,
        accuracy: weekAccuracy,
      });
      const file = new File([blob], 'mi-semana-foco-mente.png', { type: 'image/png' });
      const nav: Partial<Navigator> = navigator;
      if (nav.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Mi semana en 5 minutos',
          text: COPY.hero.lead,
        });
      } else {
        downloadBlob('mi-semana-foco-mente.png', blob);
        toast.show('Imagen descargada.');
      }
    } catch (error) {
      // Si la persona cancela el menú de compartir, no es un error.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.show(COPY.errorGeneric);
    } finally {
      setSharing(false);
    }
  };

  const sessionPercent = Math.round(sessionAccuracy * 100);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(9rem+env(safe-area-inset-bottom))]">
      <header className="animate-fade-up pt-8">
        <Badge tone="brand" dot>
          Sesión completada
        </Badge>
        <p className="figure text-aurora mt-8 text-[8.5rem] sm:text-[10rem]">
          <CountUp value={sessionPercent} />
          <span className="ml-2 align-top font-sans text-3xl font-semibold text-ink-soft">%</span>
        </p>
        <p className="mt-3 font-mono text-xs text-ink-soft">Precisión media de hoy</p>
        <h1 className="mt-8 text-[2.3rem] leading-[1.04]">
          Has entrenado{' '}
          <span className="pixel-accent">unos {plural(minutes, 'minuto', 'minutos')}</span>.
        </h1>
        <p className="mt-3 text-ink-soft">{reflectionLine}</p>
      </header>

      <section
        aria-labelledby="juegos-hoy"
        className="animate-fade-up mt-12 space-y-4"
        style={{ animationDelay: '120ms' }}
      >
        <h2 id="juegos-hoy" className="eyebrow">
          Tus juegos
        </h2>
        <ul className="glass ring-gradient divide-y divide-line rounded-card px-5">
          {session.games.map((game, index) => (
            <li key={`${game.gameId}-${index}`} className="flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-medium">{getGame(game.gameId).name}</p>
                  <p className="font-mono text-[0.7rem] text-ink-soft tabular-nums">
                    Nivel {game.level}
                    {game.medianRtMs !== null ? ` · ${game.medianRtMs} ms` : ''}
                  </p>
                </div>
                <ProgressBar
                  value={game.accuracy}
                  label={`Precisión en ${getGame(game.gameId).name}`}
                />
              </div>
              <p className="figure w-12 text-right text-2xl tabular-nums">
                {Math.round(game.accuracy * 100)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-label="Tu semana"
        className="animate-fade-up mt-6 grid grid-cols-2 gap-3"
        style={{ animationDelay: '200ms' }}
      >
        <div className="glass ring-gradient rounded-2xl p-5">
          <p className="figure text-[2.6rem]">
            <CountUp value={streak.current} />
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            {streak.current === 1 ? 'día seguido' : 'días seguidos'}
          </p>
        </div>
        <div className="glass ring-gradient rounded-2xl p-5">
          <p className="figure text-[2.6rem]">
            <CountUp value={thisWeek.length} />
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            {thisWeek.length === 1 ? 'sesión esta semana' : 'sesiones esta semana'}
          </p>
        </div>
      </section>

      <p className="mt-8 px-1 text-sm leading-relaxed text-ink-soft">
        Si quieres, comparte tu semana: una imagen con tus días y tu racha. No incluye juegos ni
        respuestas.
      </p>

      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-30 w-[min(36rem,calc(100%-1.5rem))] -translate-x-1/2">
        <div className="glass-dock ring-gradient flex gap-2 rounded-dock p-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1 bg-surface-2!"
            disabled={sharing}
            onClick={() => {
              void share();
            }}
          >
            {sharing ? 'Preparando…' : 'Compartir'}
          </Button>
          <LinkButton to="/hoy" size="lg" className="flex-[1.4]">
            Volver a Hoy
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
