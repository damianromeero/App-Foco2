import { CheckIcon, XIcon } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import {
  evaluateResponse,
  type ChoiceTrial,
  type GameSpec,
  type Response,
  type TapTrial,
  type Trial,
} from '../../domain/games/types';
import type { TrialOutcome } from '../../domain/scoring';
import { buzz } from '../../lib/haptics';
import { markVariants, promptVariants, stimulusVariants } from '../ui/motion';
import { ProgressBar } from '../ui/Surfaces';
import { VisualView } from './GameVisuals';

/**
 * Fases de un ensayo:
 * - pre: espera (tap) o vista previa (elección). Tocar durante la espera es una respuesta anticipada.
 * - show: el estímulo y las opciones. Aquí empieza el reloj y, si hay, el límite de tiempo.
 * - isi: intervalo en blanco. done: no quedan ensayos.
 */
type Stage = 'pre' | 'show' | 'isi' | 'done';

function openingStage(trial: Trial | undefined): Stage {
  if (trial?.mode === 'tap') return trial.waitMs ? 'pre' : 'show';
  if (trial?.mode === 'choice') return trial.preview ? 'pre' : 'show';
  return 'show';
}

function promptFor(stage: Stage, trial: Trial): string {
  if (stage === 'show') return trial.prompt;
  if (stage === 'pre') return trial.mode === 'tap' ? 'Espera la señal' : trial.prompt;
  return ' ';
}

function announcementFor(stage: Stage, trial: Trial): string {
  if (stage === 'pre') {
    return trial.mode === 'tap' ? 'Espera la señal.' : (trial.preview?.label ?? '');
  }
  if (stage === 'show') return trial.displayLabel;
  return '';
}

export interface GameRunnerProps {
  game: GameSpec;
  trials: Trial[];
  /** Muestra ✓ o ✗ tras cada ensayo. El test base lo desactiva para medir sin ayuda. */
  feedback: boolean;
  haptics: boolean;
  onFinish: (outcomes: TrialOutcome[]) => void;
}

/**
 * Motor de ensayos. Cada ensayo puede tener una fase previa (espera o vista previa), un estímulo
 * y un intervalo en blanco.
 * - Un ensayo "tap" se responde tocando durante el estímulo; si no se toca, cuenta como no respuesta.
 *   Tocar durante la espera cuenta como respuesta anticipada.
 * - Un ensayo "choice" se responde eligiendo una opción; si tiene límite y se agota, cuenta como no respuesta.
 * Cada ensayo se registra una sola vez, aunque React ejecute los efectos dos veces en desarrollo.
 */
export function GameRunner({ game, trials, feedback, haptics, onFinish }: GameRunnerProps) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>(() => openingStage(trials[0]));
  const [flash, setFlash] = useState<'ok' | 'fail' | null>(null);
  const outcomes = useRef<TrialOutcome[]>([]);
  const answeredIndex = useRef(-1);
  const startedAt = useRef(0);
  const finished = useRef(false);
  const trial = trials[index];
  const nextStage = openingStage(trials[index + 1]);

  // Antes del estímulo hay una espera o una vista previa. Al empezar el estímulo arranca el reloj
  // y, si el ensayo tiene límite, se programa su final.
  useEffect(() => {
    if (!trial || (stage !== 'pre' && stage !== 'show')) return;
    if (stage === 'pre') {
      const wait = trial.mode === 'tap' ? trial.waitMs : trial.preview?.ms;
      const timer = window.setTimeout(() => {
        setStage('show');
      }, wait ?? 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    startedAt.current = performance.now();
    const limit = trial.mode === 'tap' ? trial.showMs : trial.limitMs;
    if (limit === undefined) return;
    const timer = window.setTimeout(() => {
      if (answeredIndex.current !== index) {
        answeredIndex.current = index;
        const noResponse: Response =
          trial.mode === 'tap'
            ? { kind: 'tap', tapped: false, rtMs: null }
            : { kind: 'choice', chosenId: null, rtMs: null };
        outcomes.current.push(evaluateResponse(trial, noResponse));
      }
      setStage('isi');
    }, limit);
    return () => {
      window.clearTimeout(timer);
    };
  }, [stage, index, trial]);

  // Intervalo en blanco entre ensayos; después pasa al siguiente o termina.
  useEffect(() => {
    if (stage !== 'isi') return;
    const timer = window.setTimeout(() => {
      setFlash(null);
      if (index + 1 >= trials.length) {
        setStage('done');
        return;
      }
      setIndex(index + 1);
      setStage(nextStage);
    }, trial?.isiMs ?? 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [stage, index, trials.length, trial, nextStage]);

  // Lista vacía: no hay nada que mostrar, así que avisamos a quien nos usa sin resultados.
  useEffect(() => {
    if (!trial && !finished.current) {
      finished.current = true;
      onFinish([]);
    }
  }, [trial, onFinish]);

  useEffect(() => {
    if (stage === 'done' && !finished.current) {
      finished.current = true;
      onFinish([...outcomes.current]);
    }
  }, [stage, onFinish]);

  const register = (response: Response) => {
    if (!trial || answeredIndex.current === index) return;
    const anticipated = stage === 'pre';
    // Antes del estímulo solo cuenta tocar (anticipación); las opciones todavía no están.
    if (stage !== 'show' && !(anticipated && response.kind === 'tap')) return;
    answeredIndex.current = index;
    const outcome = evaluateResponse(trial, response);
    outcomes.current.push(outcome);
    if (feedback) setFlash(outcome.correct ? 'ok' : 'fail');
    if (haptics && !outcome.correct) buzz(40);
    if (trial.mode === 'choice' || anticipated) setStage('isi');
  };

  const reactionTime = () => Math.round(performance.now() - startedAt.current);

  if (!trial) return null;

  const total = trials.length;

  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm font-medium text-ink-soft">
          <span>{game.name}</span>
          <span aria-hidden="true" className="tabular-nums">
            {index + 1} / {total}
          </span>
          <span className="sr-only">
            Ensayo {index + 1} de {total}
          </span>
        </div>
        <ProgressBar value={index / total} label={`Progreso de ${game.name}`} />
      </div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={`${index}-${stage}`}
          id="game-prompt"
          variants={promptVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="text-balance text-center text-2xl font-semibold tracking-tight"
        >
          {promptFor(stage, trial)}
        </motion.p>
      </AnimatePresence>

      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={`${index}-${stage}`}
            variants={stimulusVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex w-full flex-1 items-center justify-center"
          >
            {(stage === 'isi' || stage === 'done') && !flash && (
              <span
                aria-hidden="true"
                className="fill-brand size-3 animate-pulse-soft rounded-full shadow-[0_0_16px_var(--c-brand)]"
              />
            )}

            {stage === 'pre' && trial.mode === 'tap' && (
              <TapArea
                trial={trial}
                waiting
                onTap={() => {
                  register(tapResponse(stage, reactionTime));
                }}
              />
            )}

            {stage === 'pre' && trial.mode === 'choice' && trial.preview && (
              <div className="w-full max-w-sm">
                <VisualView visual={trial.preview.visual} label={trial.preview.label} />
              </div>
            )}

            {stage === 'show' && trial.mode === 'tap' && (
              <TapArea
                trial={trial}
                waiting={false}
                onTap={() => {
                  register(tapResponse(stage, reactionTime));
                }}
              />
            )}

            {stage === 'show' && trial.mode === 'choice' && (
              <ChoiceArea
                trial={trial}
                onChoose={(chosenId) => {
                  register({ kind: 'choice', chosenId, rtMs: reactionTime() });
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash}
              variants={markVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 m-auto flex size-14 items-center justify-center rounded-full ${flash === 'ok' ? 'fill-brand text-brand-ink shadow-lift' : 'glass text-ink ring-1 ring-inset ring-line-strong'}`}
            >
              {flash === 'ok' ? (
                <CheckIcon size={20} weight="bold" />
              ) : (
                <XIcon size={20} weight="bold" />
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <p aria-live="polite" className="sr-only">
        {flash === 'ok' ? 'Correcto. ' : flash === 'fail' ? 'Incorrecto. ' : ''}
        {announcementFor(stage, trial)}
      </p>
    </div>
  );
}

/** Respuesta de toque: en la espera es anticipada (sin tiempo de reacción). */
function tapResponse(stage: Stage, reactionTime: () => number): Response {
  const anticipated = stage === 'pre';
  return {
    kind: 'tap',
    tapped: true,
    rtMs: anticipated ? null : reactionTime(),
    anticipated,
  };
}

function TapArea({
  trial,
  waiting,
  onTap,
}: {
  trial: TapTrial;
  waiting: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={waiting ? 'Espera la señal. No toques todavía' : 'Tocar para responder'}
      aria-describedby="game-prompt"
      className="glass ring-gradient relative flex min-h-80 w-full max-w-md flex-1 items-center justify-center overflow-hidden rounded-card transition-transform duration-200 active:scale-[0.985]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(closest-side_at_50%_50%,var(--c-glow-1),transparent)]"
      />
      {waiting && (
        <span
          aria-hidden="true"
          className="ring-line relative block size-24 animate-pulse-soft rounded-full ring-2 ring-inset"
        />
      )}
      {!waiting && trial.shape === 'letter' && (
        <span
          aria-hidden="true"
          className="relative text-[7.5rem] font-semibold tabular-nums tracking-tight"
        >
          {trial.display}
        </span>
      )}
      {!waiting && trial.shape === 'circle' && (
        <span
          aria-hidden="true"
          className="fill-aurora relative size-36 rounded-full shadow-[inset_0_2px_0_rgb(255_255_255/0.5)]"
        />
      )}
      {!waiting && trial.shape === 'square' && (
        <span
          aria-hidden="true"
          className="fill-gold relative size-36 rounded-[2.25rem] shadow-[inset_0_2px_0_rgb(255_255_255/0.5)]"
        />
      )}
    </button>
  );
}

function ChoiceArea({ trial, onChoose }: { trial: ChoiceTrial; onChoose: (id: string) => void }) {
  const isGrid = trial.layout === 'grid';
  return (
    <div className="flex w-full flex-col items-center gap-8">
      {trial.display && (
        <p
          aria-hidden="true"
          className="text-[5.5rem] leading-none font-semibold tracking-tight"
          style={
            trial.displayColor ? { color: `var(--c-stroop-${trial.displayColor})` } : undefined
          }
        >
          {trial.display}
        </p>
      )}
      {trial.visual && (
        <div className="w-full max-w-md">
          <VisualView visual={trial.visual} label={trial.displayLabel} />
        </div>
      )}
      <div
        role="group"
        aria-label={trial.prompt}
        className={isGrid ? 'grid w-full max-w-sm gap-2' : 'grid w-full max-w-md grid-cols-2 gap-3'}
        style={
          isGrid && trial.columns
            ? { gridTemplateColumns: `repeat(${trial.columns}, minmax(0, 1fr))` }
            : undefined
        }
      >
        {trial.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onChoose(option.id);
            }}
            aria-label={option.ariaLabel ?? option.label}
            className={
              isGrid
                ? 'glass ring-gradient flex aspect-square min-h-11 items-center justify-center rounded-2xl p-2 text-xl font-semibold transition-transform active:scale-95'
                : 'glass ring-gradient min-h-16 rounded-2xl px-4 py-3 text-lg font-semibold tracking-wide transition-transform active:scale-95'
            }
          >
            {option.visual ? (
              <span className="block size-full">
                <VisualView visual={option.visual} />
              </span>
            ) : (
              option.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
