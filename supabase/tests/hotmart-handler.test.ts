// Handler del aviso de Hotmart (supabase/functions/hotmart-aviso/handler.ts) con un Supabase falso en memoria
// (ayudas-hotmart.ts): códigos de respuesta, token, fecha obligatoria, compra aprobada y fallos de la base.
// Todo inventado: correos con dominio .test, identificadores de prueba y claves que no existen.
import { beforeEach, describe, expect, it } from 'vitest';
import { manejarAviso } from '../functions/hotmart-aviso/handler.ts';
import { NOMBRE_CLAVE_SERVICIO } from '../functions/_shared/rest.ts';
import {
  AHORA,
  CLAVE_SERVICIO,
  compraAprobada,
  CORREO,
  crearBanco,
  entornoCompleto,
  minuto,
  OFERTAS_PRUEBA,
  TOKEN,
} from './ayudas-hotmart.ts';

let banco: ReturnType<typeof crearBanco>;
beforeEach(() => {
  banco = crearBanco();
});

/** Texto completo de una respuesta, para comprobar que no filtra el correo ni el token. */
const texto = (respuesta: Response) => respuesta.clone().text();

describe('método y configuración: nada se procesa sin ellos', () => {
  it('405 si no es POST, con la cabecera Allow, y no llama a nada', async () => {
    for (const metodo of ['GET', 'PUT', 'DELETE', 'PATCH']) {
      const respuesta = await banco.enviar(compraAprobada(), { metodo });
      expect(respuesta.status, metodo).toBe(405);
      expect(respuesta.headers.get('Allow')).toBe('POST');
    }
    expect(banco.falso.llamadas).toHaveLength(0);
  });

  const variables = ['HOTMART_HOTTOK', 'SUPABASE_URL', NOMBRE_CLAVE_SERVICIO] as const;
  for (const variable of variables) {
    it(`503 si falta ${variable}, sin leer el aviso ni llamar a la base`, async () => {
      const env = { ...entornoCompleto(), [variable]: undefined };
      const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
        method: 'POST',
        headers: { 'x-hotmart-hottok': TOKEN },
        body: JSON.stringify(compraAprobada()),
      });
      const respuesta = await manejarAviso(peticion, {
        env,
        fetch: banco.falso.fetch,
        ahora: () => AHORA,
        ofertas: OFERTAS_PRUEBA,
      });
      expect(respuesta.status).toBe(503);
      expect(peticion.bodyUsed).toBe(false);
      expect(banco.falso.llamadas).toHaveLength(0);
      const cuerpo = (await respuesta.json()) as { ok: boolean; error: string; mensaje: string };
      expect(cuerpo).toMatchObject({ ok: false, error: 'sin-configuracion' });
      expect(cuerpo.mensaje).toMatch(/no está configurado/);
    });

    it(`503 también si ${variable} está vacía o solo tiene espacios`, async () => {
      for (const vacio of ['', '   ']) {
        const respuesta = await banco.enviar(compraAprobada(), {
          env: { ...entornoCompleto(), [variable]: vacio },
        });
        expect(respuesta.status).toBe(503);
      }
      expect(banco.falso.llamadas).toHaveLength(0);
    });
  }

  it('400 si el cuerpo no es JSON, y no guarda nada', async () => {
    const respuesta = await banco.enviar(null, { texto: '{roto' });
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toMatchObject({ ok: false, error: 'cuerpo-no-json' });
    expect(banco.falso.llamadas).toHaveLength(0);
  });

  it('413 si el aviso pesa más de 200 KB', async () => {
    const respuesta = await banco.enviar(null, {
      texto: JSON.stringify({ relleno: 'x'.repeat(200_001) }),
    });
    expect(respuesta.status).toBe(413);
    expect(banco.falso.llamadas).toHaveLength(0);
  });
});

describe('token: sin él no se guarda nada', () => {
  it('401 sin token (ni cabecera ni campo hottok)', async () => {
    const respuesta = await banco.enviar(compraAprobada(), { cabeceras: {} });
    expect(respuesta.status).toBe(401);
    expect(await respuesta.json()).toMatchObject({ ok: false, error: 'token-no-valido' });
    expect(banco.falso.llamadas).toHaveLength(0);
  });

  it('401 con un token distinto en la cabecera', async () => {
    const respuesta = await banco.enviar(compraAprobada(), {
      cabeceras: { 'x-hotmart-hottok': 'token-equivocado' },
    });
    expect(respuesta.status).toBe(401);
    expect(banco.falso.llamadas).toHaveLength(0);
  });

  it('un hottok en el cuerpo no sustituye a la cabecera: sin cabecera, 401 aunque el cuerpo traiga el token bueno', async () => {
    const respuesta = await banco.enviar({ ...compraAprobada(), hottok: TOKEN }, { cabeceras: {} });
    expect(respuesta.status).toBe(401);
    expect(banco.falso.llamadas).toHaveLength(0);
  });

  it('una cabecera mala no se rescata con un hottok bueno en el cuerpo', async () => {
    const respuesta = await banco.enviar(
      { ...compraAprobada(), hottok: TOKEN },
      { cabeceras: { 'x-hotmart-hottok': 'token-equivocado' } },
    );
    expect(respuesta.status).toBe(401);
    expect(banco.falso.llamadas).toHaveLength(0);
  });

  it('el token se compara antes de analizar: un aviso sin fecha y sin token es 401, no 400', async () => {
    const { creation_date: _omitida, ...sinFecha } = compraAprobada();
    const respuesta = await banco.enviar(sinFecha, { cabeceras: {} });
    expect(respuesta.status).toBe(401);
    expect(banco.falso.llamadas).toHaveLength(0);
  });
});

describe('fecha obligatoria: sin fecha válida, 400 y no cambia nada', () => {
  const sinFecha = () => {
    const { creation_date: _omitida, ...resto } = compraAprobada({ suscriptor: 'SUS-1' });
    return resto;
  };

  it('responde 400 aviso-sin-fecha con un mensaje en español', async () => {
    const respuesta = await banco.enviar(sinFecha());
    expect(respuesta.status).toBe(400);
    const cuerpo = (await respuesta.json()) as { ok: boolean; error: string; mensaje: string };
    expect(cuerpo).toMatchObject({ ok: false, error: 'aviso-sin-fecha' });
    expect(cuerpo.mensaje).toMatch(/fecha de creación/);
    expect(cuerpo.mensaje).toMatch(/No se aplicó ningún cambio/);
  });

  it('solo guarda la fila de eventos_pago con estado sin-fecha: ni compras, ni suscripciones, ni accesos, ni cuenta', async () => {
    await banco.enviar(sinFecha());
    expect(banco.falso.escrituras()).toHaveLength(1);
    expect(banco.falso.escriturasA('eventos_pago')).toHaveLength(1);
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('suscripciones_hotmart')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.usuarios.size).toBe(0);
    expect(banco.falso.filas('eventos_pago')).toEqual([
      {
        id_evento: 'sin-fecha-aviso-TRX-DE-PRUEBA-1-aprobada',
        tipo: 'PURCHASE_APPROVED',
        estado: 'sin-fecha',
        fecha_aviso: null,
      },
    ]);
  });

  it('una fecha en segundos, en el futuro lejano, texto libre o nula también se rechaza', async () => {
    for (const fecha of [Math.floor(minuto(60) / 1000), Date.UTC(2100, 0, 1), 'ayer', null, {}]) {
      const respuesta = await banco.enviar({ ...compraAprobada(), creation_date: fecha });
      expect(respuesta.status, JSON.stringify(fecha)).toBe(400);
    }
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
  });

  it('un cuerpo JSON que no es un objeto (lista, texto, número) con token válido también es sin-fecha', async () => {
    for (const cuerpo of [[], 'texto', 5, null]) {
      const respuesta = await banco.enviar(cuerpo);
      expect(respuesta.status, JSON.stringify(cuerpo)).toBe(400);
    }
    expect(banco.falso.filas('eventos_pago').every((fila) => fila.estado === 'sin-fecha')).toBe(
      true,
    );
    expect(banco.falso.filas('compras')).toEqual([]);
  });

  it('un reembolso sin fecha no cambia la compra existente', async () => {
    await banco.enviar(compraAprobada());
    const { creation_date: _omitida, ...reembolsoSinFecha } = {
      id: 'aviso-reembolso-sin-fecha',
      creation_date: 0,
      event: 'PURCHASE_REFUNDED',
      data: { purchase: { transaction: 'TRX-DE-PRUEBA-1' } },
    };
    const respuesta = await banco.enviar(reembolsoSinFecha);
    expect(respuesta.status).toBe(400);
    expect(banco.falso.filas('compras')[0]?.estado).toBe('aprobada');
    expect(banco.falso.filas('accesos')[0]?.estado).toBe('activo');
  });

  it('el mismo aviso sin fecha enviado dos veces deja una sola fila; con fecha después, se procesa y queda registrado aparte', async () => {
    await banco.enviar(sinFecha());
    await banco.enviar(sinFecha());
    expect(banco.falso.filas('eventos_pago')).toHaveLength(1);
    const { creation_date: _omitida, ...resto } = compraAprobada({ suscriptor: 'SUS-1' });
    const conFecha = await banco.enviar({ ...resto, creation_date: minuto(60) });
    expect(conFecha.status).toBe(200);
    expect(
      banco.falso
        .filas('eventos_pago')
        .map((fila) => fila.estado)
        .sort(),
    ).toEqual(['aplicado', 'sin-fecha']);
  });

  it('si la base no guarda ni la fila sin-fecha, responde 500 y no 400', async () => {
    banco.falso.fallar('POST eventos_pago', 500);
    const respuesta = await banco.enviar(sinFecha());
    expect(respuesta.status).toBe(500);
  });
});

describe('compra aprobada: crea la cuenta, la compra y el acceso', () => {
  it('200: crea el usuario de Auth, inserta la compra y activa el acceso', async () => {
    const respuesta = await banco.enviar(compraAprobada({ suscriptor: 'SUS-1' }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'aplicado' });
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store');

    expect([...banco.falso.usuarios]).toEqual([CORREO]);
    const crearUsuario = banco.falso.llamadas.find(
      (llamada) => llamada.ruta === '/auth/v1/admin/users',
    );
    expect(crearUsuario).toMatchObject({
      metodo: 'POST',
      cuerpo: { email: CORREO, email_confirm: true },
    });

    expect(banco.falso.filas('compras')).toEqual([
      {
        id_hotmart: 'TRX-DE-PRUEBA-1',
        plan: 'mensual',
        monto_usd: 5.99,
        comision_usd: 0.3,
        suscriptor: 'SUS-1',
        correo: CORREO,
        estado: 'aprobada',
        fecha_aviso: new Date(minuto(60)).toISOString(),
      },
    ]);
    expect(banco.falso.filas('suscripciones_hotmart')).toEqual([
      {
        suscriptor: 'SUS-1',
        plan: 'mensual',
        estado: 'activa',
        fecha_aviso: new Date(minuto(60)).toISOString(),
        fecha_cobro: new Date(minuto(60)).toISOString(),
        ultimo_cobro: 'aprobado',
        actualizada_en: new Date(AHORA).toISOString(),
      },
    ]);
    expect(banco.falso.filas('accesos')).toEqual([
      {
        correo: CORREO,
        estado: 'activo',
        origen: 'PURCHASE_APPROVED',
        cambiado_en: new Date(AHORA).toISOString(),
        fecha_aviso: new Date(minuto(60)).toISOString(),
        acceso_hasta: null,
      },
    ]);
  });

  it('crea la cuenta antes de guardar la compra: si Auth falla, no queda una compra sin cuenta', async () => {
    banco.falso.fallar('POST auth', 500);
    const respuesta = await banco.enviar(compraAprobada());
    expect(respuesta.status).toBe(500);
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.filas('eventos_pago')).toEqual([]);
  });

  it('un comprador que ya tiene cuenta (422 email_exists) se da por bueno', async () => {
    banco.falso.usuarios.add(CORREO);
    const respuesta = await banco.enviar(compraAprobada());
    expect(respuesta.status).toBe(200);
    expect(banco.falso.filas('compras')).toHaveLength(1);
    expect(banco.falso.filas('accesos')[0]?.estado).toBe('activo');
  });

  it('un 422 de Auth que NO es «ya existe» (correo inválido para Auth) falla con 500 y no guarda la compra', async () => {
    banco.falso.rechazarCorreo(CORREO);
    const respuesta = await banco.enviar(compraAprobada());
    expect(respuesta.status).toBe(500);
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
  });

  it('el plan anual se guarda como anual', async () => {
    await banco.enviar(compraAprobada({ oferta: OFERTAS_PRUEBA.anual, monto: 59.9 }));
    expect(banco.falso.filas('compras')[0]).toMatchObject({ plan: 'anual', monto_usd: 59.9 });
  });

  it('el correo se guarda en minúsculas', async () => {
    await banco.enviar(compraAprobada({ correo: 'Comprador@EJEMPLO.test' }));
    expect(banco.falso.filas('compras')[0]?.correo).toBe(CORREO);
    expect(banco.falso.filas('accesos')[0]?.correo).toBe(CORREO);
    expect([...banco.falso.usuarios]).toEqual([CORREO]);
  });

  it('un aviso repetido no crea otra compra ni vuelve a escribir el acceso, y queda como duplicado', async () => {
    await banco.enviar(compraAprobada());
    const accesoAntes = structuredClone(banco.falso.filas('accesos'));
    const repetido = await banco.enviar(compraAprobada());
    expect(repetido.status).toBe(200);
    expect(await repetido.json()).toEqual({ ok: true, estado: 'duplicado' });
    expect(banco.falso.filas('compras')).toHaveLength(1);
    // La escritura del acceso va condicionada por fecha: el mismo aviso no cambia la fila.
    expect(banco.falso.filas('accesos')).toEqual(accesoAntes);
    expect(banco.falso.filas('eventos_pago')).toHaveLength(1);
  });

  it('el mismo cobro reenviado con otro identificador de aviso no duplica la compra', async () => {
    await banco.enviar(compraAprobada({ id: 'aviso-a' }));
    const segundo = await banco.enviar(compraAprobada({ id: 'aviso-b' }));
    expect(await segundo.json()).toEqual({ ok: true, estado: 'duplicado' });
    expect(banco.falso.filas('compras')).toHaveLength(1);
    expect(banco.falso.filas('eventos_pago')).toHaveLength(2);
  });

  it('cada petición a la base lleva la clave de servicio como apikey y como Bearer', async () => {
    await banco.enviar(compraAprobada({ suscriptor: 'SUS-1' }));
    expect(banco.falso.llamadas.length).toBeGreaterThan(5);
    for (const llamada of banco.falso.llamadas) {
      expect(llamada.cabeceras.apikey).toBe(CLAVE_SERVICIO);
      expect(llamada.cabeceras.Authorization).toBe(`Bearer ${CLAVE_SERVICIO}`);
    }
  });

  it('eventos_pago nunca guarda el correo de la persona compradora', async () => {
    await banco.enviar(compraAprobada({ suscriptor: 'SUS-1' }));
    await banco.enviar({ ...compraAprobada({ correo: null }), id: 'aviso-sin-correo' });
    expect(JSON.stringify(banco.falso.filas('eventos_pago'))).not.toContain('ejemplo.test');
    expect(Object.keys(banco.falso.filas('eventos_pago')[0] ?? {}).sort()).toEqual([
      'estado',
      'fecha_aviso',
      'id_evento',
      'tipo',
    ]);
  });

  it('ninguna respuesta incluye el correo ni el token', async () => {
    const respuestas = [
      await banco.enviar(compraAprobada()),
      await banco.enviar(compraAprobada()),
      await banco.enviar(compraAprobada(), { cabeceras: {} }),
      await banco.enviar(compraAprobada(), { metodo: 'GET' }),
      await banco.enviar(null, { texto: '{roto' }),
      await banco.enviar({ ...compraAprobada(), creation_date: null }),
    ];
    for (const respuesta of respuestas) {
      const cuerpo = await texto(respuesta);
      expect(cuerpo).not.toContain('ejemplo.test');
      expect(cuerpo).not.toContain(TOKEN);
      expect(cuerpo).not.toContain(CLAVE_SERVICIO);
    }
  });
});

describe('avisos que se registran sin cambiar compras ni accesos (responden 200)', () => {
  const soloRegistrado = (estado: string) => {
    expect(banco.falso.filas('eventos_pago').map((fila) => fila.estado)).toEqual([estado]);
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('suscripciones_hotmart')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.usuarios.size).toBe(0);
  };

  it('compra aprobada sin correo válido: sin-correo, sin compra, sin acceso, sin cuenta', async () => {
    const respuesta = await banco.enviar(compraAprobada({ correo: null }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'sin-correo' });
    soloRegistrado('sin-correo');
  });

  it('oferta desconocida: sin-plan', async () => {
    const respuesta = await banco.enviar(compraAprobada({ oferta: 'otra-oferta' }));
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'sin-plan' });
    soloRegistrado('sin-plan');
  });

  it('precio que no es en dólares: divisa-no-usd', async () => {
    const respuesta = await banco.enviar(compraAprobada({ divisa: 'EUR' }));
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'divisa-no-usd' });
    soloRegistrado('divisa-no-usd');
  });

  it('compra con datos incompletos: rechazado', async () => {
    const aviso = compraAprobada();
    const respuesta = await banco.enviar({
      ...aviso,
      data: { ...aviso.data, purchase: { offer: aviso.data.purchase.offer } },
    });
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'rechazado' });
    soloRegistrado('rechazado');
  });

  it('evento desconocido: no-procesado; PURCHASE_BILLET_PRINTED: registrado; sin tipo: formato-no-reconocido', async () => {
    const casos: [Record<string, unknown>, string][] = [
      [{ id: 'a1', creation_date: minuto(60), event: 'EVENTO_INVENTADO' }, 'no-procesado'],
      [{ id: 'a2', creation_date: minuto(60), event: 'PURCHASE_BILLET_PRINTED' }, 'registrado'],
      [{ id: 'a3', creation_date: minuto(60) }, 'formato-no-reconocido'],
    ];
    for (const [aviso, estado] of casos) {
      const respuesta = await banco.enviar(aviso);
      expect(respuesta.status).toBe(200);
      expect(await respuesta.json()).toEqual({ ok: true, estado });
    }
    expect(banco.falso.filas('compras')).toEqual([]);
    expect(banco.falso.filas('accesos')).toEqual([]);
    expect(banco.falso.filas('eventos_pago').map((fila) => fila.fecha_aviso)).toEqual(
      Array(3).fill(new Date(minuto(60)).toISOString()),
    );
  });

  it('un aviso con marcadores de oferta sin sustituir (configuración por defecto) queda en sin-plan: no vende acceso por error', async () => {
    const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
      method: 'POST',
      headers: { 'x-hotmart-hottok': TOKEN },
      body: JSON.stringify(compraAprobada()),
    });
    const respuesta = await manejarAviso(peticion, {
      env: entornoCompleto(),
      fetch: banco.falso.fetch,
      ahora: () => AHORA,
    });
    expect(await respuesta.json()).toEqual({ ok: true, estado: 'sin-plan' });
    expect(banco.falso.filas('compras')).toEqual([]);
  });
});

describe('si la base no guarda, 500 para que Hotmart reintente (nunca 200 sin guardar)', () => {
  const fallos = [
    'POST compras',
    'POST suscripciones_hotmart',
    'GET compras',
    'GET suscripciones_hotmart',
    'PATCH accesos',
    'POST accesos',
    'POST eventos_pago',
    'POST auth',
  ];
  for (const fallo of fallos) {
    it(`500 si falla «${fallo}»`, async () => {
      banco.falso.fallar(fallo, 500);
      const respuesta = await banco.enviar(compraAprobada({ suscriptor: 'SUS-1' }));
      expect(respuesta.status).toBe(500);
      expect(await respuesta.json()).toMatchObject({ ok: false, error: 'no-guardado' });
    });
  }

  it('también con un 400 o un 409 de la base, no solo con 5xx', async () => {
    banco.falso.fallar('POST compras', 409);
    expect((await banco.enviar(compraAprobada())).status).toBe(500);
    banco.falso.fallar('POST compras', 400);
    expect((await banco.enviar(compraAprobada({ id: 'otro' }))).status).toBe(500);
  });

  it('un aviso que no se pudo registrar en eventos_pago no devuelve 200, aunque la compra ya se guardara', async () => {
    banco.falso.fallar('POST eventos_pago', 500);
    const respuesta = await banco.enviar(compraAprobada());
    expect(respuesta.status).toBe(500);
    expect(banco.falso.filas('eventos_pago')).toEqual([]);
  });

  it('el reintento de Hotmart completa lo que faltó: compra guardada pero acceso no escrito → al reintentar, queda activo', async () => {
    banco.falso.fallar('POST accesos', 500);
    expect((await banco.enviar(compraAprobada())).status).toBe(500);
    expect(banco.falso.filas('compras')).toHaveLength(1);
    expect(banco.falso.filas('accesos')).toEqual([]);

    banco.falso.repararFallos();
    const reintento = await banco.enviar(compraAprobada());
    expect(reintento.status).toBe(200);
    expect(banco.falso.filas('compras')).toHaveLength(1);
    expect(banco.falso.filas('accesos')[0]).toMatchObject({ correo: CORREO, estado: 'activo' });
    expect(banco.falso.filas('eventos_pago')).toHaveLength(1);
  });

  it('el 500 no incluye datos de la base, el correo ni la clave, y el registro del servidor tampoco', async () => {
    const mensajes: string[] = [];
    const original = console.error;
    console.error = (...argumentos: unknown[]) => void mensajes.push(argumentos.join(' '));
    try {
      banco.falso.fallar('POST compras', 500);
      const respuesta = await banco.enviar(compraAprobada());
      const cuerpo = await texto(respuesta);
      for (const secreto of ['ejemplo.test', TOKEN, CLAVE_SERVICIO, 'error de prueba']) {
        expect(cuerpo).not.toContain(secreto);
        expect(mensajes.join('\n')).not.toContain(secreto);
      }
      expect(mensajes.join('\n')).toContain('compra-no-guardada-500');
    } finally {
      console.error = original;
    }
  });

  it('si fetch lanza (red caída), también responde 500', async () => {
    const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
      method: 'POST',
      headers: { 'x-hotmart-hottok': TOKEN },
      body: JSON.stringify(compraAprobada()),
    });
    const respuesta = await manejarAviso(peticion, {
      env: entornoCompleto(),
      fetch: () => Promise.reject(new TypeError('fetch failed')),
      ahora: () => AHORA,
      ofertas: OFERTAS_PRUEBA,
    });
    expect(respuesta.status).toBe(500);
  });
});
