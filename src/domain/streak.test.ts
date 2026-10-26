import { computeStreak } from './streak';

const days = (...keys: string[]) => new Set(keys);

describe('computeStreak', () => {
  it('sin sesiones la racha es cero y el descanso está disponible', () => {
    expect(computeStreak('2026-10-16', new Set())).toEqual({
      current: 0,
      best: 0,
      protectedDays: [],
      restAvailable: true,
    });
  });

  it('cuenta días consecutivos, incluido hoy', () => {
    const info = computeStreak('2026-10-16', days('2026-10-14', '2026-10-15', '2026-10-16'));
    expect(info.current).toBe(3);
    expect(info.best).toBe(3);
  });

  it('si hoy aún no se ha entrenado, la racha sigue viva desde ayer', () => {
    const info = computeStreak('2026-10-16', days('2026-10-14', '2026-10-15'));
    expect(info.current).toBe(2);
  });

  it('un día perdido queda protegido por el descanso y no rompe la racha', () => {
    const info = computeStreak(
      '2026-10-16',
      days('2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16'),
    );
    expect(info.protectedDays).toEqual(['2026-10-14']);
    expect(info.current).toBe(4);
    expect(info.restAvailable).toBe(false);
  });

  it('dos días perdidos con menos de una semana de diferencia rompen la racha', () => {
    const info = computeStreak(
      '2026-10-16',
      days('2026-10-10', '2026-10-11', '2026-10-13', '2026-10-15', '2026-10-16'),
    );
    // El 12 se protege con descanso; el 14 no puede, porque ya descansó hace 2 días.
    expect(info.protectedDays).toEqual(['2026-10-12']);
    expect(info.current).toBe(2);
  });

  it('dos descansos separados por al menos siete días son válidos', () => {
    const info = computeStreak(
      '2026-10-20',
      days('2026-10-10', '2026-10-12', '2026-10-13', '2026-10-17', '2026-10-19', '2026-10-20'),
    );
    // Descansos el 11 y el 18: hay siete días entre ambos. Entre medias, la racha se corta.
    expect(info.protectedDays).toEqual(['2026-10-11', '2026-10-18']);
    expect(info.current).toBe(3);
    expect(info.best).toBe(3);
  });

  it('la mejor racha se conserva aunque la actual sea menor', () => {
    const info = computeStreak(
      '2026-10-30',
      days('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-30'),
    );
    expect(info.best).toBe(4);
    expect(info.current).toBe(1);
  });
});
