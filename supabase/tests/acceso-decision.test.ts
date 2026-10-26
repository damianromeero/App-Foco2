// Decisión de acceso (supabase/functions/_shared/acceso.ts): función pura, sin red ni base. Cubre la regla de
// REGLAS-HOTMART.md: compras aprobadas o mantenidas cuentan; reembolsadas o canceladas no; una suscripción cancelada por
// voluntad propia da acceso hasta date_next_charge; una cancelada por impago no da acceso.
import { describe, expect, it } from 'vitest';
import {
  calcularAcceso,
  normalizarCorreo,
  type CompraDeAcceso,
  type SuscripcionDeAcceso,
} from '../functions/_shared/acceso.ts';

const FIN = '2026-10-24T15:00:00.000Z';
const compra = (estado: string, suscriptor: string | null = null): CompraDeAcceso => ({
  estado,
  suscriptor,
});
/** Suscripción tal como la guarda la base: el motivo no se guarda, sale del último cobro. */
const suscripcion = (
  estado: SuscripcionDeAcceso['estado'],
  ultimoCobro: SuscripcionDeAcceso['ultimoCobro'] = 'aprobado',
  accesoHasta: string | null = null,
): SuscripcionDeAcceso => ({ estado, ultimoCobro, accesoHasta });
const mapa = (entradas: [string, SuscripcionDeAcceso][]) => new Map(entradas);

describe('calcularAcceso: sin compras y compras que no cuentan', () => {
  it('sin compras no hay acceso', () => {
    expect(calcularAcceso([], new Map())).toEqual({ estado: 'inactivo', accesoHasta: null });
  });

  it('reembolsada o cancelada, sin otra que cuente, deja el acceso inactivo', () => {
    expect(calcularAcceso([compra('reembolsada')], new Map()).estado).toBe('inactivo');
    expect(calcularAcceso([compra('cancelada')], new Map()).estado).toBe('inactivo');
  });

  it('un estado desconocido nunca da acceso', () => {
    expect(calcularAcceso([compra('pendiente')], new Map()).estado).toBe('inactivo');
  });

  it('el resultado no depende del orden de las compras', () => {
    const a = [compra('reembolsada'), compra('aprobada')];
    expect(calcularAcceso(a, new Map())).toEqual(calcularAcceso([...a].reverse(), new Map()));
  });
});

describe('calcularAcceso: aprobada y mantenida cuentan; las finales no', () => {
  it('una compra aprobada de pago único da acceso sin fecha de fin', () => {
    expect(calcularAcceso([compra('aprobada')], new Map())).toEqual({
      estado: 'activo',
      accesoHasta: null,
    });
  });

  it('una compra mantenida (Hotmart reintenta el cobro) conserva el acceso', () => {
    expect(calcularAcceso([compra('mantenida')], new Map()).estado).toBe('activo');
  });

  it('reembolsar una compra no quita el acceso si otra sigue vigente', () => {
    expect(calcularAcceso([compra('reembolsada'), compra('aprobada')], new Map()).estado).toBe(
      'activo',
    );
  });
});

describe('calcularAcceso: suscripciones', () => {
  it('una suscripción activa da acceso sin fecha de fin', () => {
    expect(
      calcularAcceso([compra('aprobada', 'SUS-1')], mapa([['SUS-1', suscripcion('activa')]])),
    ).toEqual({ estado: 'activo', accesoHasta: null });
  });

  it('cancelación VOLUNTARIA: el acceso sigue hasta date_next_charge', () => {
    expect(
      calcularAcceso(
        [compra('aprobada', 'SUS-1')],
        mapa([['SUS-1', suscripcion('cancelada', 'aprobado', FIN)]]),
      ),
    ).toEqual({ estado: 'activo', accesoHasta: FIN });
  });

  it('cancelación POR IMPAGO con fecha de fin guardada: sin acceso (el último cobro impagado manda)', () => {
    expect(
      calcularAcceso(
        [compra('mantenida', 'SUS-1')],
        mapa([['SUS-1', suscripcion('cancelada', 'impago', FIN)]]),
      ),
    ).toEqual({ estado: 'inactivo', accesoHasta: null });
  });

  it('una cancelación solo afecta a las compras con ese suscriptor', () => {
    const resultado = calcularAcceso(
      [compra('aprobada', 'SUS-1'), compra('aprobada', 'SUS-2')],
      mapa([
        ['SUS-1', suscripcion('cancelada', 'impago', FIN)],
        ['SUS-2', suscripcion('activa')],
      ]),
    );
    expect(resultado).toEqual({ estado: 'activo', accesoHasta: null });
  });

  it('cancelar una suscripción no quita el acceso si hay un pago único vigente', () => {
    const resultado = calcularAcceso(
      [compra('aprobada', 'SUS-1'), compra('aprobada')],
      mapa([['SUS-1', suscripcion('cancelada', 'aprobado', FIN)]]),
    );
    expect(resultado).toEqual({ estado: 'activo', accesoHasta: null });
  });

  it('con varias fechas de fin de cancelaciones voluntarias, cuenta la más lejana', () => {
    const tarde = '2026-10-25T10:00:00.000Z';
    const resultado = calcularAcceso(
      [compra('aprobada', 'SUS-1'), compra('aprobada', 'SUS-2')],
      mapa([
        ['SUS-1', suscripcion('cancelada', 'aprobado', FIN)],
        ['SUS-2', suscripcion('cancelada', 'aprobado', tarde)],
      ]),
    );
    expect(resultado).toEqual({ estado: 'activo', accesoHasta: tarde });
  });

  it('una compra de suscripción sin fila de suscripción cuenta como activa', () => {
    expect(calcularAcceso([compra('aprobada', 'SUS-9')], new Map())).toEqual({
      estado: 'activo',
      accesoHasta: null,
    });
  });
});

describe('normalizarCorreo', () => {
  it('lleva el correo a minúsculas y quita los espacios de los lados', () => {
    expect(normalizarCorreo('  Comprador@Ejemplo.TEST ')).toBe('comprador@ejemplo.test');
  });
});
