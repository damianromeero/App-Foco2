// Orden de los avisos de Hotmart: solo cambia un estado si el aviso es MÁS RECIENTE que el guardado (fecha_aviso). Reembolsos,
// cancelaciones, suscripciones y avisos repetidos o fuera de orden, con el Supabase falso de ayudas-hotmart.ts.
// Las fechas se dan en minutos desde la medianoche del día de las pruebas (la compra aprobada se crea en el minuto 60).
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cancelacionDeCompra,
  cancelacionDeSuscripcion,
  compraAprobada,
  CORREO,
  crearBanco,
  minuto,
  reembolso,
} from './ayudas-hotmart.ts';

let banco: ReturnType<typeof crearBanco>;
beforeEach(() => {
  banco = crearBanco();
});

const iso = (minutos: number) => new Date(minuto(minutos)).toISOString();
const estadoDeEnvio = async (promesa: Promise<Response>) =>
  ((await promesa).json() as Promise<{ ok: boolean; estado: string }>).then((c) => c.estado);
const compra = (id = 'TRX-DE-PRUEBA-1') => banco.falso.tablas.compras.get(id);
const acceso = (correo = CORREO) => banco.falso.tablas.accesos.get(correo)?.estado;

describe('reembolso o cancelación de una compra', () => {
  beforeEach(async () => {
    await banco.enviar(compraAprobada({ minutos: 60 }));
  });

  it('un reembolso MÁS RECIENTE que el guardado cambia la compra y quita el acceso', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120)))).toBe('aplicado');
    expect(compra()).toMatchObject({ estado: 'reembolsada', fecha_aviso: iso(120) });
    expect(acceso()).toBe('inactivo');
  });

  it('envía la condición de fecha a la base: PATCH con id_hotmart=eq.X y fecha_aviso=lt.<fecha del aviso>', async () => {
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    const parche = banco.falso.llamadas
      .filter((llamada) => llamada.metodo === 'PATCH' && llamada.ruta === '/rest/v1/compras')
      .at(-1);
    expect(parche?.busqueda.get('id_hotmart')).toBe('eq.TRX-DE-PRUEBA-1');
    expect(parche?.busqueda.get('fecha_aviso')).toBe(`lt.${iso(120)}`);
    expect(parche?.cuerpo).toEqual({ estado: 'reembolsada', fecha_aviso: iso(120) });
  });

  it('un reembolso MÁS ANTIGUO que el guardado no cambia nada: obsoleto, y la compra sigue aprobada con acceso', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 30)))).toBe('obsoleto');
    expect(compra()).toMatchObject({ estado: 'aprobada', fecha_aviso: iso(60) });
    expect(acceso()).toBe('activo');
  });

  it('un reembolso con la MISMA fecha que lo guardado tampoco cambia nada', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 60)))).toBe('obsoleto');
    expect(compra()?.estado).toBe('aprobada');
  });

  it('un reembolso repetido responde 200 y no cambia nada más: el segundo queda obsoleto y la fila del evento es una', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120)))).toBe('aplicado');
    const altasDeCompra = banco.falso
      .escriturasA('compras')
      .filter((llamada) => llamada.metodo === 'POST').length;
    const accesoAntes = structuredClone(banco.falso.filas('accesos'));
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120)))).toBe('obsoleto');
    expect(compra()).toMatchObject({ estado: 'reembolsada', fecha_aviso: iso(120) });
    expect(acceso()).toBe('inactivo');
    // Un reembolso nunca inserta compras, y la fila de acceso va condicionada por fecha: no cambia.
    expect(banco.falso.filas('accesos')).toEqual(accesoAntes);
    expect(
      banco.falso.escriturasA('compras').filter((llamada) => llamada.metodo === 'POST'),
    ).toHaveLength(altasDeCompra);
    expect(
      banco.falso
        .filas('eventos_pago')
        .filter((fila) => fila.id_evento === 'aviso-TRX-DE-PRUEBA-1-reembolso-120'),
    ).toHaveLength(1);
  });

  it('un reembolso de una compra que no existe es sin-compra', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-QUE-NO-EXISTE', 120)))).toBe(
      'sin-compra',
    );
    expect(banco.falso.filas('compras')).toHaveLength(1);
    expect(acceso()).toBe('activo');
  });

  it('distingue sin-compra de obsoleto: la compra existe pero el aviso es más antiguo, o no existe', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 10, 'a1')))).toBe(
      'obsoleto',
    );
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-OTRA', 10, 'a2')))).toBe('sin-compra');
  });

  it('una cancelación de la compra más reciente la deja cancelada y sin acceso', async () => {
    expect(await estadoDeEnvio(banco.enviar(cancelacionDeCompra('TRX-DE-PRUEBA-1', 90)))).toBe(
      'aplicado',
    );
    expect(compra()).toMatchObject({ estado: 'cancelada', fecha_aviso: iso(90) });
    expect(acceso()).toBe('inactivo');
  });

  it('una compra aprobada que llega DESPUÉS de su reembolso (reenvío tardío) nunca vuelve a aprobada', async () => {
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    const reenvio = await banco.enviar(
      compraAprobada({ minutos: 60, id: 'aviso-reenviado-tarde' }),
    );
    expect(reenvio.status).toBe(200);
    expect(await reenvio.json()).toEqual({ ok: true, estado: 'duplicado' });
    expect(compra()).toMatchObject({ estado: 'reembolsada', fecha_aviso: iso(120) });
    expect(acceso()).toBe('inactivo');
  });

  it('una compra aprobada con fecha MÁS RECIENTE que su reembolso tampoco la reactiva', async () => {
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    await banco.enviar(compraAprobada({ minutos: 300, id: 'aviso-aprobada-posterior' }));
    expect(compra()?.estado).toBe('reembolsada');
    expect(acceso()).toBe('inactivo');
  });

  it('un reembolso seguido de una cancelación más reciente: gana el más reciente, sin acceso en ambos casos', async () => {
    await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120));
    expect(await estadoDeEnvio(banco.enviar(cancelacionDeCompra('TRX-DE-PRUEBA-1', 150)))).toBe(
      'aplicado',
    );
    expect(compra()?.estado).toBe('cancelada');
    expect(acceso()).toBe('inactivo');
  });

  it('los avisos de reembolso y de cancelación llegan fuera de orden: el estado final es el del más reciente', async () => {
    await banco.enviar(cancelacionDeCompra('TRX-DE-PRUEBA-1', 150));
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120)))).toBe('obsoleto');
    expect(compra()?.estado).toBe('cancelada');
  });

  it('un aviso obsoleto vuelve a calcular el acceso: un reembolso aplicado a medias y reintentado termina de quitarlo', async () => {
    banco.falso.fallar('PATCH accesos', 500);
    expect((await banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120))).status).toBe(500);
    // La compra ya quedó reembolsada, pero el acceso sigue activo porque no se pudo escribir.
    expect(compra()?.estado).toBe('reembolsada');
    expect(acceso()).toBe('activo');

    banco.falso.repararFallos();
    // Hotmart reintenta el mismo aviso: el PATCH ya no cambia nada (obsoleto), pero el acceso se corrige.
    expect(await estadoDeEnvio(banco.enviar(reembolso('TRX-DE-PRUEBA-1', 120)))).toBe('obsoleto');
    expect(acceso()).toBe('inactivo');
  });
});

describe('suscripciones: motivo de la cancelación y reactivación según la regla', () => {
  const suscripcion = (suscriptor = 'SUS-1') =>
    banco.falso.tablas.suscripciones_hotmart.get(suscriptor);
  const cancelacion = (suscriptor: string, minutos: number, proximoMinutos?: number) => {
    const aviso = cancelacionDeSuscripcion(suscriptor, minutos);
    return proximoMinutos === undefined
      ? aviso
      : { ...aviso, data: { ...aviso.data, date_next_charge: minuto(proximoMinutos) } };
  };

  it('el primer cobro crea la suscripción activa con su fecha, su último cobro aprobado y acceso sin fin', async () => {
    await banco.enviar(compraAprobada({ minutos: 60, suscriptor: 'SUS-1' }));
    expect(suscripcion()).toMatchObject({
      estado: 'activa',
      fecha_aviso: iso(60),
      ultimo_cobro: 'aprobado',
      fecha_cobro: iso(60),
    });
    expect(acceso()).toBe('activo');
  });

  it('una renovación más reciente adelanta la fecha; una más antigua no la retrocede', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-R1', minutos: 60, suscriptor: 'SUS-1' }));
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-R2', minutos: 600, suscriptor: 'SUS-1' }),
    );
    expect(suscripcion()).toMatchObject({ fecha_cobro: iso(600), fecha_aviso: iso(600) });
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-R3', minutos: 300, suscriptor: 'SUS-1' }),
    );
    expect(suscripcion()).toMatchObject({ fecha_cobro: iso(600), fecha_aviso: iso(600) });
  });

  it('cancelación VOLUNTARIA con date_next_charge futuro: el acceso sigue hasta esa fecha (acceso_hasta)', async () => {
    await banco.enviar(compraAprobada({ minutos: 60, suscriptor: 'SUS-1' }));
    expect(await estadoDeEnvio(banco.enviar(cancelacion('SUS-1', 120, 900)))).toBe('aplicado');
    expect(suscripcion()).toMatchObject({
      estado: 'cancelada',
      acceso_hasta: iso(900),
    });
    expect(acceso()).toBe('activo');
    expect(banco.falso.tablas.accesos.get(CORREO)).toMatchObject({ acceso_hasta: iso(900) });
    expect(compra()?.estado).toBe('aprobada');
  });

  it('cancelación voluntaria cuyo date_next_charge ya pasó: sin acceso también en la fila', async () => {
    await banco.enviar(compraAprobada({ minutos: 60, suscriptor: 'SUS-1' }));
    await banco.enviar(cancelacion('SUS-1', 120, 200));
    expect(acceso()).toBe('inactivo');
  });

  it('cancelación POR IMPAGO tras OVERDUE: sin acceso de inmediato y la cuenta y las compras se conservan', async () => {
    await banco.enviar(compraAprobada({ minutos: 60, suscriptor: 'SUS-1' }));
    expect(
      await estadoDeEnvio(
        banco.enviar({
          id: 'aviso-atrasada',
          creation_date: minuto(90),
          event: 'PURCHASE_DELAYED',
          data: {
            purchase: { transaction: 'TRX-DE-PRUEBA-1', status: 'OVERDUE' },
            subscription: { subscriber: { code: 'SUS-1' } },
          },
        }),
      ),
    ).toBe('aplicado');
    expect(compra()).toMatchObject({ estado: 'mantenida' });
    expect(acceso()).toBe('activo');
    expect(suscripcion()).toMatchObject({ ultimo_cobro: 'impago' });

    await banco.enviar(cancelacion('SUS-1', 120, 900));
    expect(suscripcion()).toMatchObject({
      estado: 'cancelada',
      ultimo_cobro: 'impago',
    });
    // Sin motivo guardado: el impago sale de ultimo_cobro y no da acceso aunque acceso_hasta tenga fecha.
    expect(acceso()).toBe('inactivo');
    expect(compra()).toBeDefined();
    expect(banco.falso.usuarios.has(CORREO)).toBe(true);
  });

  it('una cancelación MÁS ANTIGUA que el último cobro es obsoleta: la suscripción sigue activa y con acceso', async () => {
    await banco.enviar(compraAprobada({ minutos: 300, suscriptor: 'SUS-1' }));
    expect(await estadoDeEnvio(banco.enviar(cancelacion('SUS-1', 60)))).toBe('obsoleto');
    expect(suscripcion()).toMatchObject({ estado: 'activa' });
    expect(acceso()).toBe('activo');
  });

  it('una cancelación repetida (misma fecha) responde obsoleto y no cambia nada', async () => {
    await banco.enviar(compraAprobada({ minutos: 60, suscriptor: 'SUS-1' }));
    await banco.enviar(cancelacion('SUS-1', 120, 900));
    expect(await estadoDeEnvio(banco.enviar(cancelacion('SUS-1', 120, 900)))).toBe('obsoleto');
    expect(suscripcion()).toMatchObject({
      estado: 'cancelada',
      acceso_hasta: iso(900),
    });
  });

  it('REACTIVACIÓN: un cobro aprobado posterior a la cancelación restaura la suscripción y el acceso sin fin', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-R1', minutos: 60, suscriptor: 'SUS-1' }));
    await banco.enviar(cancelacion('SUS-1', 120, 900));
    expect(acceso()).toBe('activo');
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-R2', minutos: 180, suscriptor: 'SUS-1' }),
    );
    expect(suscripcion()).toMatchObject({
      estado: 'activa',
      acceso_hasta: null,
      fecha_aviso: iso(180),
    });
    expect(acceso()).toBe('activo');
    expect(banco.falso.tablas.accesos.get(CORREO)).toMatchObject({ acceso_hasta: null });
  });

  it('un cobro ANTERIOR a una cancelación ya aplicada no la reactiva', async () => {
    await banco.enviar(compraAprobada({ transaccion: 'TRX-R1', minutos: 60, suscriptor: 'SUS-1' }));
    await banco.enviar(cancelacion('SUS-1', 200, 900));
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-R2', minutos: 120, suscriptor: 'SUS-1' }),
    );
    expect(suscripcion()).toMatchObject({ estado: 'cancelada' });
  });

  it('cancelar antes del primer cobro deja la cancelación guardada; un primer cobro POSTERIOR la reactiva', async () => {
    await banco.enviar(cancelacion('SUS-NUEVA', 60, 900));
    expect(suscripcion('SUS-NUEVA')).toMatchObject({ estado: 'cancelada' });
    await banco.enviar(
      compraAprobada({ transaccion: 'TRX-N1', minutos: 120, suscriptor: 'SUS-NUEVA' }),
    );
    expect(suscripcion('SUS-NUEVA')).toMatchObject({ estado: 'activa', acceso_hasta: null });
  });

  it('una cancelación sin identificador de suscriptor es sin-suscripcion y no toca nada', async () => {
    expect(await estadoDeEnvio(banco.enviar(cancelacionDeSuscripcion(null)))).toBe(
      'sin-suscripcion',
    );
    expect(banco.falso.filas('suscripciones_hotmart')).toEqual([]);
  });

  it('envía la condición de fecha a la base: PATCH con suscriptor=eq.X y fecha_aviso=lt.<fecha del aviso>', async () => {
    await banco.enviar(compraAprobada({ minutos: 60, suscriptor: 'SUS-1' }));
    await banco.enviar(cancelacion('SUS-1', 120, 900));
    const parche = banco.falso.llamadas
      .filter(
        (llamada) =>
          llamada.metodo === 'PATCH' && llamada.ruta === '/rest/v1/suscripciones_hotmart',
      )
      .at(-1);
    expect(parche?.busqueda.get('suscriptor')).toBe('eq.SUS-1');
    expect(parche?.busqueda.get('fecha_aviso')).toBe(`lt.${iso(120)}`);
  });
});

describe('fechas con formatos distintos se comparan como instantes, no como texto', () => {
  it('una fecha en ISO con otra zona horaria se compara bien con la guardada', async () => {
    await banco.enviar(compraAprobada({ minutos: 60 })); // 01:00 UTC
    // 2026-10-23T21:30:00-05:00 = 02:30 UTC: más reciente que 01:00 UTC aunque «21:30» sea menor que «01:00» como texto.
    const respuesta = await banco.enviar({
      ...reembolso('TRX-DE-PRUEBA-1', 0),
      creation_date: '2026-10-23T21:30:00-05:00',
    });
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'aplicado' });
    expect(compra()).toMatchObject({
      estado: 'reembolsada',
      fecha_aviso: '2026-10-24T02:30:00.000Z',
    });
  });
});

describe('reembolso o cancelación que llega ANTES que su compra: la compra nace con ese estado', () => {
  const TRX = 'TRX-PREVIA-1';
  const previa = () => banco.falso.tablas.compras_finales_previas.get(TRX);
  const compraDe = (minutos = 60, suscriptor?: string) =>
    banco.enviar(compraAprobada({ transaccion: TRX, minutos, suscriptor }));

  it('reembolso primero y compra después: la compra nace reembolsada y sin acceso', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso(TRX, 120)))).toBe('sin-compra');
    expect(previa()).toMatchObject({
      estado: 'reembolsada',
      fecha_aviso: iso(120),
      origen: 'PURCHASE_REFUNDED',
    });
    expect(banco.falso.tablas.compras.get(TRX)).toBeUndefined();

    expect(await estadoDeEnvio(compraDe(60))).toBe('aplicado');
    expect(compra(TRX)).toMatchObject({ estado: 'reembolsada', fecha_aviso: iso(120) });
    expect(acceso() ?? 'inactivo').toBe('inactivo');
  });

  it('cancelación primero y compra después: la compra nace cancelada y sin acceso', async () => {
    expect(await estadoDeEnvio(banco.enviar(cancelacionDeCompra(TRX, 120)))).toBe('sin-compra');
    expect(await estadoDeEnvio(compraDe(60))).toBe('aplicado');
    expect(compra(TRX)).toMatchObject({ estado: 'cancelada' });
    expect(acceso() ?? 'inactivo').toBe('inactivo');
  });

  it('compra primero y reembolso después: el orden normal también deja sin acceso', async () => {
    await compraDe(60);
    expect(acceso()).toBe('activo');
    expect(await estadoDeEnvio(banco.enviar(reembolso(TRX, 120)))).toBe('aplicado');
    expect(compra(TRX)?.estado).toBe('reembolsada');
    expect(acceso()).toBe('inactivo');
  });

  it('una compra repetida después del reembolso previo no reactiva el acceso', async () => {
    await banco.enviar(reembolso(TRX, 120));
    await compraDe(60);
    expect(await estadoDeEnvio(compraDe(60))).toBe('duplicado');
    expect(compra(TRX)?.estado).toBe('reembolsada');
    expect(acceso() ?? 'inactivo').toBe('inactivo');
  });

  it('entre dos finales previos gana el más reciente: el antiguo llega después y queda obsoleto', async () => {
    expect(await estadoDeEnvio(banco.enviar(reembolso(TRX, 180)))).toBe('sin-compra');
    expect(await estadoDeEnvio(banco.enviar(cancelacionDeCompra(TRX, 60)))).toBe('obsoleto');
    expect(previa()).toMatchObject({ estado: 'reembolsada', fecha_aviso: iso(180) });
    await compraDe(30);
    expect(compra(TRX)?.estado).toBe('reembolsada');
    expect(acceso() ?? 'inactivo').toBe('inactivo');
  });

  it('entre dos finales previos gana el más reciente también si llega antes el más reciente', async () => {
    expect(await estadoDeEnvio(banco.enviar(cancelacionDeCompra(TRX, 60)))).toBe('sin-compra');
    expect(await estadoDeEnvio(banco.enviar(reembolso(TRX, 180)))).toBe('sin-compra');
    expect(previa()).toMatchObject({ estado: 'reembolsada', fecha_aviso: iso(180) });
  });

  it('cancelación de una suscripción antes de su primer cobro: un cobro ANTERIOR a la cancelación no da acceso', async () => {
    await banco.enviar(cancelacionDeSuscripcion('SUSC-PREVIA-1', 60));
    expect(await estadoDeEnvio(compraDe(30, 'SUSC-PREVIA-1'))).toBe('aplicado');
    expect(banco.falso.tablas.suscripciones_hotmart.get('SUSC-PREVIA-1')).toMatchObject({
      estado: 'cancelada',
    });
    expect(acceso() ?? 'inactivo').toBe('inactivo');
  });

  it('si no se puede guardar el reembolso previo, responde 500 para que Hotmart lo reintente', async () => {
    banco.falso.fallar('POST compras_finales_previas', 500);
    expect((await banco.enviar(reembolso(TRX, 120))).status).toBe(500);
  });
});
