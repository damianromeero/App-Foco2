import { addDays } from './dates';
import { HABITS, habitsForDay, isHabitId } from './habits';

const DAYS = Array.from({ length: 30 }, (_, index) => addDays('2026-10-01', index));

describe('desafíos de hábito', () => {
  it('el catálogo tiene 6 hábitos con id único, título y detalle', () => {
    expect(HABITS).toHaveLength(6);
    expect(new Set(HABITS.map((habit) => habit.id)).size).toBe(HABITS.length);
    for (const habit of HABITS) {
      expect(habit.title.trim()).not.toBe('');
      expect(habit.detail.trim()).not.toBe('');
    }
  });

  it('el mismo día devuelve siempre los mismos tres hábitos', () => {
    expect(habitsForDay('2026-10-17')).toEqual(habitsForDay('2026-10-17'));
  });

  it('cada día devuelve tres hábitos distintos del catálogo', () => {
    for (const day of DAYS) {
      const ids = habitsForDay(day).map((habit) => habit.id);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
      expect(ids.every(isHabitId)).toBe(true);
    }
  });

  it('días distintos suelen dar combinaciones distintas', () => {
    const combinations = new Set(
      DAYS.map((day) =>
        habitsForDay(day)
          .map((habit) => habit.id)
          .sort()
          .join(','),
      ),
    );
    expect(combinations.size).toBeGreaterThan(5);
  });

  it('isHabitId solo acepta ids del catálogo', () => {
    expect(isHabitId('cerrar-pestana')).toBe(true);
    expect(isHabitId('no-existe')).toBe(false);
    expect(isHabitId('')).toBe(false);
  });
});
