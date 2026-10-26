import { GAMES } from './games/registry';
import { buildDailySession, estimateSessionSeconds, eligibleGames, gameIdsOf } from './plan';

const base = {
  dateKey: '2026-10-16',
  levels: {},
  lastPlayed: {},
  entitlement: 'free' as const,
  sinColor: false,
  unreadLessonIds: [],
};

describe('buildDailySession', () => {
  it('empieza con respiración, tiene tres juegos y termina con reflexión', () => {
    const steps = buildDailySession(base);
    expect(steps[0]).toEqual({ kind: 'breath', seconds: 30 });
    expect(steps.filter((step) => step.kind === 'game')).toHaveLength(3);
    expect(steps.at(-1)).toEqual({ kind: 'reflection' });
  });

  it('en el plan gratuito solo aparecen juegos gratuitos', () => {
    const free = GAMES.filter((game) => game.free).map((game) => game.id);
    expect(free.length).toBeLessThan(GAMES.length);
    for (let day = 1; day <= 20; day += 1) {
      const dateKey = `2026-10-${String(day).padStart(2, '0')}`;
      const games = gameIdsOf(buildDailySession({ ...base, dateKey }));
      for (const gameId of games) {
        expect(free).toContain(gameId);
      }
    }
  });

  it('con los 19 juegos, cada plan reúne tres categorías distintas en ambos planes', () => {
    for (let day = 1; day <= 40; day += 1) {
      const dateKey = `2026-09-${String(day).padStart(2, '0')}`;
      for (const entitlement of ['free', 'premium'] as const) {
        const steps = buildDailySession({ ...base, dateKey, entitlement, lastPlayed: {} });
        const categories = gameIdsOf(steps).map(
          (id) => GAMES.find((game) => game.id === id)?.category,
        );
        expect(categories).toHaveLength(3);
        expect(new Set(categories).size).toBe(3);
      }
    }
  });

  it('en modo sin color el plan solo usa juegos sin color, y sigue habiendo de sobra', () => {
    const eligible = eligibleGames('premium', true);
    expect(eligible.every((game) => !game.requiresColor)).toBe(true);
    expect(new Set(eligible.map((game) => game.category)).size).toBe(5);
    for (let day = 1; day <= 20; day += 1) {
      const dateKey = `2026-08-${String(day).padStart(2, '0')}`;
      const games = gameIdsOf(
        buildDailySession({ ...base, dateKey, entitlement: 'premium', sinColor: true }),
      );
      expect(games).toHaveLength(3);
      for (const gameId of games) {
        expect(eligible.map((game) => game.id)).toContain(gameId);
      }
    }
  });

  it('un juego que nunca se ha jugado tiene prioridad sobre los jugados ayer', () => {
    const lastPlayed = Object.fromEntries(
      GAMES.filter((game) => game.id !== 'reflejo').map((game) => [game.id, '2026-10-15']),
    );
    const steps = buildDailySession({
      ...base,
      entitlement: 'premium',
      lastPlayed,
    });
    expect(gameIdsOf(steps)).toContain('reflejo');
  });

  it('no repite categorías cuando hay alternativas', () => {
    const premium = eligibleGames('premium', false);
    const steps = buildDailySession({ ...base, entitlement: 'premium' });
    const categories = gameIdsOf(steps).map(
      (id) => premium.find((game) => game.id === id)?.category,
    );
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('prioriza los juegos que llevan más días sin jugarse', () => {
    const steps = buildDailySession({
      ...base,
      lastPlayed: {
        vigilancia: '2026-10-16',
        semaforo: '2026-10-15',
        secuencia: '2026-10-16',
        busqueda: '2026-10-16',
      },
    });
    // Vigilancia se jugó hoy; semáforo ayer. Los que tocan son los que menos se han jugado.
    expect(gameIdsOf(steps)).not.toContain('vigilancia');
  });

  it('en modo sin color no aparece Stroop, incluso con plan premium', () => {
    for (let day = 1; day <= 15; day += 1) {
      const dateKey = `2026-10-${String(day).padStart(2, '0')}`;
      const games = gameIdsOf(
        buildDailySession({ ...base, dateKey, entitlement: 'premium', sinColor: true }),
      );
      expect(games).not.toContain('stroop');
    }
  });

  it('usa el nivel guardado de cada juego y el nivel 3 por defecto', () => {
    const steps = buildDailySession({ ...base, levels: { vigilancia: 6 } });
    const vigilanciaStep = steps.find(
      (step) => step.kind === 'game' && step.gameId === 'vigilancia',
    );
    const otherStep = steps.find((step) => step.kind === 'game' && step.gameId !== 'vigilancia');
    if (vigilanciaStep?.kind === 'game') expect(vigilanciaStep.level).toBe(6);
    if (otherStep?.kind === 'game') expect(otherStep.level).toBe(3);
  });

  it('es determinista: mismo día y mismo historial, mismo plan', () => {
    expect(buildDailySession(base)).toEqual(buildDailySession(base));
  });

  it('añade la lección solo si hay alguna sin leer', () => {
    expect(buildDailySession(base).some((step) => step.kind === 'lesson')).toBe(false);
    const withLesson = buildDailySession({ ...base, unreadLessonIds: ['leccion-1'] });
    expect(withLesson.at(-1)).toEqual({ kind: 'lesson', lessonId: 'leccion-1' });
  });
});

describe('estimateSessionSeconds', () => {
  it('una sesión típica dura entre 3 y 5 minutos', () => {
    const seconds = estimateSessionSeconds(buildDailySession(base), false);
    expect(seconds).toBeGreaterThan(180);
    expect(seconds).toBeLessThanOrEqual(300);
  });

  it('el modo sin prisa alarga la sesión', () => {
    const steps = buildDailySession(base);
    expect(estimateSessionSeconds(steps, true)).toBeGreaterThan(
      estimateSessionSeconds(steps, false),
    );
  });
});
