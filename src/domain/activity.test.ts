import { describe, expect, it } from 'vitest';
import { activityGrid, levelFor } from './activity';
import type { FocusRecord, SessionRecord } from './model';

const session = (dateKey: string, games: number): SessionRecord => ({
  dateKey,
  completedAt: `${dateKey}T10:00:00.000Z`,
  durationSec: 300,
  games: Array.from({ length: games }, (_, index) => ({
    gameId: 'vigilancia' as const,
    level: 3,
    accuracy: 0.8,
    medianRtMs: 400,
    scorable: 10,
    correct: 8,
    calm: false,
    completedAt: `${dateKey}T10:0${index}:00.000Z`,
  })),
  reflection: null,
});

const focus = (dateKey: string): FocusRecord => ({
  id: `f-${dateKey}`,
  dateKey,
  startedAt: `${dateKey}T09:00:00.000Z`,
  plannedMinutes: 25,
  focusedSeconds: 1500,
  exits: 0,
});

describe('levelFor', () => {
  it('convierte el número de actividades en cinco niveles', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 12].map(levelFor)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('activityGrid', () => {
  it('devuelve los días pedidos del más antiguo al más reciente, acabando hoy', () => {
    const grid = activityGrid([], [], '2026-10-17', 35);
    expect(grid).toHaveLength(35);
    expect(grid[0]?.dateKey).toBe('2026-09-13');
    expect(grid[34]?.dateKey).toBe('2026-10-17');
  });

  it('suma los juegos de cada sesión y los bloques de foco del mismo día', () => {
    const grid = activityGrid([session('2026-10-17', 3)], [focus('2026-10-17')], '2026-10-17', 7);
    const today = grid[6];
    expect(today).toEqual({ dateKey: '2026-10-17', count: 4, level: 2 });
  });

  it('deja en cero los días sin actividad', () => {
    const grid = activityGrid([session('2026-10-15', 2)], [], '2026-10-17', 7);
    expect(grid.map((day) => day.count)).toEqual([0, 0, 0, 0, 2, 0, 0]);
    expect(grid[4]?.level).toBe(1);
  });
});
