// Zona horaria del panel: se lee de ADMIN_APP.zonaHoraria (America/Bogota por defecto) y el horario de verano se aplica
// con Intl. Con Europe/Madrid, el 29 de marzo de 2026 el día dura 23 horas: sumar 24 h a mano caería en otro día.
import { describe, expect, it } from 'vitest';
import { ADMIN_APP } from './config';
import { diaDelPanel, diasEntre, inicioDelDia, rangoPeriodo } from './periodo';
import { desfaseZona, fechaIsoLocal, medianocheDesplazada, medianocheLocal } from './zona';

const HORA = 3_600_000;
const MADRID = 'Europe/Madrid';

describe('zona por defecto: America/Bogota, desde la configuración', () => {
  it('la configuración trae America/Bogota', () => {
    expect(ADMIN_APP.zonaHoraria).toBe('America/Bogota');
  });

  it('Bogotá no tiene horario de verano: -5 h todo el año', () => {
    expect(desfaseZona(Date.parse('2026-01-15T12:00:00Z'), 'America/Bogota')).toBe(-5 * HORA);
    expect(desfaseZona(Date.parse('2026-07-15T12:00:00Z'), 'America/Bogota')).toBe(-5 * HORA);
  });

  it('la medianoche de Bogotá es las 05:00 UTC y el día cambia a esa hora', () => {
    expect(new Date(medianocheLocal(2026, 9, 23, 'America/Bogota')).toISOString()).toBe(
      '2026-10-23T05:00:00.000Z',
    );
    expect(new Date(inicioDelDia(Date.parse('2026-10-23T04:59:00Z'))).toISOString()).toBe(
      '2026-10-22T05:00:00.000Z',
    );
    expect(diaDelPanel(Date.parse('2026-10-23T03:00:00Z'))).toBe('2026-10-22');
  });
});

describe('otra zona (Europe/Madrid): el horario de verano se aplica', () => {
  it('el desfase pasa de +1 h a +2 h el 29 de marzo de 2026', () => {
    expect(desfaseZona(Date.parse('2026-03-28T12:00:00Z'), MADRID)).toBe(HORA);
    expect(desfaseZona(Date.parse('2026-03-30T12:00:00Z'), MADRID)).toBe(2 * HORA);
  });

  it('el día que empieza el horario de verano dura 23 horas', () => {
    const inicio = medianocheLocal(2026, 2, 29, MADRID);
    const siguiente = medianocheLocal(2026, 2, 30, MADRID);
    expect((siguiente - inicio) / HORA).toBe(23);
  });

  it('la medianoche de n días después se calcula con el desfase de su propio día', () => {
    expect(
      new Date(medianocheDesplazada(Date.parse('2026-03-30T12:00:00Z'), -1, MADRID)).toISOString(),
    ).toBe('2026-03-28T23:00:00.000Z');
    expect(fechaIsoLocal(Date.parse('2026-03-29T23:30:00Z'), MADRID)).toBe('2026-03-30');
  });

  it('los días de una gráfica son consecutivos aunque el día tenga 23 horas', () => {
    const desde = medianocheLocal(2026, 2, 27, MADRID);
    const hasta = medianocheLocal(2026, 2, 31, MADRID);
    expect(diasEntre(desde, hasta, MADRID)).toEqual([
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
    ]);
  });

  it('un periodo de 7 días tiene 7 días locales aunque cruce el cambio de hora', () => {
    const ahora = Date.parse('2026-03-31T12:00:00Z');
    const rango = rangoPeriodo('7d', ahora, MADRID);
    expect(diasEntre(Date.parse(rango.desde), Date.parse(rango.hasta), MADRID)).toHaveLength(7);
    expect(rango.hasta).toBe(new Date(medianocheLocal(2026, 3, 1, MADRID)).toISOString());
  });

  it('con una fecha no válida no se cuelga ni inventa días', () => {
    expect(diasEntre(Number.NaN, Date.parse('2026-03-31T00:00:00Z'), MADRID)).toEqual([]);
  });
});
