import { XIcon } from '@phosphor-icons/react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { GameIntro, GameResult } from '../../components/game/GameParts';
import { GameRunner } from '../../components/game/GameRunner';
import { LinkButton, Button } from '../../components/ui/Button';
import { PhaseSwitch } from '../../components/ui/motion';
import { Notice, PageHeader } from '../../components/ui/Surfaces';
import { START_LEVEL } from '../../domain/adaptive';
import { toDateKey } from '../../domain/dates';
import { GAMES, getGame } from '../../domain/games/registry';
import type { GameSpec } from '../../domain/games/types';
import { createRng } from '../../domain/rng';
import { summarize, type Summary, type TrialOutcome } from '../../domain/scoring';
import type { GameResultRecord } from '../../domain/model';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';
import { useNow } from '../../hooks/useNow';
import { useAppStore } from '../../store/appStore';

type Phase = 'intro' | 'running' | 'summary';

function findGame(id: string | undefined): GameSpec | undefined {
  return GAMES.find((game) => game.id === id);
}

export default function Practice() {
  const { gameId } = useParams();
  const game = findGame(gameId);
  useDocumentMeta({
    title: game ? `Práctica: ${game.name}` : 'Práctica',
    description: game?.tagline,
  });
  const navigate = useNavigate();
  const entitlement = useEntitlement();
  const todayKey = toDateKey(useNow());
  const settings = useAppStore((state) => state.settings);
  const levels = useAppStore((state) => state.levels);
  const recordPractice = useAppStore((state) => state.recordPractice);

  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [result, setResult] = useState<GameResultRecord | null>(null);

  const level = game ? (levels[game.id] ?? START_LEVEL) : START_LEVEL;
  const trials = useMemo(() => {
    if (!game) return [];
    return game.build(
      createRng(`practica|${game.id}|${round}|${todayKey}`),
      level,
      settings.calmMode,
    );
  }, [game, level, round, todayKey, settings.calmMode]);

  const handleFinish = useCallback(
    (outcomes: TrialOutcome[]) => {
      if (!game) return;
      const next = summarize(outcomes);
      const record: GameResultRecord = {
        gameId: game.id,
        level,
        accuracy: next.accuracy,
        medianRtMs: next.medianRtMs,
        scorable: next.scorable,
        correct: next.correct,
        calm: settings.calmMode,
        completedAt: new Date().toISOString(),
      };
      recordPractice(record, todayKey);
      setSummary(next);
      setResult(record);
      setPhase('summary');
    },
    [game, level, settings.calmMode, todayKey, recordPractice],
  );

  if (!game) {
    return (
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          title={
            <>
              Ese juego no <span className="pixel-accent">existe</span>
            </>
          }
        />
        <LinkButton to="/biblioteca">Volver a la biblioteca</LinkButton>
      </div>
    );
  }

  if (!game.free && entitlement !== 'premium') {
    return (
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader title={<span className="pixel-accent">{game.name}</span>} />
        <Notice
          tone="premium"
          title="Este juego es Premium."
          action={
            <LinkButton to="/precios" variant="premium">
              Ver planes
            </LinkButton>
          }
        >
          Los juegos gratuitos siguen disponibles, y la sesión diaria completa también es gratis.
        </Notice>
        <LinkButton to="/biblioteca" variant="ghost">
          Volver a la biblioteca
        </LinkButton>
      </div>
    );
  }

  if (game.requiresColor && settings.sinColor) {
    return (
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader title={<span className="pixel-accent">{game.name}</span>} />
        <Notice title="Este juego usa colores y tienes activado el modo sin colores.">
          Puedes desactivarlo en Ajustes si quieres practicarlo.
        </Notice>
        <LinkButton to="/biblioteca" variant="ghost">
          Volver a la biblioteca
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <h1 className="sr-only">Práctica: {game.name}</h1>
      <PhaseSwitch phaseKey={`${round}-${phase}`}>
        {phase === 'intro' && (
          <GameIntro
            game={getGame(game.id)}
            seconds={((trials.length * game.typicalTrialMs) / 1000) * (settings.calmMode ? 1.3 : 1)}
            calm={settings.calmMode}
            onStart={() => {
              setPhase('running');
            }}
          />
        )}
        {phase === 'running' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Salir del juego"
                onClick={() => {
                  void navigate('/biblioteca');
                }}
                className="glass ring-gradient pressable flex size-11 items-center justify-center rounded-full text-ink"
              >
                <XIcon size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <GameRunner
              key={round}
              game={game}
              trials={trials}
              feedback
              haptics={settings.haptics}
              onFinish={handleFinish}
            />
          </div>
        )}
        {phase === 'summary' && summary && result && (
          <div className="space-y-6">
            <GameResult
              game={game}
              level={result.level}
              summary={summary}
              calm={settings.calmMode}
              continueLabel="Otra partida"
              onContinue={() => {
                setRound((value) => value + 1);
                setSummary(null);
                setResult(null);
                setPhase('intro');
              }}
            />
            <div className="text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  void navigate('/biblioteca');
                }}
              >
                Volver a la biblioteca
              </Button>
            </div>
          </div>
        )}
      </PhaseSwitch>
    </div>
  );
}
