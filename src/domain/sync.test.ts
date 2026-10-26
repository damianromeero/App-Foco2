import type { SessionRecord } from './model';
import { mergeSessionRecords, sessionsToPush } from './sync';

const session = (dateKey: string, completedAt: string, durationSec = 300): SessionRecord => ({
  dateKey,
  completedAt,
  durationSec,
  games: [],
  reflection: null,
});

describe('mergeSessionRecords', () => {
  it('conserva una sesión por día y gana la completada más tarde', () => {
    const local = [session('2026-10-15', '2026-10-15T09:00:00.000Z', 200)];
    const remote = [session('2026-10-15', '2026-10-15T18:00:00.000Z', 320)];
    const merged = mergeSessionRecords(local, remote);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.durationSec).toBe(320);
  });

  it('une los días que solo existen en un dispositivo y los deja ordenados', () => {
    const merged = mergeSessionRecords(
      [session('2026-10-16', '2026-10-16T09:00:00.000Z')],
      [session('2026-10-14', '2026-10-14T09:00:00.000Z')],
    );
    expect(merged.map((item) => item.dateKey)).toEqual(['2026-10-14', '2026-10-16']);
  });
});

describe('sessionsToPush', () => {
  it('sube lo que la nube no tiene y las versiones locales más recientes', () => {
    const merged = [
      session('2026-10-14', '2026-10-14T09:00:00.000Z'),
      session('2026-10-15', '2026-10-15T20:00:00.000Z'),
    ];
    const remote = [session('2026-10-15', '2026-10-15T08:00:00.000Z')];
    expect(sessionsToPush(merged, remote).map((item) => item.dateKey)).toEqual([
      '2026-10-14',
      '2026-10-15',
    ]);
  });

  it('no sube nada si la nube ya tiene la misma versión', () => {
    const same = session('2026-10-15', '2026-10-15T09:00:00.000Z');
    expect(sessionsToPush([same], [same])).toEqual([]);
  });
});
