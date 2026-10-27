import { computeStreak, WEEKLY_GOAL_DAYS } from './streak';

const days = (...keys: string[]) => new Set(keys);

// 2026-10-12 es lunes; 2026-10-18, domingo.
describe('computeStreak (racha semanal)', () => {
  it('sin sesiones la racha es cero', () => {
    expect(computeStreak('2026-10-16', new Set())).toEqual({
      current: 0,
      best: 0,
      weekDays: 0,
      weekGoalMet: false,
      daysLeftInWeek: 3,
    });
  });

  it('la meta es de tres días por semana', () => {
    expect(WEEKLY_GOAL_DAYS).toBe(3);
  });

  it('una semana con tres días, aunque no sean seguidos, cuenta como cumplida', () => {
    const info = computeStreak('2026-10-16', days('2026-10-12', '2026-10-14', '2026-10-16'));
    expect(info.current).toBe(1);
    expect(info.weekDays).toBe(3);
    expect(info.weekGoalMet).toBe(true);
  });

  it('la semana en curso sin cumplir no rompe la racha de las anteriores', () => {
    const info = computeStreak(
      '2026-10-20',
      days('2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-13', '2026-10-14'),
    );
    expect(info.current).toBe(2);
    expect(info.weekDays).toBe(0);
    expect(info.daysLeftInWeek).toBe(6);
  });

  it('faltar varios días dentro de la semana no rompe la racha', () => {
    const info = computeStreak(
      '2026-10-18',
      days('2026-10-05', '2026-10-06', '2026-10-07', '2026-10-12', '2026-10-17', '2026-10-18'),
    );
    expect(info.current).toBe(2);
  });

  it('una semana entera por debajo de la meta reinicia la racha y la mejor se conserva', () => {
    const info = computeStreak(
      '2026-10-23',
      days(
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-12',
        '2026-10-19',
        '2026-10-20',
        '2026-10-21',
      ),
    );
    expect(info.current).toBe(1);
    expect(info.best).toBe(2);
  });

  it('el domingo queda un día en la semana y el lunes, siete', () => {
    expect(computeStreak('2026-10-18', new Set()).daysLeftInWeek).toBe(1);
    expect(computeStreak('2026-10-19', new Set()).daysLeftInWeek).toBe(7);
  });
});
