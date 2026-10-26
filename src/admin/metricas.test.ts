import { describe, expect, it } from 'vitest';
import {
  avisosARevisar,
  comprasAprobadas,
  comprasAprobadasPorPlan,
  conteoPorTipo,
  dispositivosUnicos,
  embudoCompra,
  ingresosAprobados,
  porcentaje,
  eventosPorDia,
  retencionSimple,
  ultimoDiaActivo,
  type AvisoFila,
  type CompraFila,
  type EventoFila,
} from './metricas';

const compra = (parcial: Partial<CompraFila>): CompraFila => ({
  referencia: '…000001',
  correoEnmascarado: 'c***@example.com',
  plan: 'mensual',
  montoUsd: 10,
  estado: 'aprobada',
  creadoEn: '2026-10-20T15:00:00.000Z',
  ...parcial,
});

const evento = (
  tipo: string,
  dispositivo: string,
  creadoEn = '2026-10-20T15:00:00.000Z',
): EventoFila => ({
  tipo,
  dispositivo,
  creadoEn,
});

describe('ingresos y compras', () => {
  it('los ingresos suman solo las compras aprobadas', () => {
    const compras = [
      compra({ montoUsd: 19.99, estado: 'aprobada' }),
      compra({ montoUsd: 19.99, estado: 'reembolsada' }),
      compra({ montoUsd: 10, estado: 'cancelada' }),
      compra({ montoUsd: 29.5, estado: 'aprobada', plan: 'anual' }),
    ];
    expect(ingresosAprobados(compras)).toBe(49.49);
    expect(comprasAprobadas(compras)).toBe(2);
  });

  it('cuenta las compras aprobadas por plan, con los dos planes siempre presentes', () => {
    const compras = [
      compra({ plan: 'mensual' }),
      compra({ plan: 'mensual' }),
      compra({ plan: 'anual' }),
      compra({ plan: 'anual', estado: 'reembolsada' }),
    ];
    expect(comprasAprobadasPorPlan(compras)).toEqual({ mensual: 2, anual: 1 });
    expect(comprasAprobadasPorPlan([])).toEqual({ mensual: 0, anual: 0 });
  });

  it('sin compras, los ingresos son cero', () => {
    expect(ingresosAprobados([])).toBe(0);
  });
});

describe('porcentaje', () => {
  it('calcula el porcentaje con un decimal', () => {
    expect(porcentaje(1, 3)).toBe(33.3);
    expect(porcentaje(3, 4)).toBe(75);
  });

  it('sin base, cero: nunca división entre cero ni NaN', () => {
    expect(porcentaje(0, 0)).toBe(0);
    expect(porcentaje(5, 0)).toBe(0);
    expect(porcentaje(Number.NaN, 4)).toBe(0);
  });
});

describe('embudo de compra', () => {
  it('cada etapa de evento solo cuenta a quien pasó por la anterior', () => {
    const eventos = [
      evento('portada_vista', 'a'),
      evento('portada_vista', 'b'),
      evento('portada_vista', 'c'),
      evento('portada_vista', 'd'),
      evento('precios_vista', 'a'),
      evento('precios_vista', 'b'),
      evento('precios_vista', 'e'), // e nunca vio la portada: no entra en el embudo.
      evento('compra_clic', 'a'),
      evento('compra_clic', 'c'), // c no vio los precios: no entra.
    ];
    const compras = [compra({}), compra({}), compra({})];

    const pasos = embudoCompra(eventos, compras);

    expect(pasos.map((paso) => paso.valor)).toEqual([4, 2, 1, 3]);
    expect(pasos[1]).toMatchObject({ porcentajeDelAnterior: 50, porcentajeDelInicio: 50 });
    expect(pasos[2]).toMatchObject({ porcentajeDelAnterior: 50, porcentajeDelInicio: 25 });
    // La compra viene de Hotmart y puede superar los clics: el porcentaje no se recorta.
    expect(pasos[3]).toMatchObject({ porcentajeDelAnterior: 300, porcentajeDelInicio: 75 });
  });

  it('sin datos, todos los porcentajes son cero y ningún valor es NaN', () => {
    const pasos = embudoCompra([], []);
    expect(pasos).toHaveLength(4);
    for (const paso of pasos) {
      expect(paso.valor).toBe(0);
      expect(paso.porcentajeDelAnterior).toBe(0);
      expect(paso.porcentajeDelInicio).toBe(0);
      expect(Number.isNaN(paso.porcentajeDelAnterior)).toBe(false);
    }
  });
});

describe('uso de la app', () => {
  it('cuenta los dispositivos distintos sin mostrarlos', () => {
    const eventos = [
      evento('portada_vista', 'a'),
      evento('precios_vista', 'a'),
      evento('compra_clic', 'b'),
    ];
    expect(dispositivosUnicos(eventos)).toBe(2);
  });

  it('ordena los eventos por tipo de más a menos frecuente', () => {
    const eventos = [
      evento('precios_vista', 'a'),
      evento('portada_vista', 'a'),
      evento('portada_vista', 'b'),
      evento('compra_clic', 'c'),
    ];
    expect(conteoPorTipo(eventos)).toEqual([
      { tipo: 'portada_vista', veces: 2 },
      { tipo: 'compra_clic', veces: 1 },
      { tipo: 'precios_vista', veces: 1 },
    ]);
  });

  it('el último día con actividad es el del último evento, en hora de Colombia', () => {
    expect(ultimoDiaActivo([])).toBeNull();
    const eventos = [
      evento('portada_vista', 'a', '2026-10-20T10:00:00.000Z'),
      evento('portada_vista', 'a', '2026-10-23T03:00:00.000Z'),
    ];
    expect(ultimoDiaActivo(eventos)).toBe('2026-10-22');
  });

  it('el recuento diario cuenta eventos por día, con los días sin eventos en cero', () => {
    const rango = { desde: '2026-10-16T05:00:00.000Z', hasta: '2026-10-23T05:00:00.000Z' };
    const eventos = [
      evento('portada_vista', 'a', '2026-10-20T15:00:00.000Z'),
      evento('precios_vista', 'a', '2026-10-20T16:00:00.000Z'),
      evento('portada_vista', 'b', '2026-10-20T17:00:00.000Z'),
      evento('portada_vista', 'a', '2026-10-01T15:00:00.000Z'), // fuera del rango
    ];

    const serie = eventosPorDia(eventos, rango);

    expect(serie).toHaveLength(7);
    expect(serie.find((punto) => punto.dia === '2026-10-20')?.eventos).toBe(3);
    expect(serie.find((punto) => punto.dia === '2026-10-21')?.eventos).toBe(0);
  });

  it('el recuento de un periodo largo muestra como mucho los últimos 90 días', () => {
    const rango = { desde: '1970-01-01T00:00:00.000Z', hasta: '2026-10-23T05:00:00.000Z' };
    expect(eventosPorDia([], rango)).toHaveLength(90);
  });
});

describe('retención simple', () => {
  // Ahora: 22 de octubre a las 15:00 en Colombia.
  const ahora = Date.parse('2026-10-22T20:00:00.000Z');

  it('solo cuenta los días ya terminados', () => {
    const eventos = [
      // x empezó el 17 y volvió el 18.
      evento('portada_vista', 'x', '2026-10-17T12:00:00.000Z'),
      evento('portada_vista', 'x', '2026-10-18T12:00:00.000Z'),
      // y empezó el 17 y no volvió.
      evento('portada_vista', 'y', '2026-10-17T13:00:00.000Z'),
      // z empezó hoy: su día 1 aún no ha terminado.
      evento('portada_vista', 'z', '2026-10-21T12:00:00.000Z'),
    ];

    const [dia1, dia7] = retencionSimple(eventos, [1, 7], ahora);

    expect(dia1).toEqual({ dias: 1, base: 2, volvieron: 1, porcentaje: 50 });
    expect(dia7).toEqual({ dias: 7, base: 0, volvieron: 0, porcentaje: 0 });
  });
});

describe('avisos de Hotmart', () => {
  it('avisos a revisar son solo los de estados de revisión', () => {
    const avisos: AvisoFila[] = [
      { referencia: '…000001', estado: 'procesado', recibidoEn: '2026-10-20T15:00:00.000Z' },
      { referencia: '…000002', estado: 'sin-correo', recibidoEn: '2026-10-20T15:00:00.000Z' },
      { referencia: '…000003', estado: 'divisa-no-usd', recibidoEn: '2026-10-20T15:00:00.000Z' },
    ];
    expect(avisosARevisar(avisos).map((aviso) => aviso.estado)).toEqual([
      'sin-correo',
      'divisa-no-usd',
    ]);
  });
});
