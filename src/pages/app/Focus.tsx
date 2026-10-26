import { useEffect, useRef, useState } from 'react';
import { LinkButton, Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Controls';
import { Card, Notice, PageHeader, ProgressBar } from '../../components/ui/Surfaces';
import { toDateKey } from '../../domain/dates';
import type { FocusRecord } from '../../domain/model';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';
import { useNow } from '../../hooks/useNow';
import { registrarEvento } from '../../services/medicion';
import { useAppStore } from '../../store/appStore';
import { plural } from '../../lib/format';

const DURATIONS = [
  { value: '15', label: '15 min', description: 'Para empezar.' },
  { value: '25', label: '25 min', description: 'Un bloque clásico de trabajo.' },
  { value: '45', label: '45 min', description: 'Para una tarea que pide tiempo.' },
] as const;

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * Modo foco: un bloque de trabajo sin cambiar de pestaña. Solo ve lo que pasa dentro de esta pestaña
 * (si la ocultas, lo contamos). No accede a otras aplicaciones ni al sistema.
 */
export default function Focus() {
  useDocumentMeta({
    title: 'Modo foco',
    description: 'Un bloque de foco con temporizador y recuento de las salidas de la pestaña.',
  });
  const entitlement = useEntitlement();
  const todayKey = toDateKey(useNow());
  const addFocusSession = useAppStore((state) => state.addFocusSession);

  const [minutes, setMinutes] = useState<'15' | '25' | '45'>('25');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [exits, setExits] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [finished, setFinished] = useState<FocusRecord | null>(null);
  const [hideClock, setHideClock] = useState(false);
  const startedAt = useRef<Date | null>(null);
  const focusedSeconds = useRef(0);
  const exitCount = useRef(0);

  const planned = Number(minutes) * 60;

  useEffect(() => {
    if (!running) return;
    const onVisibility = () => {
      const isHidden = document.visibilityState === 'hidden';
      setHidden(isHidden);
      if (isHidden) {
        exitCount.current += 1;
        setExits(exitCount.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        focusedSeconds.current += 1;
        setElapsed(focusedSeconds.current);
      }
    }, 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [running]);

  useEffect(() => {
    if (running && elapsed >= planned) {
      stop();
    }
    // stop cambia en cada render; solo nos interesa el tiempo transcurrido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, planned, running]);

  const start = () => {
    registrarEvento('enfoque_iniciado'); // Medición anónima (apagada por defecto): sin ningún dato del bloque.
    startedAt.current = new Date();
    focusedSeconds.current = 0;
    exitCount.current = 0;
    setElapsed(0);
    setExits(0);
    setFinished(null);
    setRunning(true);
  };

  function stop() {
    setRunning(false);
    if (!startedAt.current) return;
    const record: FocusRecord = {
      id: `${Date.now()}`,
      dateKey: todayKey,
      startedAt: startedAt.current.toISOString(),
      plannedMinutes: Number(minutes),
      focusedSeconds: focusedSeconds.current,
      exits: exitCount.current,
    };
    addFocusSession(record);
    setFinished(record);
    startedAt.current = null;
  }

  const title = (
    <>
      Modo <span className="pixel-accent">foco</span>
    </>
  );

  if (entitlement !== 'premium') {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <PageHeader
          title={title}
          lead="Un bloque de trabajo sin cambiar de pestaña. Si sales, lo anotamos sin juzgarte."
        />
        <Notice
          tone="premium"
          title="El modo foco es Premium."
          action={
            <LinkButton to="/precios" variant="premium">
              Ver planes
            </LinkButton>
          }
        >
          La sesión diaria completa sigue siendo gratis.
        </Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <PageHeader
        title={title}
        lead="Un bloque de trabajo sin cambiar de pestaña. Solo vemos lo que pasa dentro de esta pestaña: si la ocultas, lo anotamos. No vemos tus otras aplicaciones."
      />

      {!running && !finished && (
        <Card variant="hero" className="animate-fade-up">
          <div className="space-y-7">
            <Segmented
              legend="Cuánto tiempo quieres"
              options={DURATIONS}
              value={minutes}
              onChange={setMinutes}
              columns={3}
            />
            <Button size="lg" className="w-full" onClick={start}>
              Empezar {minutes} minutos
            </Button>
          </div>
        </Card>
      )}

      {running && (
        <Card variant="hero" className="animate-fade-up text-center" labelledBy="foco-activo">
          <div className="space-y-6">
            <h2 id="foco-activo" className="sr-only">
              Bloque de foco en curso
            </h2>
            <p className={`text-sm font-medium ${hidden ? 'text-accent-text' : 'text-ink-soft'}`}>
              {hidden ? 'Esta pestaña está oculta: no cuenta como foco.' : 'Foco activo'}
            </p>
            <p className="figure text-aurora text-[5.5rem] sm:text-[7rem]" aria-live="off">
              {hideClock ? '··:··' : clock(Math.max(0, planned - elapsed))}
            </p>
            <ProgressBar value={elapsed / planned} label="Tiempo de foco completado" />
            <p className="text-base text-ink-soft">Salidas de la pestaña: {exits}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                variant="ghost"
                onClick={() => {
                  setHideClock((value) => !value);
                }}
              >
                {hideClock ? 'Mostrar el tiempo' : 'Ocultar el tiempo'}
              </Button>
              <Button variant="secondary" onClick={stop}>
                Terminar ahora
              </Button>
            </div>
          </div>
        </Card>
      )}

      {finished && (
        <Notice tone="success" title="Bloque terminado.">
          <p>
            Has tenido {Math.round(finished.focusedSeconds / 60)} minutos de foco y{' '}
            {plural(finished.exits, 'salida', 'salidas')} de la pestaña. Sin juicio: lo anotamos y
            seguimos.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              setFinished(null);
            }}
          >
            Otro bloque
          </Button>
        </Notice>
      )}

      <p className="text-base text-ink-soft">
        Si sales de esta página, el bloque se pierde. Si cierras la pestaña, tampoco se guarda.
      </p>
    </div>
  );
}
