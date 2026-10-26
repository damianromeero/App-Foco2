import { PlayIcon, SpeakerSlashIcon } from '@phosphor-icons/react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { figureGeometry } from '../../domain/games/figures';
import type {
  DotsVisual,
  FigureVisual,
  GridVisual,
  TonesVisual,
  Visual,
} from '../../domain/games/types';
import { audioSupported, barHeightPercent, playTimeline, toneTimeline } from '../../lib/tones';

interface VisualProps {
  visual: Visual;
  /** Si existe, el dibujo se presenta como un grupo con nombre. Si no, se oculta a lectores de pantalla. */
  label?: string;
}

/** Dibuja un estímulo o una opción según su tipo. Todo lo que transmite algo tiene también forma o texto, no solo color. */
export function VisualView({ visual, label }: VisualProps): ReactElement {
  switch (visual.kind) {
    case 'figura':
      return <FigureSvg figure={visual} label={label} />;
    case 'cuadricula':
      return <GridView grid={visual} label={label} />;
    case 'conjunto':
      return (
        <span
          role={label ? 'group' : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : true}
          className="flex w-full flex-wrap items-center justify-center gap-4"
        >
          {visual.items.map((item, index) => (
            <span key={index} className="flex min-w-0 flex-1 justify-center">
              <VisualView visual={item} />
            </span>
          ))}
        </span>
      );
    case 'incognita':
      return (
        <span
          role="img"
          aria-label="Figura que falta"
          className="glass ring-gradient grid aspect-square w-full place-items-center rounded-2xl text-4xl font-semibold text-ink-soft"
        >
          <span aria-hidden="true">?</span>
        </span>
      );
    case 'puntos':
      return <DotsView visual={visual} label={label} />;
    case 'tonos':
      return (
        <span
          role={label ? 'group' : undefined}
          aria-label={label}
          className="flex flex-col items-center gap-4"
        >
          <TonesPlayer visual={visual} />
        </span>
      );
  }
}

/** Figura SVG. Los datos de forma, giro y reflejo se convierten en puntos en `figureGeometry`. */
export function FigureSvg({ figure, label }: { figure: FigureVisual; label?: string }) {
  const geometry = figureGeometry(figure);
  const paint = figure.filled
    ? { fill: 'currentColor', stroke: 'none' }
    : { fill: 'none', stroke: 'currentColor', strokeWidth: 7, strokeLinejoin: 'round' as const };
  return (
    <svg
      viewBox="0 0 100 100"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className="text-ink block aspect-square w-full overflow-visible"
    >
      {figure.axis && (
        <line
          x1={50}
          y1={0}
          x2={50}
          y2={100}
          stroke="currentColor"
          strokeWidth={1.2}
          strokeDasharray="4 3"
          className="opacity-60"
        />
      )}
      {geometry.kind === 'circle' ? (
        <circle cx={50} cy={50} r={geometry.radius} {...paint} />
      ) : (
        <polygon points={geometry.points.map(([x, y]) => `${x},${y}`).join(' ')} {...paint} />
      )}
    </svg>
  );
}

function GridView({ grid, label }: { grid: GridVisual; label?: string }) {
  const lit = new Set(grid.lit);
  const count = grid.columns * grid.columns;
  return (
    <span
      role={label ? 'group' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="grid w-full gap-1.5"
      style={{ gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, index) => {
        const isLit = lit.has(index);
        const cell = grid.cells?.[index] ?? null;
        return (
          <span
            key={index}
            className={`ring-line relative grid aspect-square place-items-center rounded-lg ring-1 ring-inset ${
              isLit ? 'fill-brand shadow-glow' : 'bg-surface-2'
            }`}
          >
            {/* La casilla iluminada también tiene un punto: no depende solo del color. */}
            {isLit && (
              <span aria-hidden="true" className="bg-brand-ink block size-1/3 rounded-full" />
            )}
            {cell && (
              <span className="block size-full p-1.5">
                <FigureSvg figure={cell} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Puntos del seguimiento. Si el dibujo tiene tiempo de movimiento, empieza con los puntos iluminados
 * en su posición inicial y, al terminar la iluminación, se desplazan hasta la posición final.
 */
function DotsView({ visual, label }: { visual: DotsVisual; label?: string }) {
  const animated = visual.moveMs !== undefined;
  const litMs = visual.litMs ?? 0;
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    if (!animated) return;
    const timer = window.setTimeout(() => {
      setMoving(true);
    }, litMs);
    return () => {
      window.clearTimeout(timer);
    };
  }, [animated, litMs]);

  const atEnd = !animated || moving;
  const duration = visual.moveMs ?? 0;
  return (
    <span
      role={label ? 'group' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="glass ring-gradient relative block aspect-square w-full max-w-sm rounded-card"
    >
      {visual.dots.map((dot, index) => {
        const [x, y] = atEnd ? dot.to : dot.from;
        const highlighted = animated && !moving && dot.lit;
        return (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transition: animated
                ? `left ${duration}ms linear, top ${duration}ms linear`
                : undefined,
            }}
          >
            <span
              aria-hidden="true"
              className={
                highlighted
                  ? 'fill-brand shadow-glow ring-brand/35 block size-7 rounded-full ring-4'
                  : 'bg-ink-soft block size-3 rounded-full'
              }
            />
            {dot.letter && (
              <span
                aria-hidden="true"
                className="absolute top-full left-1/2 mt-1 -translate-x-1/2 font-mono text-sm font-semibold"
              >
                {dot.letter}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Botón "Reproducir" para una serie de tonos. El sonido solo suena al pulsar el botón.
 * Sin Web Audio, la serie se muestra como barras que se iluminan en el mismo orden.
 */
function TonesPlayer({ visual }: { visual: TonesVisual }) {
  const timeline = useMemo(
    () => toneTimeline(visual.tones, visual.gapMs),
    [visual.tones, visual.gapMs],
  );
  const total = timeline.at(-1)?.endMs ?? 0;
  const [silent, setSilent] = useState(() => !audioSupported());
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const [lit, setLit] = useState<number | null>(null);

  useEffect(() => {
    if (run === 0) return;
    const timers: number[] = [
      window.setTimeout(() => {
        setPlaying(false);
        setLit(null);
      }, total + 150),
    ];
    if (silent) {
      timeline.forEach((tone, index) => {
        timers.push(
          window.setTimeout(() => {
            setLit(index);
          }, tone.startMs),
          window.setTimeout(() => {
            setLit(null);
          }, tone.endMs),
        );
      });
    }
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, [run, silent, timeline, total]);

  const handlePlay = () => {
    const sounded = !silent && playTimeline(timeline);
    if (!sounded) setSilent(true);
    setPlaying(true);
    setRun((value) => value + 1);
  };

  return (
    <>
      <button
        type="button"
        onClick={handlePlay}
        disabled={playing}
        aria-label={playing ? 'Reproduciendo los sonidos' : 'Reproducir los sonidos'}
        className="glass ring-gradient pressable inline-flex min-h-12 items-center gap-2 rounded-2xl px-5 font-semibold disabled:opacity-60"
      >
        {silent ? (
          <SpeakerSlashIcon size={18} weight="bold" aria-hidden="true" />
        ) : (
          <PlayIcon size={18} weight="fill" aria-hidden="true" />
        )}
        {playing ? 'Sonando…' : 'Reproducir'}
      </button>
      {silent && (
        <>
          <p className="max-w-sm text-center text-base text-ink-soft">
            Este navegador no puede reproducir sonido. En su lugar, cada tono se muestra como una
            barra que se ilumina; la altura de la barra indica la altura del tono.
          </p>
          <span aria-hidden="true" className="flex h-28 items-end justify-center gap-4">
            {visual.tones.map((tone, index) => (
              <span
                key={index}
                className={`block w-5 rounded-full ${
                  lit === index
                    ? 'fill-brand shadow-glow'
                    : 'bg-surface-2 ring-line ring-1 ring-inset'
                }`}
                style={{ height: `${barHeightPercent(tone.hz)}%` }}
              />
            ))}
          </span>
        </>
      )}
    </>
  );
}
