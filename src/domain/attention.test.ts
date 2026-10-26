import {
  accuracyTrend,
  baselineComparison,
  focusTotals,
  phoneUseCounts,
  totals,
  weeklyActivity,
} from './attention';
import type { BaselineRecord, FocusRecord, GameResultRecord, SessionRecord } from './model';

const game = (
  gameId: GameResultRecord['gameId'],
  accuracy: number,
  completedAt: string,
  level = 3,
): GameResultRecord => ({
  gameId,
  level,
  accuracy,
  medianRtMs: 500,
  scorable: 20,
  correct: Math.round(accuracy * 20),
  calm: false,
  completedAt,
});

const session = (
  dateKey: string,
  games: GameResultRecord[],
  durationSec = 300,
  reflection: SessionRecord['reflection'] = null,
): SessionRecord => ({
  dateKey,
  completedAt: `${dateKey}T10:00:00.000Z`,
  durationSec,
  games,
  reflection,
});

describe('weeklyActivity', () => {
  it('devuelve siete días terminando hoy, marcando los días con sesión', () => {
    const activity = weeklyActivity([session('2026-10-15', [])], '2026-10-16');
    expect(activity).toHaveLength(7);
    expect(activity.at(-1)?.dateKey).toBe('2026-10-16');
    expect(activity.find((day) => day.dateKey === '2026-10-15')?.completed).toBe(true);
    expect(activity.filter((day) => day.completed)).toHaveLength(1);
  });
});

describe('accuracyTrend', () => {
  it('ordena por fecha y respeta el límite', () => {
    const sessions = [
      session('2026-10-02', [game('vigilancia', 0.7, '2026-10-02T10:00:00.000Z')]),
      session('2026-10-01', [game('vigilancia', 0.6, '2026-10-01T10:00:00.000Z')]),
      session('2026-10-03', [game('semaforo', 0.9, '2026-10-03T10:00:00.000Z')]),
    ];
    const trend = accuracyTrend(sessions, 'vigilancia', 10);
    expect(trend.map((point) => point.accuracy)).toEqual([0.6, 0.7]);
    expect(accuracyTrend(sessions, 'vigilancia', 1)).toHaveLength(1);
  });
});

describe('baselineComparison', () => {
  const baseline: BaselineRecord = {
    completedAt: '2026-10-01T10:00:00.000Z',
    results: [game('vigilancia', 0.6, '2026-10-01T10:00:00.000Z')],
    startLevels: { vigilancia: 3 },
  };

  it('sin test base no hay comparación', () => {
    expect(baselineComparison(null, [])).toEqual([]);
  });

  it('calcula la diferencia en puntos con las últimas partidas', () => {
    const sessions = [
      session('2026-10-10', [game('vigilancia', 0.8, '2026-10-10T10:00:00.000Z', 4)]),
      session('2026-10-11', [game('vigilancia', 0.9, '2026-10-11T10:00:00.000Z', 4)]),
    ];
    const [delta] = baselineComparison(baseline, sessions);
    expect(delta?.recentAccuracy).toBe(0.85);
    expect(delta?.deltaPoints).toBe(25);
    expect(delta?.recentLevel).toBe(4);
  });

  it('sin partidas recientes, la diferencia es nula', () => {
    const [delta] = baselineComparison(baseline, []);
    expect(delta?.deltaPoints).toBeNull();
  });
});

describe('totales y reflexiones', () => {
  it('suma sesiones, minutos y juegos', () => {
    const result = totals([
      session('2026-10-01', [game('semaforo', 0.8, '2026-10-01T10:00:00.000Z')], 240),
    ]);
    expect(result).toEqual({ sessions: 1, minutes: 4, games: 1 });
  });

  it('cuenta las respuestas sobre el uso del móvil', () => {
    const counts = phoneUseCounts([
      session('2026-10-01', [], 300, { mood: 'igual', phoneUse: 'mas-60' }),
      session('2026-10-02', [], 300, { mood: 'calmado', phoneUse: 'mas-60' }),
      session('2026-10-03', [], 300, null),
    ]);
    expect(counts['mas-60']).toBe(2);
    expect(counts['menos-30']).toBe(0);
  });

  it('resume el modo foco', () => {
    const focus: FocusRecord[] = [
      {
        id: 'a',
        dateKey: '2026-10-01',
        startedAt: '2026-10-01T10:00:00.000Z',
        plannedMinutes: 25,
        focusedSeconds: 1500,
        exits: 2,
      },
    ];
    expect(focusTotals(focus)).toEqual({ sessions: 1, minutes: 25, exits: 2 });
  });
});
