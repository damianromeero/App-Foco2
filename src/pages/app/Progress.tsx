import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router';
import { BarChart, LineChart, type BarDatum, type LinePoint } from '../../components/charts/Charts';
import { LinkButton } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Controls';
import { Badge, Card, Notice, PageHeader, ProgressBar } from '../../components/ui/Surfaces';
import {
  accuracyTrend,
  baselineComparison,
  focusTotals,
  phoneUseCounts,
  totals,
  weeklyActivity,
} from '../../domain/attention';
import { toDateKey, weekdayShort } from '../../domain/dates';
import { GAMES, getGame } from '../../domain/games/registry';
import type { GameId } from '../../domain/model';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';
import { useNow } from '../../hooks/useNow';
import { formatPercent, plural } from '../../lib/format';
import { DAY_MS } from '../../domain/time';

const BASELINE_REFRESH_DAYS = 28;

/** Retraso de entrada escalonado: cada bloque aparece un poco después que el anterior. */
const enter = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <div className="animate-fade-up" style={enter(delay)}>
      {children}
    </div>
  );
}

function improved(deltaPoints: number | null): boolean {
  return deltaPoints !== null && deltaPoints > 0;
}

export default function Progress() {
  useDocumentMeta({
    title: 'Progreso',
    description: 'Tus sesiones, tu racha y tus resultados por juego.',
  });
  const now = useNow();
  const todayKey = toDateKey(now);
  const entitlement = useEntitlement();
  const sessions = useAppStore((state) => state.sessions);
  const baseline = useAppStore((state) => state.baseline);
  const focusSessions = useAppStore((state) => state.focusSessions);
  const levels = useAppStore((state) => state.levels);
  const [gameTab, setGameTab] = useState<GameId>('vigilancia');

  const summary = totals(sessions);
  const week = weeklyActivity(sessions, todayKey);
  const weekData: BarDatum[] = week.map((day) => ({
    label: weekdayShort(day.dateKey),
    value: day.minutes,
    hint: day.completed ? `${Math.round(day.minutes)} minutos` : 'Sin sesión',
    highlight: day.completed,
  }));
  const deltas = baselineComparison(baseline, sessions);
  const phoneCounts = phoneUseCounts(sessions);
  const phoneTotal =
    phoneCounts['menos-30'] + phoneCounts['30-60'] + phoneCounts['mas-60'] + phoneCounts['no-se'];
  const focus = focusTotals(focusSessions);
  const trend = accuracyTrend(sessions, gameTab, 20);
  const trendPoints: LinePoint[] = trend.map((point) => ({
    label: point.dateKey,
    value: point.accuracy,
  }));
  const baselineAge = baseline
    ? Math.floor((now.getTime() - Date.parse(baseline.completedAt)) / DAY_MS)
    : null;
  const baselineDue = baselineAge === null || baselineAge >= BASELINE_REFRESH_DAYS;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rendimiento"
        title={<span className="pixel-accent">Progreso</span>}
        lead="Lo que medimos aquí es tu rendimiento en los juegos. Nada más, y nada menos."
      />

      {sessions.length === 0 ? (
        <Notice
          title="Aún no hay datos."
          action={
            <LinkButton to="/sesion" size="md">
              Empezar la primera sesión
            </LinkButton>
          }
        >
          Completa tu primera sesión y aquí verás tu evolución.
        </Notice>
      ) : (
        <>
          <section aria-labelledby="resumen" className="grid grid-cols-3 gap-3">
            <h2 id="resumen" className="sr-only">
              Resumen
            </h2>
            <Stat label="Sesiones" value={summary.sessions} delay={60} />
            <Stat label="Minutos" value={summary.minutes} delay={120} />
            <Stat label="Juegos" value={summary.games} delay={180} />
          </section>

          <Enter delay={240}>
            <Card variant="hero" labelledBy="semana-progreso">
              <h2 id="semana-progreso" className="text-xl">
                Minutos esta semana
              </h2>
              <div className="mt-5">
                <BarChart data={weekData} ariaLabel="Minutos de sesión en los últimos siete días" />
              </div>
            </Card>
          </Enter>
        </>
      )}

      <Enter delay={300}>
        <Card labelledBy="base-titulo">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-prose space-y-1">
              <h2 id="base-titulo" className="text-xl">
                Tu punto de partida frente a ahora
              </h2>
              <p className="text-base text-ink-soft">
                El test base se hace siempre al mismo nivel. Si ahora juegas a otro nivel, la
                precisión puede cambiar: por eso también mostramos el nivel.
              </p>
            </div>
            {baselineDue && (
              <LinkButton to="/onboarding?modo=base" variant="secondary" size="md">
                Repetir el test base
              </LinkButton>
            )}
          </div>
          {!baseline && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-prose text-base text-ink-soft">
                Todavía no tienes test base: tres juegos cortos para tener un punto de partida.
              </p>
              <LinkButton to="/onboarding?modo=base" variant="secondary" size="md">
                Hacer el test base
              </LinkButton>
            </div>
          )}
          {baseline && deltas.length > 0 && (
            <ul className="mt-5 divide-y divide-line">
              {deltas.map((delta) => (
                <li key={delta.gameId} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-4">
                  <span className="font-semibold">{getGame(delta.gameId).name}</span>
                  <span
                    className={`text-right text-lg font-semibold tabular-nums ${improved(delta.deltaPoints) ? 'text-brand' : ''}`}
                  >
                    {delta.deltaPoints === null
                      ? 'Sin partidas recientes'
                      : `${delta.deltaPoints > 0 ? '+' : ''}${delta.deltaPoints} puntos`}
                  </span>
                  <span className="col-span-2 text-base text-ink-soft tabular-nums">
                    Base: {formatPercent(delta.baselineAccuracy)} al nivel {delta.baselineLevel}
                    {delta.recentAccuracy !== null &&
                      ` · Ahora: ${formatPercent(delta.recentAccuracy)} al nivel ${delta.recentLevel ?? '—'}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Enter>

      <Enter delay={360}>
        <Card labelledBy="tendencias">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="tendencias" className="text-xl">
              Tendencia por juego
            </h2>
            {entitlement !== 'premium' && <Badge tone="premium">Premium: historial completo</Badge>}
          </div>
          {entitlement === 'premium' ? (
            <div className="mt-5 space-y-5">
              <Tabs
                label="Elige un juego"
                options={GAMES.map((game) => ({ value: game.id, label: game.name }))}
                value={gameTab}
                onChange={setGameTab}
              />
              {trendPoints.length > 0 ? (
                <LineChart
                  points={trendPoints}
                  ariaLabel={`Precisión en ${getGame(gameTab).name}, últimas partidas`}
                />
              ) : (
                <p className="text-base text-ink-soft">
                  Aún no has jugado a {getGame(gameTab).name}.
                </p>
              )}
              <p className="text-base text-ink-soft">Nivel actual: {levels[gameTab] ?? 3}.</p>
            </div>
          ) : (
            <div className="mt-5">
              <Notice
                tone="premium"
                title="Mira la evolución completa de cada juego."
                action={
                  <LinkButton to="/precios" variant="premium">
                    Ver planes
                  </LinkButton>
                }
              >
                El plan gratuito te muestra tu resumen semanal y tu punto de partida.
              </Notice>
            </div>
          )}
        </Card>
      </Enter>

      <Enter delay={420}>
        <Card labelledBy="movil">
          <h2 id="movil" className="text-xl">
            Tu uso del móvil, según tú
          </h2>
          {phoneTotal === 0 ? (
            <p className="mt-2 text-base text-ink-soft">
              Cuando termines una sesión, puedes contarnos cuánto usaste el móvil ese día.
            </p>
          ) : (
            <ul className="mt-5 space-y-4">
              <Row label="Menos de 30 min" value={phoneCounts['menos-30']} total={phoneTotal} />
              <Row label="Entre 30 y 60 min" value={phoneCounts['30-60']} total={phoneTotal} />
              <Row label="Más de una hora" value={phoneCounts['mas-60']} total={phoneTotal} />
              <Row label="No lo sé" value={phoneCounts['no-se']} total={phoneTotal} />
            </ul>
          )}
          <p className="mt-5 text-sm text-ink-soft">
            Es tu estimación. No leemos los datos de tu móvil.
          </p>
        </Card>
      </Enter>

      {focus.sessions > 0 && (
        <Enter delay={480}>
          <Card labelledBy="foco-titulo">
            <h2 id="foco-titulo" className="text-xl">
              Modo foco
            </h2>
            <p className="mt-2 text-ink-soft">
              {plural(focus.sessions, 'sesión de foco', 'sesiones de foco')}, {focus.minutes}{' '}
              minutos en total. Saliste de la pestaña {plural(focus.exits, 'vez', 'veces')}: lo
              anotamos sin juzgarte.
            </p>
          </Card>
        </Enter>
      )}

      <p className="text-base text-ink-soft">
        Medimos cómo rindes en estos juegos. No medimos tu inteligencia, tu salud ni cómo te irá
        fuera de la app. Las fuentes están en{' '}
        <Link
          to="/ciencia"
          className="py-3.5 font-medium text-brand underline-offset-4 hover:underline"
        >
          la pestaña Ciencia
        </Link>
        .
      </p>
    </div>
  );
}

function Stat({ label, value, delay }: { label: string; value: number; delay: number }) {
  return (
    <div
      className="glass ring-gradient animate-fade-up rounded-card px-3 py-5 text-center"
      style={enter(delay)}
    >
      <p className="figure text-[2.4rem] sm:text-5xl">{value}</p>
      <p className="eyebrow mt-3">{label}</p>
    </div>
  );
}

function Row({ label, value, total }: { label: string; value: number; total: number }) {
  const ratio = total === 0 ? 0 : value / total;
  const percent = Math.round(ratio * 100);
  return (
    <li className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink-soft">{percent} %</span>
      </div>
      <ProgressBar value={ratio} label={`${label}: ${percent} %`} />
    </li>
  );
}
