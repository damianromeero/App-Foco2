// Casos de la regla de acceso con purchase.status (REGLAS-HOTMART.md): reembolso solicitado, solicitud cancelada,
// reembolso y contracargo, impago, y avisos sin identificador o sin fecha. Con el Supabase falso de ayudas-hotmart.ts.
// Todo inventado (dominio .test). Las fechas van en minutos desde la medianoche del día de las pruebas.
import { beforeEach, describe, expect, it } from 'vitest';
import { CORREO, compraAprobada, crearBanco, minuto } from './ayudas-hotmart.ts';

let banco: ReturnType<typeof crearBanco>;
beforeEach(() => {
  banco = crearBanco();
});

const iso = (minutos: number) => new Date(minuto(minutos)).toISOString();
const acceso = () => banco.falso.tablas.accesos.get(CORREO)?.estado;
const compra = () => banco.falso.tablas.compras.get('TRX-REGLA-1');

/** Aviso de Hotmart con purchase.status (la fuente preferente de la regla). */
const aviso = (id: string, minutos: number, status: string, evento = 'PURCHASE_DELAYED') => ({
  id,
  creation_date: minuto(minutos),
  event: evento,
  data: { purchase: { transaction: 'TRX-REGLA-1', status } },
});

describe('avisos sin identificador o sin fecha: 400 y nada cambia', () => {
  it('sin id: 400 aviso-sin-id y ninguna escritura ni fila (no hay clave de idempotencia)', async () => {
    const { id: _omitido, ...sinId } = compraAprobada();
    const respuesta = await banco.enviar(sinId);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ ok: false, error: 'aviso-sin-id' });
    expect(banco.falso.escrituras()).toHaveLength(0);
    expect(banco.falso.filas('eventos_pago')).toEqual([]);
    expect(banco.falso.filas('compras')).toEqual([]);
  });

  it('sin creation_date: 400 aviso-sin-fecha, el aviso queda registrado como sin-fecha y no cambia compras ni accesos', async () => {
    const { creation_date: _omitida, ...sinFecha } = compraAprobada({ id: 'aviso-sin-fecha-1' });
    const respuesta = await banco.enviar(sinFecha);
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ ok: false, error: 'aviso-sin-fecha' });
    expect(banco.falso.filas('eventos_pago')).toMatchObject([
      { id_evento: 'sin-fecha-aviso-sin-fecha-1', estado: 'sin-fecha' },
    ]);
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
  });
});

describe('estados intermedios: el acceso se conserva hasta un estado final', () => {
  beforeEach(async () => {
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-REGLA-1', id: 'alta-regla', minutos: 60 }),
    );
  });

  it('reembolso solicitado (sin REFUNDED): PARTIALLY_REFUNDED o PURCHASE_PROTEST mantienen el acceso', async () => {
    await banco.enviar(aviso('aviso-parcial', 90, 'PARTIALLY_REFUNDED', 'PURCHASE_PROTEST'));
    expect(compra()).toMatchObject({ estado: 'mantenida' });
    expect(acceso()).toBe('activo');
  });

  it('solicitud cancelada: si el estado vuelve a APPROVED con fecha posterior, el acceso vuelve', async () => {
    await banco.enviar(aviso('aviso-solicitud', 90, 'PARTIALLY_REFUNDED', 'PURCHASE_PROTEST'));
    // Aviso de aprobación completo (oferta, precio y correo) con el estado APPROVED de Hotmart.
    const vuelve = compraAprobada({ transaccion: 'TRX-REGLA-1', id: 'aviso-vuelve', minutos: 120 });
    await banco.enviar({
      ...vuelve,
      data: { ...vuelve.data, purchase: { ...vuelve.data.purchase, status: 'APPROVED' } },
    });
    expect(compra()).toMatchObject({ estado: 'aprobada', fecha_aviso: iso(120) });
    expect(acceso()).toBe('activo');
  });

  it('un aviso mantenido con fecha ANTERIOR a la aprobada no cambia la compra', async () => {
    await banco.enviar(aviso('aviso-antiguo', 30, 'OVERDUE'));
    expect(compra()).toMatchObject({ estado: 'aprobada', fecha_aviso: iso(60) });
    expect(acceso()).toBe('activo');
  });
});

describe('estados finales: sin acceso', () => {
  beforeEach(async () => {
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-REGLA-1', id: 'alta-regla', minutos: 60 }),
    );
  });

  it('REFUNDED por purchase.status: sin acceso', async () => {
    expect(
      await (await banco.enviar(aviso('aviso-r', 120, 'REFUNDED', 'PURCHASE_REFUNDED'))).json(),
    ).toEqual({ ok: true, estado: 'aplicado' });
    expect(compra()).toMatchObject({ estado: 'reembolsada' });
    expect(acceso()).toBe('inactivo');
  });

  it('CHARGEBACK por purchase.status: sin acceso (reembolsada)', async () => {
    await banco.enviar(aviso('aviso-cb', 120, 'CHARGEBACK', 'PURCHASE_CHARGEBACK'));
    expect(compra()).toMatchObject({ estado: 'reembolsada' });
    expect(acceso()).toBe('inactivo');
  });

  it('CANCELLED, EXPIRED y NO_FUNDS: compra cancelada y sin acceso', async () => {
    await banco.enviar(aviso('aviso-nf', 120, 'NO_FUNDS', 'PURCHASE_DELAYED'));
    expect(compra()).toMatchObject({ estado: 'cancelada' });
    expect(acceso()).toBe('inactivo');
  });

  it('un estado de Hotmart que la plantilla no conoce se guarda como no-procesado y no cambia nada (200)', async () => {
    const respuesta = await banco.enviar(
      aviso('aviso-raro-estado', 120, 'ESTADO_INVENTADO', 'PURCHASE_APPROVED'),
    );
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'no-procesado' });
    expect(compra()).toMatchObject({ estado: 'aprobada' });
    expect(acceso()).toBe('activo');
  });

  it('un estado final ya guardado no vuelve a «mantenida» con un aviso más reciente', async () => {
    await banco.enviar(aviso('aviso-r', 120, 'REFUNDED', 'PURCHASE_REFUNDED'));
    expect(await (await banco.enviar(aviso('aviso-mant', 150, 'OVERDUE'))).json()).toEqual({
      ok: true,
      estado: 'obsoleto',
    });
    expect(compra()).toMatchObject({ estado: 'reembolsada' });
    expect(acceso()).toBe('inactivo');
  });
});

describe('el correo y la cuenta no se borran nunca por un aviso de estado', () => {
  it('un reembolso deja la compra y la cuenta de Auth en su sitio', async () => {
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-REGLA-1', id: 'alta-regla', minutos: 60 }),
    );
    await banco.enviar(aviso('aviso-r', 120, 'REFUNDED', 'PURCHASE_REFUNDED'));
    expect(banco.falso.filas('compras')).toHaveLength(1);
    expect(banco.falso.usuarios.has(CORREO)).toBe(true);
  });
});
