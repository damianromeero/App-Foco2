import { CHALLENGES, challengeForWeek, challengeProgress, sessionsInWeek } from './challenges';
import { GAMES } from './games/registry';
import type { GameId, GameResultRecord, SessionRecord } from './model';

/** Resultado de un juego con datos fijos; solo importan el id y la precisión. */
const game = (gameId: GameId, accuracy = 0.8): GameResultRecord => ({
  gameId,
  level: 3,
  accuracy,
  medianRtMs: 400,
  scorable: 20,
  correct: 16,
  calm: false,
  completedAt: '2026-10-12T10:00:00.000Z',
});

/** Sesión con un juego por cada id; la precisión se toma de `accuracies` en el mismo orden. */
const withGames = (
  dateKey: string,
  gameIds: GameId[],
  accuracies: number[] = [],
): SessionRecord => ({
  ...session(dateKey),
  games: gameIds.map((gameId, index) => game(gameId, accuracies[index] ?? 0.8)),
});

const session = (dateKey: string, accuracies: number[] = [0.8]): SessionRecord => ({
  dateKey,
  completedAt: `${dateKey}T10:00:00.000Z`,
  durationSec: 300,
  reflection: null,
  games: accuracies.map((accuracy, index) => ({
    gameId: index % 2 === 0 ? 'vigilancia' : 'semaforo',
    level: 3,
    accuracy,
    medianRtMs: 400,
    scorable: 20,
    correct: 16,
    calm: false,
    completedAt: `${dateKey}T10:0${index}:00.000Z`,
  })),
});

describe('retos semanales', () => {
  it('el reto de la semana es el mismo para todas las personas y en todos los días', () => {
    expect(challengeForWeek('2026-10-12', 'free')).toEqual(challengeForWeek('2026-10-12', 'free'));
  });

  it('el plan gratuito nunca recibe un reto premium', () => {
    for (let week = 0; week < 40; week += 1) {
      const challenge = challengeForWeek(`2026-01-${String(week + 1).padStart(2, '0')}`, 'free');
      expect(challenge.premium).toBe(false);
    }
  });

  it('el catálogo cubre todos los tipos de medida', () => {
    const metrics = new Set(CHALLENGES.map((challenge) => challenge.metric));
    expect([...metrics].sort()).toEqual(
      [
        'categorias-distintas',
        'dias-seguidos',
        'juegos-distintos',
        'minutos-foco',
        'modalidades-distintas',
        'precision',
        'sesiones',
      ].sort(),
    );
  });

  it('cada reto tiene un id único', () => {
    const ids = CHALLENGES.map((challenge) => challenge.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('un reto premium solo aparece cuando no se puede cumplir con juegos gratuitos', () => {
    for (const challenge of CHALLENGES) {
      if (challenge.category === undefined && challenge.modality === undefined) continue;
      const scope = GAMES.filter(
        (game) =>
          (challenge.category === undefined || game.category === challenge.category) &&
          (challenge.modality === undefined || game.modality === challenge.modality),
      );
      const hasFree = scope.some((game) => game.free);
      expect(challenge.premium, challenge.id).toBe(!hasFree);
    }
  });

  it('los retos de variedad se pueden cumplir con juegos gratuitos', () => {
    const freeGames = GAMES.filter((game) => game.free);
    expect(new Set(freeGames.map((game) => game.category)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(freeGames.map((game) => game.modality)).size).toBeGreaterThanOrEqual(3);
    expect(freeGames.length).toBeGreaterThanOrEqual(4);
  });

  it('sessionsInWeek incluye lunes y domingo y excluye el lunes siguiente', () => {
    const sessions = [
      session('2026-10-11'),
      session('2026-10-12'),
      session('2026-10-18'),
      session('2026-10-19'),
    ];
    const week = sessionsInWeek(sessions, '2026-10-12');
    expect(week.map((item) => item.dateKey)).toEqual(['2026-10-12', '2026-10-18']);
  });

  it('progreso de sesiones y de precisión', () => {
    const challenge = CHALLENGES.find((item) => item.metric === 'sesiones');
    if (!challenge) throw new Error('falta el reto de sesiones');
    const progress = challengeProgress(
      challenge,
      [session('2026-10-12'), session('2026-10-13')],
      [],
    );
    expect(progress.value).toBe(2);
    expect(progress.done).toBe(false);
    expect(progress.ratio).toBe(0.5);

    const precision = CHALLENGES.find((item) => item.metric === 'precision');
    if (!precision) throw new Error('falta el reto de precisión');
    const done = challengeProgress(precision, [session('2026-10-12', [0.9, 0.85])], []);
    expect(done.done).toBe(true);
  });

  it('progreso de minutos de foco a partir de los segundos registrados', () => {
    const challenge = CHALLENGES.find((item) => item.metric === 'minutos-foco');
    if (!challenge) throw new Error('falta el reto de foco');
    const progress = challengeProgress(
      challenge,
      [],
      [
        {
          id: 'a',
          dateKey: '2026-10-12',
          startedAt: '2026-10-12T10:00:00.000Z',
          plannedMinutes: 25,
          focusedSeconds: 1800,
          exits: 0,
        },
      ],
    );
    expect(progress.value).toBe(30);
    expect(progress.done).toBe(true);
  });

  it('precisión por modalidad: solo cuentan los juegos de sonido', () => {
    const challenge = CHALLENGES.find((item) => item.id === 'oido-fino');
    if (!challenge) throw new Error('falta el reto de sonido');
    const week = [withGames('2026-10-12', ['vigilancia', 'mismo-tono'], [0.2, 0.9])];
    const progress = challengeProgress(challenge, week, []);
    expect(progress.value).toBeCloseTo(0.9);
    expect(progress.done).toBe(true);
  });

  it('sesiones de una categoría: solo cuentan las que incluyen un juego de esa categoría', () => {
    const challenge = CHALLENGES.find((item) => item.id === 'atencion-en-marcha');
    if (!challenge) throw new Error('falta el reto de atención');
    const sessions = [
      withGames('2026-10-12', ['vigilancia']),
      withGames('2026-10-13', ['stroop']),
      withGames('2026-10-14', ['reflejo']),
    ];
    expect(challengeProgress(challenge, sessions, []).value).toBe(2);
  });

  it('cuenta categorías y modalidades distintas de la semana', () => {
    const categories = CHALLENGES.find((item) => item.metric === 'categorias-distintas');
    const modalities = CHALLENGES.find((item) => item.metric === 'modalidades-distintas');
    if (!categories || !modalities) throw new Error('faltan retos');
    const week = [withGames('2026-10-12', ['vigilancia', 'semaforo', 'casilla-iluminada'])];
    expect(challengeProgress(categories, week, []).value).toBe(3);
    expect(challengeProgress(modalities, week, []).value).toBe(3);
  });

  it('días seguidos: cuenta el tramo más largo sin huecos', () => {
    const challenge = CHALLENGES.find((item) => item.metric === 'dias-seguidos');
    if (!challenge) throw new Error('falta el reto de racha');
    const sessions = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-16'].map((day) =>
      session(day),
    );
    const progress = challengeProgress(challenge, sessions, []);
    expect(progress.value).toBe(3);
    expect(progress.done).toBe(true);
  });
});
