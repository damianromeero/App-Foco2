import { describe, expect, it } from 'vitest';
import { streakMilestone, STREAK_MILESTONES } from './milestones';

describe('streakMilestone', () => {
  it('devuelve el hito solo cuando la racha es exactamente esa cifra', () => {
    expect(streakMilestone(7)).toBe(7);
    expect(streakMilestone(6)).toBeNull();
    expect(streakMilestone(8)).toBeNull();
  });

  it('no hay hitos para una racha de cero o sin ordenar', () => {
    expect(streakMilestone(0)).toBeNull();
    expect(STREAK_MILESTONES).toEqual([...STREAK_MILESTONES].sort((a, b) => a - b));
  });
});
