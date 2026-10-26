// Análisis puro de los avisos de Hotmart (supabase/functions/_shared/hotmart.ts). Sin red ni base. Los identificadores y
// correos son inventados (dominio .test). Usa Web Crypto (crypto.subtle) y lee los módulos como texto.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  analizarAviso,
  correoDelComprador,
  EVENTO_CANCELACION_SUSCRIPCION,
  fechaDelAviso,
  OFERTAS_HOTMART,
  planDeOferta,
  tokenDelAviso,
  tokenHotmartValido,
  type Clasificado,
} from '../functions/_shared/hotmart.ts';
import {
  AHORA,
  compraAprobada,
  CORREO,
  minuto,
  OFERTAS_PRUEBA,
  reembolso,
  cancelacionDeSuscripcion,
} from './ayudas-hotmart.ts';

/** Analiza un objeto como si hubiera llegado tal cual, con las ofertas de prueba y la hora fija de las pruebas. */
const analizar = (cuerpo: unknown): Clasificado =>
  analizarAviso(cuerpo, { ahoraMs: AHORA, ofertas: OFERTAS_PRUEBA });

describe('fecha del aviso (creation_date): obligatoria', () => {
  it('acepta milisegundos como número y los convierte a ISO en UTC', () => {
    expect(fechaDelAviso({ creation_date: minuto(60) }, AHORA)).toBe('2026-10-24T01:00:00.000Z');
  });

  it('acepta milisegundos como texto de dígitos', () => {
    expect(fechaDelAviso({ creation_date: String(minuto(60)) }, AHORA)).toBe(
      '2026-10-24T01:00:00.000Z',
    );
  });

  it('acepta un ISO con zona horaria y lo lleva a UTC', () => {
    expect(fechaDelAviso({ creation_date: '2026-10-24T01:00:00.000Z' }, AHORA)).toBe(
      '2026-10-24T01:00:00.000Z',
    );
    expect(fechaDelAviso({ creation_date: '2026-10-23T20:00:00-05:00' }, AHORA)).toBe(
      '2026-10-24T01:00:00.000Z',
    );
  });

  it('rechaza un ISO sin zona horaria: es ambiguo', () => {
    expect(fechaDelAviso({ creation_date: '2026-10-24T01:00:00' }, AHORA)).toBeNull();
    expect(fechaDelAviso({ creation_date: '2026-10-24' }, AHORA)).toBeNull();
  });

  it('rechaza segundos en lugar de milisegundos, y fechas anteriores a 2010', () => {
    expect(fechaDelAviso({ creation_date: Math.floor(minuto(60) / 1000) }, AHORA)).toBeNull();
    expect(fechaDelAviso({ creation_date: Date.UTC(2009, 11, 31) }, AHORA)).toBeNull();
    expect(fechaDelAviso({ creation_date: 0 }, AHORA)).toBeNull();
  });

  it('rechaza una fecha de más de un día en el futuro (bloquearía los avisos legítimos); un margen pequeño sí vale', () => {
    expect(fechaDelAviso({ creation_date: AHORA + 60 * 60 * 1000 }, AHORA)).not.toBeNull();
    expect(fechaDelAviso({ creation_date: AHORA + 25 * 60 * 60 * 1000 }, AHORA)).toBeNull();
    expect(fechaDelAviso({ creation_date: Date.UTC(2100, 0, 1) }, AHORA)).toBeNull();
  });

  it('rechaza lo que no es una fecha: ausente, nulo, objeto, texto libre, NaN, infinito', () => {
    for (const valor of [
      undefined,
      null,
      {},
      [],
      'ayer',
      '',
      'NaN',
      Number.NaN,
      Number.POSITIVE_INFINITY,
      true,
    ]) {
      expect(fechaDelAviso({ creation_date: valor }, AHORA), String(valor)).toBeNull();
    }
    expect(fechaDelAviso({}, AHORA)).toBeNull();
    expect(fechaDelAviso(null, AHORA)).toBeNull();
    expect(fechaDelAviso('texto', AHORA)).toBeNull();
  });
});

describe('análisis del aviso', () => {
  it('una compra aprobada con fecha y datos completos se clasifica con su plan, su correo y su fecha', () => {
    const resultado = analizar(compraAprobada({ suscriptor: 'SUS-1' }));
    expect(resultado).toEqual({
      resultado: 'compra-aprobada',
      id: 'aviso-TRX-DE-PRUEBA-1-aprobada',
      evento: 'PURCHASE_APPROVED',
      fecha: '2026-10-24T01:00:00.000Z',
      compra: {
        idTransaccion: 'TRX-DE-PRUEBA-1',
        plan: 'mensual',
        montoUsd: 5.99,
        comisionUsd: 0.3,
        suscriptor: 'SUS-1',
        correo: CORREO,
      },
    });
  });

  it('el plan anual se reconoce por el código de su oferta', () => {
    const resultado = analizar(compraAprobada({ oferta: OFERTAS_PRUEBA.anual, monto: 59.9 }));
    expect(resultado.resultado === 'compra-aprobada' && resultado.compra.plan).toBe('anual');
  });

  it('sin fecha, la compra aprobada se rechaza: sin-fecha, aunque lo demás esté bien', () => {
    const { creation_date: _omitida, ...sinFecha } = compraAprobada();
    expect(analizar(sinFecha)).toEqual({
      resultado: 'sin-fecha',
      id: 'aviso-TRX-DE-PRUEBA-1-aprobada',
      evento: 'PURCHASE_APPROVED',
    });
  });

  it('sin fecha válida también se rechazan el reembolso, la cancelación y los eventos desconocidos', () => {
    expect(analizar({ ...reembolso(), creation_date: 'ayer' }).resultado).toBe('sin-fecha');
    expect(analizar({ ...cancelacionDeSuscripcion('SUS-1'), creation_date: null }).resultado).toBe(
      'sin-fecha',
    );
    expect(analizar({ id: 'aviso-raro', event: 'EVENTO_INVENTADO' }).resultado).toBe('sin-fecha');
  });

  it('un cuerpo que no es un objeto no tiene identificador: sin-id, aunque tenga fecha', () => {
    for (const cuerpo of [null, [], 'texto roto', 42]) {
      expect(analizar(cuerpo)).toEqual({ resultado: 'sin-id', id: '', evento: 'desconocido' });
    }
    expect(analizar({ creation_date: minuto(60), event: 'PURCHASE_APPROVED' }).resultado).toBe(
      'sin-id',
    );
  });

  it('un aviso repetido se clasifica igual: el análisis no tiene estado ni reloj', () => {
    const aviso = compraAprobada({ suscriptor: 'SUS-1' });
    expect(analizar(aviso)).toEqual(analizar(structuredClone(aviso)));
  });

  it('un aviso con fecha pero sin tipo de evento es formato-no-reconocido', () => {
    expect(analizar({ id: 'aviso-sin-tipo', creation_date: minuto(60) })).toEqual({
      resultado: 'formato-no-reconocido',
      id: 'aviso-sin-tipo',
      evento: 'desconocido',
      fecha: '2026-10-24T01:00:00.000Z',
    });
  });

  it('un aviso sin identificador se rechaza sin guardar: sin-id, con fecha y tipo correctos', () => {
    const { id: _omitido, ...sinId } = compraAprobada();
    expect(analizar(sinId).resultado).toBe('sin-id');
  });

  it('un tipo que la plantilla no conoce es no-procesado; PURCHASE_BILLET_PRINTED queda solo registrado', () => {
    expect(
      analizar({ id: 'aviso-raro', creation_date: minuto(60), event: 'EVENTO_INVENTADO' }),
    ).toMatchObject({ resultado: 'no-procesado', evento: 'EVENTO_INVENTADO' });
    expect(
      analizar({ id: 'aviso-ticket', creation_date: minuto(60), event: 'PURCHASE_BILLET_PRINTED' }),
    ).toMatchObject({ resultado: 'registrado', evento: 'PURCHASE_BILLET_PRINTED' });
  });

  it('reembolso y cancelación solo necesitan el identificador de la transacción y llevan su fecha', () => {
    expect(analizar(reembolso('TRX-9', 120, 'aviso-reembolso'))).toEqual({
      resultado: 'compra-estado',
      id: 'aviso-reembolso',
      evento: 'PURCHASE_REFUNDED',
      fecha: '2026-10-24T02:00:00.000Z',
      estado: 'reembolsada',
      idTransaccion: 'TRX-9',
      suscriptor: null,
      ultimoCobro: 'otro',
    });
    const cancelada = analizar({
      id: 'aviso-cancelada',
      creation_date: minuto(120),
      event: 'PURCHASE_CANCELED',
      data: { purchase: { transaction: 'TRX-9' } },
    });
    expect(cancelada.resultado === 'compra-estado' && cancelada.estado).toBe('cancelada');
  });

  it('purchase.status manda sobre el evento: OVERDUE de un cobro es mantenida con último cobro impago; APPROVED de status es aprobada', () => {
    const atrasada = analizar({
      id: 'aviso-atrasada',
      creation_date: minuto(60),
      event: 'PURCHASE_DELAYED',
      data: {
        purchase: { transaction: 'TRX-7', status: 'OVERDUE' },
        subscription: { subscriber: { code: 'SUS-7' } },
      },
    });
    expect(atrasada).toMatchObject({
      resultado: 'compra-estado',
      estado: 'mantenida',
      suscriptor: 'SUS-7',
      ultimoCobro: 'impago',
    });
    const estadoDesconocido = analizar({
      id: 'aviso-raro-estado',
      creation_date: minuto(60),
      event: 'PURCHASE_APPROVED',
      data: { purchase: { transaction: 'TRX-7', status: 'ESTADO_INVENTADO' } },
    });
    expect(estadoDesconocido.resultado).toBe('no-procesado');
  });

  it('un reembolso sin identificador de transacción es rechazado, no adivinado', () => {
    expect(
      analizar({
        id: 'aviso-reembolso-2',
        creation_date: minuto(60),
        event: 'PURCHASE_REFUNDED',
        data: {},
      }).resultado,
    ).toBe('rechazado');
  });

  it('una cancelación de suscripción lleva su suscriptor; sin él, suscriptor nulo', () => {
    const con = analizar(cancelacionDeSuscripcion('SUS-1', 120, 'aviso-cancelacion-1'));
    expect(con).toEqual({
      resultado: 'cancelacion-suscripcion',
      id: 'aviso-cancelacion-1',
      evento: EVENTO_CANCELACION_SUSCRIPCION,
      fecha: '2026-10-24T02:00:00.000Z',
      suscriptor: 'SUS-1',
      fechaProximoCobro: null,
    });
    const sin = analizar(cancelacionDeSuscripcion(null));
    expect(sin.resultado === 'cancelacion-suscripcion' && sin.suscriptor).toBeNull();
  });
});

describe('compra aprobada: datos que faltan o no valen', () => {
  const conCompra = (purchase: Record<string, unknown>) => ({
    ...compraAprobada(),
    data: { purchase, buyer: { email: CORREO } },
  });

  it('sin identificador de transacción es rechazada', () => {
    expect(
      analizar(
        conCompra({
          offer: { code: OFERTAS_PRUEBA.mensual },
          price: { value: 5.99, currency_code: 'USD' },
        }),
      ).resultado,
    ).toBe('rechazado');
  });

  it('sin precio numérico, sin divisa o sin oferta es rechazada', () => {
    const base = {
      transaction: 'TRX-1',
      offer: { code: OFERTAS_PRUEBA.mensual },
      price: { value: 5.99, currency_code: 'USD' },
    };
    expect(analizar(conCompra({ ...base, price: { currency_code: 'USD' } })).resultado).toBe(
      'rechazado',
    );
    expect(
      analizar(conCompra({ ...base, price: { value: '5.99', currency_code: 'USD' } })).resultado,
    ).toBe('rechazado');
    expect(analizar(conCompra({ ...base, price: { value: 5.99 } })).resultado).toBe('rechazado');
    expect(analizar(conCompra({ ...base, offer: {} })).resultado).toBe('rechazado');
  });

  it('un importe negativo o absurdo es rechazado, para que no rompa la columna numeric(10,2)', () => {
    const base = { transaction: 'TRX-1', offer: { code: OFERTAS_PRUEBA.mensual } };
    expect(
      analizar(conCompra({ ...base, price: { value: -1, currency_code: 'USD' } })).resultado,
    ).toBe('rechazado');
    expect(
      analizar(conCompra({ ...base, price: { value: 1e12, currency_code: 'USD' } })).resultado,
    ).toBe('rechazado');
  });

  it('un precio que no viene en dólares no se guarda como compra en USD', () => {
    expect(analizar(compraAprobada({ monto: 29.9, divisa: 'BRL' })).resultado).toBe(
      'divisa-no-usd',
    );
  });

  it('una oferta desconocida da sin-plan, sin inventar un plan', () => {
    expect(analizar(compraAprobada({ oferta: 'oferta-que-no-existe' })).resultado).toBe('sin-plan');
  });

  it('con los marcadores de OFERTAS_HOTMART sin sustituir, ninguna oferta se reconoce, ni siquiera el propio marcador', () => {
    expect(OFERTAS_HOTMART.mensual).toContain('[COMPLETAR');
    expect(OFERTAS_HOTMART.anual).toContain('[COMPLETAR');
    expect(planDeOferta('oferta-de-prueba')).toBeNull();
    expect(planDeOferta(OFERTAS_HOTMART.mensual)).toBeNull();
    expect(planDeOferta(OFERTAS_HOTMART.anual)).toBeNull();
    expect(analizarAviso(compraAprobada(), { ahoraMs: AHORA }).resultado).toBe('sin-plan');
  });

  it('sin correo del comprador no hay compra ni acceso: sin-correo', () => {
    expect(analizar(compraAprobada({ correo: null })).resultado).toBe('sin-correo');
    for (const correo of [
      '',
      '   ',
      'no-es-un-correo',
      'a@b',
      'dos@@ejemplo.test',
      'con espacio@ejemplo.test',
    ]) {
      expect(analizar(compraAprobada({ correo })).resultado, correo).toBe('sin-correo');
    }
  });

  it('el correo se guarda en minúsculas y sin espacios alrededor', () => {
    expect(correoDelComprador({ data: { buyer: { email: '  Comprador@Ejemplo.TEST ' } } })).toBe(
      'comprador@ejemplo.test',
    );
    const resultado = analizar(compraAprobada({ correo: 'COMPRADOR@Ejemplo.test' }));
    expect(resultado.resultado === 'compra-aprobada' && resultado.compra.correo).toBe(CORREO);
  });

  it('la comisión es opcional: sin ella (o inválida) no se manda', () => {
    const { commissions: _omitidas, ...datos } = compraAprobada().data;
    const resultado = analizar({ ...compraAprobada(), data: datos });
    expect(resultado.resultado === 'compra-aprobada' && 'comisionUsd' in resultado.compra).toBe(
      false,
    );
    const invalida = analizar({
      ...compraAprobada(),
      data: { ...datos, commissions: [{ commission_as: 'PRODUCER', value: -3 }] },
    });
    expect(invalida.resultado === 'compra-aprobada' && 'comisionUsd' in invalida.compra).toBe(
      false,
    );
  });
});

describe('token del aviso: comparación en tiempo constante', () => {
  it('acepta el token exacto y rechaza cualquier otro', async () => {
    expect(await tokenHotmartValido('token-de-prueba-123', 'token-de-prueba-123')).toBe(true);
    expect(await tokenHotmartValido('token-de-prueba-124', 'token-de-prueba-123')).toBe(false);
    expect(await tokenHotmartValido('token-de-prueba-123-extra', 'token-de-prueba-123')).toBe(
      false,
    );
    expect(await tokenHotmartValido('token-de-prueba', 'token-de-prueba-123')).toBe(false);
    expect(await tokenHotmartValido('TOKEN-DE-PRUEBA-123', 'token-de-prueba-123')).toBe(false);
  });

  it('acepta tokens con caracteres no ASCII sin confundirlos', async () => {
    expect(await tokenHotmartValido('clave-ñandú', 'clave-ñandú')).toBe(true);
    expect(await tokenHotmartValido('clave-nandu', 'clave-ñandú')).toBe(false);
  });

  it('sin token recibido o sin token configurado, nunca es válido', async () => {
    expect(await tokenHotmartValido(null, 'token-de-prueba-123')).toBe(false);
    expect(await tokenHotmartValido(undefined, 'token-de-prueba-123')).toBe(false);
    expect(await tokenHotmartValido('', 'token-de-prueba-123')).toBe(false);
    expect(await tokenHotmartValido('token-de-prueba-123', '')).toBe(false);
    expect(await tokenHotmartValido('', '')).toBe(false);
  });

  it('el token viene solo de la cabecera x-hotmart-hottok: vacía o ausente, no hay token', () => {
    expect(tokenDelAviso('token-de-prueba-123')).toBe('token-de-prueba-123');
    expect(tokenDelAviso('  token-de-prueba-123  ')).toBe('token-de-prueba-123');
    expect(tokenDelAviso(null)).toBeNull();
    expect(tokenDelAviso('')).toBeNull();
    expect(tokenDelAviso('   ')).toBeNull();
  });

  it('un campo hottok en el cuerpo NO sustituye a la cabecera: sin cabecera, el token es nulo y el aviso se rechaza', async () => {
    // tokenDelAviso ya no recibe el cuerpo: no hay forma de que un hottok del cuerpo llegue a la comparación.
    expect(tokenDelAviso.length).toBe(1);
    expect(await tokenHotmartValido(tokenDelAviso(null), 'token-de-prueba-123')).toBe(false);
  });

  it('si la cabecera trae un valor equivocado, no hay rescate: la comparación falla', async () => {
    const token = tokenDelAviso('token-equivocado');
    expect(token).toBe('token-equivocado');
    expect(await tokenHotmartValido(token, 'token-de-prueba-123')).toBe(false);
  });
});

describe('los módulos de _shared son puros: sin API de Deno, sin npm: y sin node:', () => {
  for (const archivo of ['hotmart.ts', 'acceso.ts', 'rest.ts']) {
    it(`${archivo} no importa nada externo ni usa Deno`, () => {
      const fuente = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '..', 'functions', '_shared', archivo),
        'utf8',
      );
      // Se quitan los comentarios: pueden nombrar Deno o node: para explicar por qué no se usan.
      const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(codigo).not.toMatch(/\bDeno\b/);
      expect(codigo).not.toMatch(/['"](?:npm|node|jsr):/);
      expect(codigo).not.toMatch(/\brequire\(/);
      // Los únicos imports permitidos son relativos.
      for (const coincidencia of codigo.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        expect(coincidencia[1], `${archivo} importa ${coincidencia[1]}`).toMatch(/^\.\.?\//);
      }
    });
  }
});
