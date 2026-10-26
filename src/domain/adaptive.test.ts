import { MAX_LEVEL, MIN_LEVEL, START_LEVEL, nextLevel, startLevelFromBaseline } from './adaptive';

describe('nextLevel', () => {
  it('sube de nivel con precisión alta', () => {
    expect(nextLevel(3, 0.9)).toBe(4);
  });

  it('baja de nivel con precisión baja', () => {
    expect(nextLevel(3, 0.5)).toBe(2);
  });

  it('mantiene el nivel en la zona de entrenamiento', () => {
    expect(nextLevel(3, 0.7)).toBe(3);
  });

  it('nunca supera el nivel máximo ni baja del mínimo', () => {
    expect(nextLevel(MAX_LEVEL, 1)).toBe(MAX_LEVEL);
    expect(nextLevel(MIN_LEVEL, 0)).toBe(MIN_LEVEL);
  });
});

describe('startLevelFromBaseline', () => {
  it('traduce la precisión del test base en un nivel inicial', () => {
    expect(startLevelFromBaseline(0.95)).toBe(5);
    expect(startLevelFromBaseline(0.85)).toBe(4);
    expect(startLevelFromBaseline(0.7)).toBe(START_LEVEL);
    expect(startLevelFromBaseline(0.3)).toBe(2);
  });
});
