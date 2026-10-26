import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { Reflection } from '../../domain/model';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Controls';
import { cueVariants } from '../ui/motion';

const CYCLE_IN = 4;
const CYCLE_OUT = 6;
const CYCLE = CYCLE_IN + CYCLE_OUT;

/**
 * Respiración guiada: 4 segundos al inhalar y 6 al exhalar. Es una pausa para cambiar de modo,
 * no una técnica clínica. El orbe y los halos se animan con CSS; el reloj y el texto viven aquí.
 */
export function Breath({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  const finished = useRef(false);
  // Guardamos la función en una referencia: un cambio de identidad no debe reiniciar el reloj.
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(() => {
      const next = (performance.now() - started) / 1000;
      setElapsed(next);
      if (next >= seconds && !finished.current) {
        finished.current = true;
        window.clearInterval(timer);
        doneRef.current();
      }
    }, 200);
    return () => {
      window.clearInterval(timer);
    };
  }, [seconds]);

  const inhaling = elapsed % CYCLE < CYCLE_IN;
  const remaining = Math.max(0, Math.ceil(seconds - elapsed));
  const progress = Math.min(1, elapsed / seconds);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center text-center">
      <div className="relative grid size-80 place-items-center rounded-full bg-[radial-gradient(closest-side,var(--c-glow-2),transparent)]">
        <span
          aria-hidden="true"
          className="animate-halo absolute inset-0 rounded-full border border-brand/30"
        />
        <span
          aria-hidden="true"
          className="animate-halo absolute inset-4 rounded-full border border-brand/20"
          style={{ animationDelay: '-1.2s' }}
        />
        <span
          aria-hidden="true"
          className="animate-breathe absolute inset-10 rounded-full bg-[radial-gradient(circle_at_34%_28%,rgb(255_255_255/0.9),var(--c-aurora-a)_30%,var(--c-aurora-b)_62%,var(--c-aurora-c)_100%)]"
        />
      </div>

      <p aria-live="polite" className="-mt-2 h-[2.9rem] text-[2.9rem] leading-none">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={inhaling ? 'inhala' : 'exhala'}
            variants={cueVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="pixel-accent inline-block"
          >
            {inhaling ? 'Inhala' : 'Exhala'}
          </motion.span>
        </AnimatePresence>
      </p>
      <p className="mt-4 font-mono text-xs text-ink-soft tabular-nums">
        Despacio · quedan {remaining} s
      </p>

      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-surface-2">
        <div
          className="fill-brand h-full rounded-full transition-[width] duration-300 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <Button variant="ghost" className="mt-8" onClick={onDone}>
        Saltar
      </Button>
    </div>
  );
}

const MOOD_OPTIONS = [
  { value: 'calmado', label: 'Más tranquilo' },
  { value: 'igual', label: 'Igual' },
  { value: 'disperso', label: 'Más disperso' },
] as const;

const PHONE_OPTIONS = [
  { value: 'menos-30', label: 'Menos de 30 min' },
  { value: '30-60', label: 'Entre 30 y 60 min' },
  { value: 'mas-60', label: 'Más de una hora' },
  { value: 'no-se', label: 'No lo sé' },
] as const;

/** Reflexión breve al final. Son respuestas tuyas: ni correctas ni incorrectas. */
export function ReflectionStep({ onDone }: { onDone: (value: Reflection | null) => void }) {
  // Sin respuestas preseleccionadas: el resultado solo recoge lo que la persona elige.
  const [mood, setMood] = useState<Reflection['mood'] | null>(null);
  const [phoneUse, setPhoneUse] = useState<Reflection['phoneUse'] | null>(null);
  const answered = mood !== null && phoneUse !== null;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-9">
      <div className="space-y-3">
        <p className="eyebrow text-brand">Antes de cerrar</p>
        <h2 className="text-[2.4rem] leading-[1]">
          Un momento <span className="pixel-accent">para ti.</span>
        </h2>
        <p className="text-ink-soft">
          Respuestas tuyas, sin correctas ni incorrectas. Puedes saltarlas.
        </p>
      </div>

      <Segmented
        legend="¿Cómo te sientes ahora, comparado con antes de empezar?"
        options={MOOD_OPTIONS}
        value={mood}
        onChange={setMood}
      />

      <Segmented
        legend="¿Cuánto tiempo has usado el móvil hoy, aproximadamente?"
        options={PHONE_OPTIONS}
        value={phoneUse}
        onChange={setPhoneUse}
      />

      <div className="space-y-2">
        {!answered && (
          <p className="text-center text-base text-ink-soft">
            Elige las dos respuestas para guardarlas, o sáltalas.
          </p>
        )}
        <Button
          size="lg"
          className="w-full"
          disabled={!answered}
          onClick={() => {
            if (mood !== null && phoneUse !== null) {
              onDone({ mood, phoneUse });
            }
          }}
        >
          Continuar
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            onDone(null);
          }}
        >
          Saltar
        </Button>
      </div>
    </div>
  );
}
