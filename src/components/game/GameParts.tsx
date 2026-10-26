import { nextLevel } from '../../domain/adaptive';
import { CATEGORIES } from '../../domain/games/registry';
import type { GameSpec } from '../../domain/games/types';
import type { Summary } from '../../domain/scoring';
import { Button } from '../ui/Button';
import { CountUp } from '../ui/CountUp';

/** Nombre del juego con su última palabra en cursiva: "Buscar la *O*". */
function AccentTitle({ text }: { text: string }) {
  const words = text.split(' ');
  const last = words.pop();
  return (
    <>
      {words.length > 0 && `${words.join(' ')} `}
      <span className="pixel-accent">{last}</span>
    </>
  );
}

/** Presentación de un juego: categoría, nombre en grande, instrucciones numeradas y un solo botón. */
export function GameIntro({
  game,
  seconds,
  calm,
  onStart,
}: {
  game: GameSpec;
  seconds: number;
  calm: boolean;
  onStart: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-9">
      <div className="space-y-4">
        <p className="eyebrow text-brand">{CATEGORIES[game.category].label}</p>
        <h2 className="text-[2.8rem] leading-[0.98] sm:text-6xl">
          <AccentTitle text={game.name} />
        </h2>
        <p className="text-lg leading-snug text-ink-soft">{game.tagline}</p>
      </div>

      <ol className="glass ring-gradient divide-y divide-line rounded-card px-5">
        {game.instructions.map((instruction, index) => (
          <li key={instruction} className="flex items-start gap-4 py-4">
            <span className="fill-brand-soft figure mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-xs text-brand ring-1 ring-inset ring-brand/25">
              {index + 1}
            </span>
            <span className="leading-relaxed">{instruction}</span>
          </li>
        ))}
      </ol>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={onStart}>
          Empezar
        </Button>
        <p className="text-center font-mono text-xs text-ink-soft">
          Unos {Math.round(seconds)} segundos ·{' '}
          {calm ? 'modo sin prisa' : 'sin cuenta atrás visible'}
        </p>
      </div>
    </div>
  );
}

/** Resultado de un juego: la precisión es la cifra protagonista y el mensaje describe lo que pasó, sin juicio. */
export function GameResult({
  game,
  level,
  summary,
  calm,
  onContinue,
  continueLabel = 'Continuar',
}: {
  game: GameSpec;
  level: number;
  summary: Summary;
  calm: boolean;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const next = nextLevel(level, summary.accuracy);
  let message: string;
  if (summary.accuracy >= 0.85) {
    message = 'Muy bien. Probamos un poco más de dificultad.';
  } else if (summary.accuracy > 0.6) {
    message = 'Estás en la zona donde más se entrena.';
  } else {
    message = 'Hoy costó más. Es normal: bajamos la dificultad para que sigas.';
  }
  const levelNote =
    next > level
      ? `Subes al nivel ${next}.`
      : next < level
        ? `Bajas al nivel ${next}.`
        : `Sigues en el nivel ${level}.`;
  const percent = Math.round(summary.accuracy * 100);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-9">
      <div className="space-y-4">
        <p className="eyebrow text-brand">
          {game.name} · nivel {level}
        </p>
        <p className="figure text-aurora text-[7.5rem] sm:text-[9rem]">
          <CountUp value={percent} />
          <span className="ml-2 align-top font-sans text-2xl font-semibold text-ink-soft">%</span>
        </p>
        <h2 className="text-[1.8rem] leading-[1.1]">{message}</h2>
      </div>

      <dl className="glass ring-gradient grid grid-cols-2 gap-0 rounded-card p-5">
        <div className="pr-4">
          <dt className="font-mono text-xs text-ink-soft">Aciertos</dt>
          <dd className="figure mt-2 text-4xl tabular-nums">
            {summary.correct}
            <span className="font-sans text-base font-medium text-ink-soft">
              {' '}
              de {summary.scorable}
            </span>
          </dd>
        </div>
        <div className="border-l border-line pl-5">
          <dt className="font-mono text-xs text-ink-soft">Reacción mediana</dt>
          <dd className="figure mt-2 text-4xl tabular-nums">
            {summary.medianRtMs ?? '—'}
            {summary.medianRtMs !== null && (
              <span className="font-sans text-base font-medium text-ink-soft"> ms</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="space-y-3">
        <p className="text-base text-ink-soft">
          {levelNote}
          {calm ? ' Modo sin prisa: el tiempo no te ha limitado.' : ''}
        </p>
        <Button size="lg" className="w-full" onClick={onContinue}>
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
