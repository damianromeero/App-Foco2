import { createRng, hashSeed } from './rng';

describe('createRng', () => {
  it('produce la misma secuencia con la misma semilla', () => {
    const a = createRng('2026-10-16|foco5');
    const b = createRng('2026-10-16|foco5');
    const sequenceA = Array.from({ length: 20 }, () => a.next());
    const sequenceB = Array.from({ length: 20 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produce secuencias distintas con semillas distintas', () => {
    const a = createRng('lunes');
    const b = createRng('martes');
    expect(a.next()).not.toBe(b.next());
  });

  it('devuelve números en [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('int incluye ambos extremos', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(rng.int(1, 3));
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('shuffle devuelve una permutación sin modificar el original', () => {
    const rng = createRng('barajar');
    const original = [1, 2, 3, 4, 5, 6];
    const shuffled = rng.shuffle(original);
    expect(original).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
  });

  it('pick lanza error con una lista vacía', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError);
  });

  it('chance respeta las probabilidades extremas', () => {
    const rng = createRng(3);
    expect(Array.from({ length: 50 }, () => rng.chance(0))).not.toContain(true);
    expect(Array.from({ length: 50 }, () => rng.chance(1))).not.toContain(false);
  });

  it('hashSeed es estable', () => {
    expect(hashSeed('foco5')).toBe(hashSeed('foco5'));
    expect(hashSeed('foco5')).not.toBe(hashSeed('foco6'));
  });
});
