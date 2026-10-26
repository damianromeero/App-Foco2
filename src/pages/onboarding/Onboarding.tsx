import {
  ArrowRightIcon,
  ArrowsLeftRightIcon,
  BookOpenIcon,
  BrainIcon,
  CheckIcon,
  CheckCircleIcon,
  ClockIcon,
  DeviceMobileSlashIcon,
  LightningIcon,
  SlidersHorizontalIcon,
  TargetIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { GameIntro, GameResult } from '../../components/game/GameParts';
import { GameRunner } from '../../components/game/GameRunner';
import { Logo } from '../../components/brand/Logo';
import { Button, LinkButton } from '../../components/ui/Button';
import { Switch } from '../../components/ui/Controls';
import { PhaseSwitch } from '../../components/ui/motion';
import { Card } from '../../components/ui/Surfaces';
import { plantilla } from '../../config/plantilla';
import { COPY, GOALS } from '../../content/copy';
import { startLevelFromBaseline } from '../../domain/adaptive';
import { toDateKey } from '../../domain/dates';
import { TRIAL_DAYS } from '../../domain/pricing';
import { getGame } from '../../domain/games/registry';
import type { GameId, GameResultRecord, Goal, Settings } from '../../domain/model';
import { summarize, type Summary, type TrialOutcome } from '../../domain/scoring';
import { createRng } from '../../domain/rng';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useNow } from '../../hooks/useNow';
import { useAppStore } from '../../store/appStore';
import { requestPersistentStorage } from '../../data/persistence';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';

/** Test base: tres juegos sin color, siempre al mismo nivel, para poder compararlo después. */
const BASELINE_GAMES: GameId[] = ['vigilancia', 'semaforo', 'secuencia'];
const BASELINE_LEVEL = 3;
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 } as const;
const REMEMBER = [
  COPY.localMode,
  'Un día de descanso cada semana protege tu racha.',
  'Lo que medimos es tu rendimiento en la app. No prometemos más.',
];
/** La sesión diaria tal como la vive la persona: lo mismo que muestra «Cómo funciona» en la portada. */
const SESSION_PLAN = COPY.howItWorks.map((item) => item.title).join(' · ');
/** Tres pasos del test base, en el orden en que los vive la persona. */
const BASELINE_STEPS = [
  'Tres juegos cortos, unos tres minutos en total.',
  'Todos empiezan al mismo nivel, así la comparación es justa.',
  'Es tu referencia: verás tu progreso contigo, no contra otras personas.',
];
/** Un icono por objetivo: cada opción se reconoce antes de leerla. */
const GOAL_ICONS: Record<Goal, PhosphorIcon> = {
  concentrarme: TargetIcon,
  'menos-movil': DeviceMobileSlashIcon,
  estudiar: BookOpenIcon,
  'trabajar-mejor': ArrowsLeftRightIcon,
  'mente-activa': LightningIcon,
};

type Step = 'objetivo' | 'ajustes' | 'base' | 'listo';
type BaselinePhase = 'intro' | 'running' | 'summary';

/**
 * Segunda etapa del embudo: portada (/) → onboarding (/onboarding) → paywall (/paywall).
 * Quien ya empezó no repite el inicio: cualquier entrada a /onboarding (portada, precios, login)
 * lo lleva a Hoy con sus datos. El test base sigue disponible con ?modo=base.
 * Se decide una sola vez, al entrar, para que el propio flujo no se corte al terminar.
 */
export default function Onboarding() {
  const [returning] = useState(() => useAppStore.getState().onboardedAt !== null);
  const [params] = useSearchParams();
  if (returning && params.get('modo') !== 'base') {
    return <Navigate to="/hoy" replace />;
  }
  return <OnboardingFlow />;
}

function OnboardingFlow() {
  useDocumentMeta({
    title: 'Empezar',
    description: 'Cuatro pasos para elegir tus juegos y preparar tu primera sesión.',
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Quien llega desde la app (la guarda de Hoy lo trae aquí) ya está dentro: al terminar vuelve a donde iba, sin paywall.
  const from: unknown = (location.state as { from?: unknown } | null)?.from;
  const returnTo = typeof from === 'string' && from.startsWith('/') ? from : null;
  const retest = params.get('modo') === 'base';
  const todayKey = toDateKey(useNow());
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const saveBaseline = useAppStore((state) => state.saveBaseline);
  const setDisplayName = useAppStore((state) => state.setDisplayName);
  const settings = useAppStore((state) => state.settings);
  const displayName = useAppStore((state) => state.displayName);
  const onboardedAt = useAppStore((state) => state.onboardedAt);
  const nameHelpId = useId();

  const [step, setStep] = useState<Step>(retest ? 'base' : 'objetivo');
  const [goal, setGoal] = useState<Goal>('concentrarme');
  const [name, setName] = useState(displayName ?? '');
  const [draft, setDraft] = useState<Pick<Settings, 'calmMode' | 'sinColor'>>({
    calmMode: settings.calmMode,
    sinColor: settings.sinColor,
  });

  const [baselineIndex, setBaselineIndex] = useState(0);
  const [baselinePhase, setBaselinePhase] = useState<BaselinePhase>('intro');
  const [baselineResults, setBaselineResults] = useState<GameResultRecord[]>([]);
  const [lastSummary, setLastSummary] = useState<Summary | null>(null);
  const [testStarted, setTestStarted] = useState(false);
  const [skipped, setSkipped] = useState(false);

  // Medición anónima (apagada por defecto): en qué paso del inicio está. El re-test del progreso no cuenta.
  useEffect(() => {
    if (!retest) registrarEvento('onboarding_paso', step);
  }, [retest, step]);

  const gameId = BASELINE_GAMES[baselineIndex];
  const game = gameId ? getGame(gameId) : null;
  const trials = gameId
    ? getGame(gameId).build(
        createRng(`base|${baselineIndex}|${todayKey}`),
        BASELINE_LEVEL,
        draft.calmMode,
      )
    : [];

  const finishBaseline = useCallback(
    (results: GameResultRecord[]) => {
      const startLevels: Record<string, number> = {};
      for (const result of results) {
        startLevels[result.gameId] = startLevelFromBaseline(result.accuracy);
      }
      saveBaseline({ completedAt: new Date().toISOString(), results, startLevels });
      setStep('listo');
    },
    [saveBaseline],
  );

  const handleGameFinish = useCallback(
    (outcomes: TrialOutcome[]) => {
      if (!gameId) return;
      const summary = summarize(outcomes);
      const result: GameResultRecord = {
        gameId,
        level: BASELINE_LEVEL,
        accuracy: summary.accuracy,
        medianRtMs: summary.medianRtMs,
        scorable: summary.scorable,
        correct: summary.correct,
        calm: draft.calmMode,
        completedAt: new Date().toISOString(),
      };
      setLastSummary(summary);
      setBaselineResults((previous) => {
        const next = [...previous, result];
        return next;
      });
      setBaselinePhase('summary');
    },
    [gameId, draft.calmMode],
  );

  const nextBaselineGame = () => {
    const allResults = [...baselineResults];
    if (baselineIndex + 1 >= BASELINE_GAMES.length) {
      finishBaseline(allResults);
      return;
    }
    setBaselineIndex((index) => index + 1);
    setBaselinePhase('intro');
    setLastSummary(null);
  };

  const finishOnboarding = () => {
    setDisplayName(name);
    completeOnboarding({
      goal,
      reminderTime: null,
      settings: draft,
    });
    requestPersistentStorage();
    registrarEvento('onboarding_completado');
    void navigate(returnTo ?? '/paywall', { replace: true });
  };
  const goalLabel = GOALS.find((item) => item.value === goal)?.label ?? '';
  const trimmedName = name.trim();
  const planRows: { icon: PhosphorIcon; label: string; value: string }[] = [
    { icon: GOAL_ICONS[goal], label: 'Tu objetivo', value: goalLabel },
    {
      icon: ClockIcon,
      label: `Cada día, ${plantilla.minutosSesion} minutos`,
      value: SESSION_PLAN,
    },
    {
      icon: SlidersHorizontalIcon,
      label: 'Tus ajustes',
      value:
        [draft.calmMode ? 'Sin prisa' : null, draft.sinColor ? 'Sin colores' : null]
          .filter(Boolean)
          .join(' · ') || 'Los de siempre',
    },
    {
      icon: BrainIcon,
      label: 'Tu punto de partida',
      value: skipped ? 'Pendiente: lo haces cuando quieras' : 'Guardado para comparar',
    },
  ];

  const stepNumber = { objetivo: 1, ajustes: 2, base: 3, listo: 4 }[step];

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-5 pb-3 sm:px-6">
        <Logo />
        {!retest && (
          <p className="eyebrow glass ring-1 ring-inset ring-line rounded-full px-3 py-1.5">
            Paso {stepNumber} de 4
          </p>
        )}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-2xl px-4 pb-16 sm:px-6">
        <h1 className="sr-only">{retest ? 'Repetir el test base' : 'Empezar con Foco Mente'}</h1>
        {!retest && (
          <div className="mt-2">
            <StepProgress current={stepNumber} total={4} />
          </div>
        )}

        {/* Cada paso entra con su propio movimiento. Sin salida animada: no quedan dos pantallas a la vez. */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          {step === 'objetivo' && (
            <section className="mt-10 space-y-8">
              <div className="space-y-4">
                <IconBadge icon={TargetIcon} />
                <div className="space-y-2">
                  <h2 className="text-3xl">
                    ¿Para qué quieres entrenar tu <span className="pixel-accent">atención</span>?
                  </h2>
                  <p className="text-ink-soft">
                    Elige uno. Lo verás en tu plan para recordar por qué empezaste.
                  </p>
                </div>
              </div>
              <GoalTiles value={goal} onChange={setGoal} />
              <Button
                size="lg"
                className="w-full"
                onClick={() => {
                  setStep('ajustes');
                }}
              >
                Siguiente
                <ArrowRightIcon weight="bold" aria-hidden="true" />
              </Button>
            </section>
          )}

          {step === 'ajustes' && (
            <section className="mt-10 space-y-8">
              <div className="space-y-4">
                <IconBadge icon={SlidersHorizontalIcon} />
                <div className="space-y-2">
                  <h2 className="text-3xl">
                    Ajustemos la <span className="pixel-accent">experiencia</span> a ti
                  </h2>
                  <p className="text-ink-soft">
                    Dos preguntas rápidas. Todo se puede cambiar en Ajustes.
                  </p>
                </div>
              </div>
              <Card>
                <div className="divide-y divide-line">
                  <div className="space-y-2 py-4">
                    <label className="flex flex-col gap-3 text-sm font-semibold">
                      ¿Cómo te llamas? (opcional)
                      <input
                        type="text"
                        value={name}
                        maxLength={40}
                        autoComplete="given-name"
                        aria-describedby={nameHelpId}
                        onChange={(event) => {
                          // Los espacios iniciales no cuentan para el límite: se quitan al escribir.
                          setName(event.target.value.replace(/^\s+/, ''));
                        }}
                        className="min-h-14 w-full rounded-2xl bg-surface-2/60 px-4 text-base font-normal text-ink ring-1 ring-inset ring-ink/15 transition-shadow focus:ring-2 focus:ring-brand"
                      />
                    </label>
                    <p id={nameHelpId} className="text-base text-ink-soft">
                      Solo lo usamos para saludarte en tu pantalla de inicio.
                    </p>
                  </div>
                  <Switch
                    checked={draft.calmMode}
                    onChange={(next) => {
                      setDraft((current) => ({ ...current, calmMode: next }));
                    }}
                    label="Modo sin prisa"
                    description="Sin límite de tiempo en los juegos. La sesión dura algo más."
                  />
                  <Switch
                    checked={draft.sinColor}
                    onChange={(next) => {
                      setDraft((current) => ({ ...current, sinColor: next }));
                    }}
                    label="Modo sin colores"
                    description="Sustituimos los juegos que dependen del color por otros con formas y texto."
                  />
                </div>
              </Card>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep('objetivo');
                  }}
                >
                  Atrás
                </Button>
                <Button
                  size="lg"
                  onClick={() => {
                    setStep('base');
                  }}
                >
                  Siguiente
                </Button>
              </div>
            </section>
          )}

          {step === 'base' && (
            <section className="mt-10 space-y-8">
              {!testStarted && (
                <>
                  <Card>
                    <div className="space-y-5">
                      <IconBadge icon={BrainIcon} />
                      <div className="space-y-3">
                        <h2 className="text-3xl">
                          Tu punto de <span className="pixel-accent">partida</span>
                        </h2>
                        <ol className="space-y-4">
                          {BASELINE_STEPS.map((text, index) => (
                            <li key={text} className="flex items-start gap-4 text-ink-soft">
                              <span
                                aria-hidden="true"
                                className="fill-aurora flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-brand-ink"
                              >
                                {index + 1}
                              </span>
                              <span className="pt-0.5">{text}</span>
                            </li>
                          ))}
                        </ol>
                        <p className="font-semibold">
                          No hay nada que aprobar. Aquí solo medimos cómo rindes hoy.
                        </p>
                      </div>
                    </div>
                  </Card>
                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (retest) {
                          void navigate('/progreso');
                        } else {
                          setSkipped(true);
                          setStep('listo');
                        }
                      }}
                    >
                      {retest ? 'Volver al progreso' : 'Lo hago después'}
                    </Button>
                    <Button
                      size="lg"
                      onClick={() => {
                        setTestStarted(true);
                      }}
                    >
                      Empezar el test
                    </Button>
                  </div>
                </>
              )}

              <PhaseSwitch phaseKey={`${baselineIndex}-${baselinePhase}`}>
                {testStarted && game && baselinePhase === 'intro' && (
                  <GameIntro
                    game={game}
                    seconds={(trials.length * game.typicalTrialMs) / 1000}
                    calm={draft.calmMode}
                    onStart={() => {
                      setBaselinePhase('running');
                    }}
                  />
                )}

                {game && baselinePhase === 'running' && (
                  <GameRunner
                    key={baselineIndex}
                    game={game}
                    trials={trials}
                    feedback={false}
                    haptics={false}
                    onFinish={handleGameFinish}
                  />
                )}

                {game && baselinePhase === 'summary' && lastSummary && (
                  <GameResult
                    game={game}
                    level={BASELINE_LEVEL}
                    summary={lastSummary}
                    calm={draft.calmMode}
                    onContinue={nextBaselineGame}
                    continueLabel={
                      baselineIndex + 1 < BASELINE_GAMES.length
                        ? 'Siguiente juego'
                        : 'Ver mi punto de partida'
                    }
                  />
                )}
              </PhaseSwitch>
            </section>
          )}

          {step === 'listo' && (
            <section className="mt-10 space-y-8">
              <div className="space-y-4 text-center">
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING}
                  className="glass ring-gradient mx-auto flex size-20 items-center justify-center rounded-full"
                >
                  <CheckCircleIcon
                    weight="duotone"
                    aria-hidden="true"
                    className="icon-aurora size-10"
                  />
                </motion.span>
                <h2 className="text-3xl">
                  {retest ? (
                    'Listo. Tu punto de partida está guardado.'
                  ) : (
                    <>
                      {trimmedName ? `${trimmedName}, tu ` : 'Tu '}
                      <span className="pixel-accent">plan</span> está listo.
                    </>
                  )}
                </h2>
                <p className="text-lg text-ink-soft">
                  {retest
                    ? 'Verás la comparación en tu progreso.'
                    : 'Así queda con lo que nos contaste. Puedes empezar hoy o cuando te venga bien.'}
                </p>
              </div>
              {!retest && (
                <Card labelledBy="tu-plan" className="text-left">
                  <h3 id="tu-plan" className="eyebrow text-brand">
                    Tu plan de entrenamiento
                  </h3>
                  <ul className="mt-4 divide-y divide-line">
                    {planRows.map((row) => (
                      <li key={row.label} className="flex items-center gap-4 py-3.5">
                        <span
                          aria-hidden="true"
                          className="glass ring-1 ring-inset ring-line flex size-11 shrink-0 items-center justify-center rounded-xl"
                        >
                          <row.icon weight="duotone" className="icon-aurora size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink-soft">
                            {row.label}
                          </span>
                          <span className="block font-semibold text-ink">{row.value}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <Card className="text-left">
                <p className="font-semibold">Recuerda</p>
                <ul className="mt-4 space-y-3 text-ink-soft">
                  {REMEMBER.map((item) => (
                    <li key={item} className="flex gap-3">
                      <CheckIcon
                        weight="bold"
                        aria-hidden="true"
                        className="mt-1 size-4 shrink-0 text-brand"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
              <Button
                size="lg"
                className="w-full"
                onClick={
                  retest
                    ? () => {
                        void navigate('/progreso');
                      }
                    : finishOnboarding
                }
              >
                {retest
                  ? 'Volver al progreso'
                  : returnTo
                    ? 'Ir a Hoy'
                    : `Ver planes y prueba de ${TRIAL_DAYS} días`}
                {!retest && <ArrowRightIcon weight="bold" aria-hidden="true" />}
              </Button>
              {onboardedAt === null && (
                <p className="text-center text-base text-ink-soft">
                  Al continuar aceptas las{' '}
                  <Link className="underline" to="/legal/terminos">
                    condiciones de uso
                  </Link>{' '}
                  y la{' '}
                  <Link className="underline" to="/legal/privacidad">
                    política de privacidad
                  </Link>
                  .
                </p>
              )}
            </section>
          )}
        </motion.div>

        {/* Sin nube no hay compras con las que entrar: el enlace solo aparece cuando sirve. */}
        {step !== 'listo' && !retest && isCloudEnabled() && (
          <p className="mt-10 text-base text-ink-soft">
            ¿Ya compraste?{' '}
            <LinkButton to="/entrar" variant="ghost" size="md" className="px-1 py-0">
              Entra con tu correo
            </LinkButton>
          </p>
        )}
        <p className="sr-only">{plantilla.eslogan}</p>
      </main>
    </div>
  );
}

/** Progreso del inicio: cuatro segmentos con degradado que se llenan al avanzar. */
function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-label="Progreso del inicio"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={`Paso ${current} de ${total}`}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className="relative h-1.5 overflow-hidden rounded-full bg-glass ring-1 ring-inset ring-line"
        >
          <motion.span
            className="fill-aurora absolute inset-0 origin-left rounded-full"
            initial={false}
            animate={{ scaleX: index < current ? 1 : 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          />
        </span>
      ))}
    </div>
  );
}

/** Icono grande de cada paso, en una pastilla de cristal con el degradado de marca. */
function IconBadge({ icon: Icon }: { icon: PhosphorIcon }) {
  return (
    <span className="glass ring-gradient flex size-14 items-center justify-center rounded-2xl">
      <Icon weight="duotone" aria-hidden="true" className="icon-aurora size-7" />
    </span>
  );
}

/** Objetivo principal en tarjetas grandes. La elegida lleva borde de degradado y check de marca. */
function GoalTiles({ value, onChange }: { value: Goal; onChange: (next: Goal) => void }) {
  const name = useId();
  return (
    <fieldset className="space-y-3">
      <legend className="mb-4 font-semibold">Tu objetivo principal</legend>
      {GOALS.map((item) => {
        const selected = item.value === value;
        const GoalIcon = GOAL_ICONS[item.value];
        return (
          <label
            key={item.value}
            className={`pressable relative flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus sm:p-5 ${selected ? 'glass ring-gradient' : 'ring-1 ring-inset ring-line hover:bg-glass'}`}
          >
            <input
              type="radio"
              name={name}
              value={item.value}
              checked={selected}
              onChange={() => {
                onChange(item.value);
              }}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className="glass ring-1 ring-inset ring-line flex size-11 shrink-0 items-center justify-center rounded-xl"
            >
              <GoalIcon weight="duotone" className="icon-aurora size-5" />
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block font-semibold text-ink">{item.label}</span>
              <span className="block text-base text-ink-soft">{item.description}</span>
            </span>
            <span
              aria-hidden="true"
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${selected ? 'fill-brand ring-brand' : 'ring-ink/15'}`}
            >
              <motion.span
                initial={false}
                animate={{ scale: selected ? 1 : 0 }}
                transition={SPRING}
                className="flex"
              >
                <CheckIcon weight="bold" className="size-4 text-brand-ink" />
              </motion.span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
