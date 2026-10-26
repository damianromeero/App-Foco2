import { describe, expect, it } from 'vitest';
import {
  formatearDiaCorto,
  formatearFecha,
  formatearNumero,
  formatearPorcentaje,
  formatearUsd,
} from './formato';

describe('formatearUsd', () => {
  it('usa punto para miles y coma para centavos, con US$ delante', () => {
    expect(formatearUsd(1234.5)).toBe('US$1.234,50');
    expect(formatearUsd(0)).toBe('US$0,00');
    expect(formatearUsd(19.99)).toBe('US$19,99');
  });

  it('pone el signo delante de los negativos', () => {
    expect(formatearUsd(-12)).toBe('-US$12,00');
  });

  it('un valor no finito se muestra como cero, nunca como NaN', () => {
    expect(formatearUsd(Number.NaN)).toBe('US$0,00');
    expect(formatearUsd(Number.POSITIVE_INFINITY)).toBe('US$0,00');
  });
});

describe('formatearNumero y formatearPorcentaje', () => {
  it('agrupa miles también debajo de diez mil', () => {
    expect(formatearNumero(1234)).toBe('1.234');
    expect(formatearNumero(1234567)).toBe('1.234.567');
    expect(formatearNumero(999)).toBe('999');
  });

  it('muestra el porcentaje con un decimal y coma', () => {
    expect(formatearPorcentaje(12.5)).toBe('12,5 %');
    expect(formatearPorcentaje(Number.NaN)).toBe('0,0 %');
  });
});

describe('fechas', () => {
  it('formatea en español y en hora de Colombia', () => {
    // 15:00 del 22 de octubre en Colombia.
    expect(formatearFecha('2026-10-22T20:00:00.000Z')).toBe('22 oct 2026');
    // 22:00 del 21 de octubre en Colombia, aunque en UTC ya sea el 22.
    expect(formatearFecha('2026-10-22T03:00:00.000Z')).toBe('21 oct 2026');
  });

  it('una fecha no válida se muestra como guion', () => {
    expect(formatearFecha('no es una fecha')).toBe('—');
  });

  it('el día corto de un eje sale de AAAA-MM-DD', () => {
    expect(formatearDiaCorto('2026-10-22')).toBe('22 oct');
  });
});
