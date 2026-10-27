import { describe, expect, it } from 'vitest';
import { streakMilestone, STREAK_MILESTONES } from './milestones';

describe('streakMilestone', () => {
  it('devuelve el hito solo cuando la racha es exactamente esa cifra', () => {
    expect(streakMilestone(4)).toBe(4);
    expect(streakMilestone(3)).toBeNull();
    expect(streakMilestone(5)).toBeNull();
  });

  it('no hay hitos para una racha de cero o sin ordenar', () => {
    expect(streakMilestone(0)).toBeNull();
    expect(STREAK_MILESTONES).toEqual([...STREAK_MILESTONES].sort((a, b) => a - b));
  });
});
