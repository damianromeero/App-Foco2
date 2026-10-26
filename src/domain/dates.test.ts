import { addDays, diffDays, parseDateKey, toDateKey, weekStartKey } from './dates';

describe('fechas', () => {
  it('toDateKey y parseDateKey son inversas', () => {
    const key = '2026-03-08';
    expect(toDateKey(parseDateKey(key))).toBe(key);
  });

  it('addDays cruza meses y años', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diffDays no se ve afectado por el cambio de hora de verano', () => {
    // El 29 de marzo de 2026 cambia la hora en España: el día tiene 23 horas.
    expect(diffDays('2026-03-30', '2026-03-28')).toBe(2);
    expect(diffDays('2026-04-01', '2026-03-01')).toBe(31);
  });

  it('weekStartKey devuelve el lunes de la semana', () => {
    // 16 de octubre de 2026 es viernes.
    expect(weekStartKey('2026-10-16')).toBe('2026-10-12');
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(weekStartKey('2026-10-18')).toBe('2026-10-12');
    // Un lunes es su propio inicio de semana.
    expect(weekStartKey('2026-10-12')).toBe('2026-10-12');
  });

  it('lanza error con una fecha no válida', () => {
    expect(() => addDays('no-es-fecha', 1)).toThrow(RangeError);
  });
});
