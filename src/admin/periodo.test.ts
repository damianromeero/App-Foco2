import { describe, expect, it } from 'vitest';
import { diaDelPanel, diasEntre, esPeriodo, inicioDelDia, rangoPeriodo } from './periodo';

// 22 de octubre de 2026 a las 15:00 en Colombia (UTC-5).
const AHORA = Date.parse('2026-10-22T20:00:00.000Z');

describe('rangoPeriodo', () => {
  it('7 días cuentan el día de hoy y los 6 anteriores, en hora de Colombia', () => {
    expect(rangoPeriodo('7d', AHORA)).toEqual({
      desde: '2026-10-16T05:00:00.000Z',
      hasta: '2026-10-23T05:00:00.000Z',
    });
  });

  it('30 y 90 días se calculan con el mismo criterio', () => {
    expect(rangoPeriodo('30d', AHORA).desde).toBe('2026-09-23T05:00:00.000Z');
    expect(rangoPeriodo('90d', AHORA).desde).toBe('2026-07-25T05:00:00.000Z');
  });

  it('«todo» empieza en el origen de la base', () => {
    expect(rangoPeriodo('todo', AHORA).desde).toBe('1970-01-01T00:00:00.000Z');
  });

  it('las 23:59 de Colombia siguen siendo el mismo día; la medianoche cambia el día', () => {
    expect(inicioDelDia(Date.parse('2026-10-23T04:59:00.000Z'))).toBe(
      Date.parse('2026-10-22T05:00:00.000Z'),
    );
    expect(rangoPeriodo('7d', Date.parse('2026-10-23T05:00:00.000Z')).hasta).toBe(
      '2026-10-24T05:00:00.000Z',
    );
  });
});

describe('diaDelPanel y diasEntre', () => {
  it('convierte un instante al día de Colombia, no al de UTC', () => {
    expect(diaDelPanel(Date.parse('2026-10-23T04:59:59.000Z'))).toBe('2026-10-22');
    expect(diaDelPanel(Date.parse('2026-10-23T05:00:00.000Z'))).toBe('2026-10-23');
  });

  it('lista los días del rango sin incluir el día final', () => {
    const dias = diasEntre(
      Date.parse('2026-10-16T05:00:00.000Z'),
      Date.parse('2026-10-23T05:00:00.000Z'),
    );
    expect(dias).toHaveLength(7);
    expect(dias[0]).toBe('2026-10-16');
    expect(dias[6]).toBe('2026-10-22');
  });
});

describe('esPeriodo', () => {
  it('acepta solo los periodos del panel', () => {
    expect(esPeriodo('7d')).toBe(true);
    expect(esPeriodo('todo')).toBe(true);
    expect(esPeriodo('mes')).toBe(false);
    expect(esPeriodo(undefined)).toBe(false);
  });
});
