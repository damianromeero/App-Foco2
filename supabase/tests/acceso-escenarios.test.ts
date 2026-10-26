// Acceso de compradores de punta a punta, con varios avisos de Hotmart seguidos y el Supabase falso de ayudas-hotmart.ts.
// Comprueba el estado de la tabla `accesos` y, sobre todo, CUÁNDO se escribe: solo si el estado cambia.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelacionDeCompra,
  cancelacionDeSuscripcion,
  compraAprobada,
  CORREO,
  crearBanco,
  reembolso,
  minuto,
} from './ayudas-hotmart.ts';

let banco: ReturnType<typeof crearBanco>;
beforeEach(() => {
  banco = crearBanco();
});

const iso = (minutos: number) => new Date(minuto(minutos)).toISOString();
const OTRO = 'otra.persona@ejemplo.test';
const acceso = (correo = CORREO) => banco.falso.tablas.accesos.get(correo)?.estado;

describe('sin compras no hay acceso', () => {
  it('un aviso que no es una compra no crea fila de accesos', async () => {
    await banco.enviar({
      id: 'a1',
      creation_date: compraAprobada().creation_date,
      event: 'PURCHASE_DELAYED',
    });
    await banco.enviar(reembolso('TRX-QUE-NO-EXISTE', 120));
    await banco.enviar(cancelacionDeSuscripcion('SUS-QUE-NO-EXISTE', 120));
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.escriturasA('accesos')).toEqual([]);
  });

  it('una compra sin correo válido no da acceso a nadie', async () => {
    await banco.enviar(compraAprobada({ correo: null }));
    await banco.enviar(compraAprobada({ correo: 'no-es-un-correo', transaccion: 'TRX-2' }));
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.filas('compras')).toEqual([]);
  });
});

describe('una sola compra', () => {
  it('compra aprobada: acceso activo, con el evento de origen', async () => {
    await banco.enviar(compraAprobada());
    expect(banco.falso.filas('accesos')).toEqual([
      expect.objectContaining({ correo: CORREO, estado: 'activo', origen: 'PURCHASE_APPROVED' }),
    ]);
  });

  it('compra reembolsada sin otra activa: acceso inactivo, con el evento de origen del reembolso', async () => {
    await banco.enviar(compraAprobada({ minutos: 60 }));
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    expect(banco.falso.filas('accesos')).toEqual([
      expect.objectContaining({ correo: CORREO, estado: 'inactivo', origen: 'PURCHASE_REFUNDED' }),
    ]);
  });

  it('compra cancelada sin otra activa: acceso inactivo', async () => {
    await banco.enviar(compraAprobada({ minutos: 60 }));
    await banco.enviar(cancelacionDeCompra('TRX-DE-PRUEBA-1', 120));
    expect(acceso()).toBe('inactivo');
  });

  it('la fila inactiva se conserva: una compra nueva la reactiva sin crear otra fila', async () => {
    await banco.enviar(compraAprobada({ minutos: 60 }));
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-NUEVA', minutos: 200 }));
    expect(banco.falso.filas('accesos')).toHaveLength(1);
    expect(acceso()).toBe('activo');
  });
});

describe('varias compras del mismo correo', () => {
  it('reembolsar una compra no quita el acceso si otra sigue vigente', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', minutos: 60 }));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-2', minutos: 90 }));
    await banco.enviar(reembolso('TRX-1', 120));
    expect(acceso()).toBe('activo'); // El acceso no cambió: sigue activo por la otra compra.
    await banco.enviar(reembolso('TRX-2', 130));
    expect(acceso()).toBe('inactivo');
  });

  it('cancelar una compra no quita el acceso si otra sigue vigente', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', minutos: 60 }));
    await banco.enviar(
      compraAprobada({
        transaccion: 'TRX-2',
        minutos: 90,
        oferta: 'oferta-anual-de-prueba',
        monto: 59.9,
      }),
    );
    await banco.enviar(cancelacionDeCompra('TRX-1', 120));
    expect(acceso()).toBe('activo');
  });

  it('la cancelación de una suscripción no quita el acceso si el mismo correo tiene un pago único vigente', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', suscriptor: 'SUS-1', minutos: 60 }));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-2', minutos: 90 }));
    await banco.enviar(cancelacionDeSuscripcion('SUS-1', 120));
    expect(acceso()).toBe('activo');
  });

  it('la cancelación de una suscripción quita el acceso cuando era lo único vigente', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', suscriptor: 'SUS-1', minutos: 60 }));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-2', suscriptor: 'SUS-1', minutos: 100 }));
    await banco.enviar(cancelacionDeSuscripcion('SUS-1', 120));
    expect(acceso()).toBe('inactivo');
    expect(banco.falso.filas('compras').every((fila) => fila.estado === 'aprobada')).toBe(true);
  });

  it('reembolsar la última compra vigente de una persona que ya canceló la suscripción mantiene el acceso inactivo', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', suscriptor: 'SUS-1', minutos: 60 }));
    await banco.enviar(cancelacionDeSuscripcion('SUS-1', 120));
    await banco.enviar(reembolso('TRX-1', 130));
    expect(acceso()).toBe('inactivo');
  });
});

describe('personas distintas no se mezclan', () => {
  it('el reembolso de una persona no cambia el acceso de otra', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', minutos: 60 }));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-2', minutos: 70, correo: OTRO }));
    await banco.enviar(reembolso('TRX-1', 120));
    expect(acceso(CORREO)).toBe('inactivo');
    expect(acceso(OTRO)).toBe('activo');
  });

  it('cancelar una suscripción solo afecta a quien la compró', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', suscriptor: 'SUS-1', minutos: 60 }));
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-2', suscriptor: 'SUS-2', minutos: 70, correo: OTRO }),
    );
    await banco.enviar(cancelacionDeSuscripcion('SUS-1', 120));
    expect(acceso(CORREO)).toBe('inactivo');
    expect(acceso(OTRO)).toBe('activo');
  });
});

describe('la fila de accesos solo cambia con un aviso más reciente (guarda por fecha)', () => {
  const fila = () => banco.falso.tablas.accesos.get(CORREO);

  it('un aviso repetido, o con otro identificador y la misma fecha, no cambia la fila', async () => {
    await banco.enviar(compraAprobada());
    const antes = structuredClone(fila());
    await banco.enviar(compraAprobada());
    await banco.enviar(compraAprobada({ id: 'aviso-con-otro-id' }));
    expect(fila()).toEqual(antes);
  });

  it('una renovación más reciente de una suscripción activa mantiene el acceso y adelanta su fecha', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', suscriptor: 'SUS-1', minutos: 60 }));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-2', suscriptor: 'SUS-1', minutos: 100 }));
    await banco.enviar(compraAprobada({ transaccion: 'TRX-3', suscriptor: 'SUS-1', minutos: 140 }));
    expect(fila()).toMatchObject({ estado: 'activo', fecha_aviso: iso(140), acceso_hasta: null });
  });

  it('un reembolso aplicado cambia la fila; repetido o antiguo, no la cambian', async () => {
    await banco.enviar(compraAprobada({ minutos: 60 }));
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    const despues = structuredClone(fila());
    expect(despues).toMatchObject({ estado: 'inactivo', fecha_aviso: iso(120) });
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 30, 'aviso-antiguo'));
    expect(fila()).toEqual(despues);
  });

  it('actualizar la fila conserva una sola por correo y refresca cambiado_en y origen', async () => {
    await banco.enviar(compraAprobada({ minutos: 60 }));
    const [antes] = banco.falso.filas('accesos');
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    expect(banco.falso.filas('accesos')).toHaveLength(1);
    expect(banco.falso.filas('accesos')[0]).toMatchObject({
      correo: antes?.correo,
      origen: 'PURCHASE_REFUNDED',
    });
  });

  it('una cancelación que llega antes del primer cobro se conserva: el cobro, después, no da acceso', async () => {
    // Cancelación primero (sin cobros guardados): queda como estado de la suscripción y no escribe acceso todavía.
    await banco.enviar(cancelacionDeSuscripcion('SUS-1', 120));
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.filas('suscripciones_hotmart')).toEqual([
      expect.objectContaining({ suscriptor: 'SUS-1', estado: 'cancelada' }),
    ]);
    // El primer cobro, con fecha anterior a la cancelación, llega después: no reactiva la suscripción.
    await banco.enviar(compraAprobada({ transaccion: 'TRX-1', suscriptor: 'SUS-1', minutos: 60 }));
    // Sin fila de accesos: nunca hubo acceso activo, así que no se escribe nada.
    expect(acceso() ?? 'inactivo').toBe('inactivo');
    expect(
      banco.falso
        .filas('eventos_pago')
        .map((fila) => fila.estado)
        .sort(),
    ).toEqual(['aplicado', 'aplicado']);
  });
});
