import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useBlocker, useNavigate } from 'react-router';
import { GameIntro, GameResult } from '../../components/game/GameParts';
import { GameRunner } from '../../components/game/GameRunner';
import { Breath, ReflectionStep } from '../../components/session/SessionSteps';
import { LessonStep } from '../../components/session/LessonStep';
import { LinkButton, Button } from '../../components/ui/Button';
import { PhaseSwitch } from '../../components/ui/motion';
import { Dialog } from '../../components/ui/Dialog';
import { Card, Notice } from '../../components/ui/Surfaces';
import { lessonById } from '../../content/lessons';
import { toDateKey } from '../../domain/dates';
import { getGame } from '../../domain/games/registry';
import type { TrialOutcome } from '../../domain/scoring';
import { summarize, type Summary } from '../../domain/scoring';
import type { GameResultRecord, Reflection, SessionStep } from '../../domain/model';
import { createRng } from '../../domain/rng';
import { useDailyPlan } from '../../hooks/useDailyPlan';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useNow } from '../../hooks/useNow';
import { registrarEvento } from '../../services/medicion';
import { useAppStore } from '../../store/appStore';

type GamePhase = 'intro' | 'running' | 'summary';

/** Pantalla de la sesión en la que alguien sale, con el nombre de la lista de la medición (src/config/medicion.ts). */
const PANTALLA_DE_PASO = {
  breath: 'respiracion',
  game: 'juego',
  reflection: 'reflexion',
  lesson: 'leccion',
} as const satisfies Record<SessionStep['kind'], string>;

export default function Session() {
  useDocumentMeta({
    title: 'Sesión de hoy',
    description: 'Tu sesión de hoy: respiración, juegos breves y una reflexión final.',
  });
  const navigate = useNavigate();
  const todayKey = toDateKey(useNow());
  const sessions = useAppStore((state) => state.sessions);
  const settings = useAppStore((state) => state.settings);
  const recordSession = useAppStore((state) => state.recordSession);
  const markLessonRead = useAppStore((state) => state.markLessonRead);

  const [startedAt] = useState(() => Date.now());
  const [stepIndex, setStepIndex] = useState(0);
  const [gamePhase, setGamePhase] = useState<GamePhase>('intro');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<GameResultRecord[]>([]);
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [exitOpen, setExitOpen] = useState(false);

  const alreadyDone = sessions.some((session) => session.dateKey === todayKey);
  const steps = useDailyPlan(todayKey);
  const total = steps?.length ?? 0;
  const step = steps?.[stepIndex];

  // Volver atrás durante la sesión pide confirmación: lo que llevas no se guarda.
  const leaving = useRef(false);
  const inProgress = step !== undefined && !alreadyDone;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      inProgress && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  // Medición anónima (apagada por defecto): la sesión empezó, una sola vez por visita.
  const startCounted = useRef(false);
  useEffect(() => {
    if (!inProgress || startCounted.current) return;
    startCounted.current = true;
    registrarEvento('sesion_iniciada');
  }, [inProgress]);
  const closeExit = () => {
    setExitOpen(false);
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  };
  const confirmExit = () => {
    if (step) registrarEvento('sesion_abandonada', PANTALLA_DE_PASO[step.kind]);
    leaving.current = true;
    setExitOpen(false);
    if (blocker.state === 'blocked') {
      blocker.proceed();
    } else {
      void navigate('/hoy');
    }
  };

  const trials = useMemo(() => {
    if (step?.kind !== 'game') return [];
    return getGame(step.gameId).build(
      createRng(`${todayKey}|paso-${stepIndex}`),
      step.level,
      settings.calmMode,
    );
  }, [step, stepIndex, todayKey, settings.calmMode]);

  const advance = useCallback(() => {
    setStepIndex((index) => index + 1);
    setGamePhase('intro');
    setSummary(null);
  }, []);

  const finish = (finalReflection: Reflection | null, finalResults: GameResultRecord[]) => {
    recordSession({
      dateKey: todayKey,
      completedAt: new Date().toISOString(),
      durationSec: Math.round((Date.now() - startedAt) / 1000),
      games: finalResults,
      reflection: finalReflection,
    });
    registrarEvento('sesion_completada');
    leaving.current = true;
    void navigate('/resultado', { replace: true });
  };

  const handleGameFinish = useCallback(
    (outcomes: TrialOutcome[]) => {
      if (step?.kind !== 'game') return;
      const result = summarize(outcomes);
      registrarEvento('juego_terminado', step.gameId);
      setSummary(result);
      setResults((previous) => [
        ...previous,
        {
          gameId: step.gameId,
          level: step.level,
          accuracy: result.accuracy,
          medianRtMs: result.medianRtMs,
          scorable: result.scorable,
          correct: result.correct,
          calm: settings.calmMode,
          completedAt: new Date().toISOString(),
        },
      ]);
      setGamePhase('summary');
    },
    [step, settings.calmMode],
  );

  if (alreadyDone) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-[2.6rem] leading-[1] sm:text-6xl">
          Hoy ya has <span className="pixel-accent">entrenado</span>
        </h1>
        <Notice title="Tu sesión de hoy está completa.">
          Mañana tendrás una nueva. Mientras tanto, puedes practicar cualquier juego en la
          biblioteca.
        </Notice>
        <div className="flex flex-wrap gap-3">
          <LinkButton to="/resultado" variant="secondary">
            Ver resultado
          </LinkButton>
          <LinkButton to="/biblioteca" variant="ghost">
            Ir a la biblioteca
          </LinkButton>
        </div>
      </div>
    );
  }

  if (!steps || !step) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-[2.6rem] leading-[1]">Sesión de hoy</h1>
        <Notice title="Tu sesión todavía no está preparada.">
          Pasa por Hoy para prepararla. Solo tarda un segundo.
        </Notice>
        <LinkButton to="/hoy">Ir a Hoy</LinkButton>
      </div>
    );
  }

  const progress = stepIndex / total;
  // Cada fase (introducción, ensayos, resumen, reflexión, lección) tiene su propia clave para animar el cambio.
  const phaseKey = step.kind === 'game' ? `${stepIndex}-${gamePhase}` : `${stepIndex}-${step.kind}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="sr-only">Sesión de hoy</h1>

      <header className="flex items-center gap-4 pb-10">
        <div className="min-w-0 flex-1">
          <div
            role="progressbar"
            aria-label="Progreso de la sesión"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="flex gap-1.5"
          >
            {Array.from({ length: total }, (_, index) => (
              <span
                key={index}
                className={`h-1.5 flex-1 rounded-full transition-[background,box-shadow] duration-700 ${index <= stepIndex ? 'fill-brand shadow-[0_0_12px_-2px_var(--c-brand)]' : 'bg-surface-2'}`}
              />
            ))}
          </div>
          <p className="mt-3 font-mono text-xs text-ink-soft tabular-nums">
            Paso {stepIndex + 1} de {total}
          </p>
        </div>
        <button
          type="button"
          aria-label="Salir de la sesión"
          onClick={() => {
            setExitOpen(true);
          }}
          className="glass ring-gradient pressable flex size-11 shrink-0 items-center justify-center rounded-full text-ink"
        >
          <XIcon size={18} weight="bold" aria-hidden="true" />
        </button>
      </header>

      <PhaseSwitch phaseKey={phaseKey}>
        {step.kind === 'breath' && (
          <div className="space-y-4">
            <h2 className="text-center text-[2.1rem] leading-[1.02]">
              Respira <span className="pixel-accent">antes de empezar</span>
            </h2>
            <Breath seconds={step.seconds} onDone={advance} />
          </div>
        )}

        {step.kind === 'game' && gamePhase === 'intro' && (
          <GameIntro
            game={getGame(step.gameId)}
            seconds={
              ((trials.length * getGame(step.gameId).typicalTrialMs) / 1000) *
              (settings.calmMode ? 1.3 : 1)
            }
            calm={settings.calmMode}
            onStart={() => {
              setGamePhase('running');
            }}
          />
        )}

        {step.kind === 'game' && gamePhase === 'running' && (
          <GameRunner
            key={stepIndex}
            game={getGame(step.gameId)}
            trials={trials}
            feedback
            haptics={settings.haptics}
            onFinish={handleGameFinish}
          />
        )}

        {step.kind === 'game' && gamePhase === 'summary' && summary && (
          <GameResult
            game={getGame(step.gameId)}
            level={step.level}
            summary={summary}
            calm={settings.calmMode}
            onContinue={advance}
          />
        )}

        {step.kind === 'reflection' && (
          <ReflectionStep
            onDone={(value) => {
              setReflection(value);
              if (stepIndex + 1 >= total) {
                finish(value, results);
              } else {
                advance();
              }
            }}
          />
        )}

        {step.kind === 'lesson' && lessonById(step.lessonId) && (
          <LessonStep
            lesson={
              lessonById(step.lessonId) ?? {
                id: '',
                title: '',
                summary: '',
                minutes: 1,
                free: true,
                paragraphs: [],
                refs: [],
              }
            }
            onDone={() => {
              markLessonRead(step.lessonId);
              finish(reflection, results);
            }}
          />
        )}

        {step.kind === 'lesson' && !lessonById(step.lessonId) && (
          <Card>
            <p>Esta lección ya no está disponible.</p>
            <Button
              className="mt-4"
              onClick={() => {
                finish(reflection, results);
              }}
            >
              Terminar
            </Button>
          </Card>
        )}
      </PhaseSwitch>

      <Dialog
        open={exitOpen || blocker.state === 'blocked'}
        onClose={closeExit}
        title="¿Salir de la sesión?"
      >
        <p className="text-ink-soft">
          Lo que llevas de esta sesión no se guarda. Puedes empezarla de nuevo cuando quieras, sin
          prisa.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={closeExit}>
            Seguir entrenando
          </Button>
          <Button variant="ghost" onClick={confirmExit}>
            Salir
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
