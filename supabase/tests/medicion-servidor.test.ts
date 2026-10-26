// Función `eventos` de la medición anónima (supabase/functions/eventos/handler.ts). El manejador recibe sus dependencias
// por parámetro, así que aquí se prueba con un `fetch` falso: sin red, sin Deno y sin base.
// Las tres pruebas de la medición: apagada (204 sin leer el cuerpo ni llamar a fetch), encendida sin Supabase (503) y
// encendida con Supabase (204 con la clave pública; false de la base → 429; fallo de la base → 502).
import { describe, expect, it, vi } from 'vitest';
import {
  crearManejadorEventos,
  MAX_CUERPO_BYTES,
  MAX_EVENTOS_POR_MINUTO,
  type DependenciasEventos,
} from '../functions/eventos/handler.ts';

const URL_PRUEBA = 'https://proyecto-de-prueba.supabase.co';
const CLAVE_PUBLICA = 'clave-publica-de-prueba-123';
const DISPOSITIVO = '3f2c9c1e-7a1b-4d7e-9b7a-2f6d1e0c9a11';
const APP_URL = 'https://mi-app.example.com';

const EVENTO = { tipo: 'portada_vista', dispositivo: DISPOSITIVO };

type FetchFalso = ReturnType<typeof crearFetch>;

/** `fetch` falso: cuenta las llamadas y responde lo que se le pida. */
function crearFetch(
  respuesta: () => Response | Promise<Response> = () => new Response('true', { status: 200 }),
) {
  return vi.fn<typeof fetch>(async () => respuesta());
}

function manejador(opciones: Partial<DependenciasEventos> = {}, falso: FetchFalso = crearFetch()) {
  const atender = crearManejadorEventos({
    medicionAnonima: true,
    supabaseUrl: URL_PRUEBA,
    anonKey: CLAVE_PUBLICA,
    fetch: falso,
    ...opciones,
  });
  return { atender, falso };
}

const peticion = (cuerpo: unknown, cabeceras: Record<string, string> = {}, metodo = 'POST') =>
  new Request('https://proyecto-de-prueba.supabase.co/functions/v1/eventos', {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body:
      metodo === 'GET' || metodo === 'OPTIONS'
        ? undefined
        : typeof cuerpo === 'string'
          ? cuerpo
          : JSON.stringify(cuerpo),
  });

describe('medición apagada (medicionAnonima = false)', () => {
  it('responde 204, no lee el cuerpo y no llama a fetch, aunque Supabase esté configurado', async () => {
    const { atender, falso } = manejador({ medicionAnonima: false });
    const entrada = peticion(EVENTO);
    const respuesta = await atender(entrada);
    expect(respuesta.status).toBe(204);
    expect(entrada.bodyUsed).toBe(false);
    expect(falso).not.toHaveBeenCalled();
  });

  it('un evento que no es válido también recibe 204 sin llegar a la base', async () => {
    const { atender, falso } = manejador({ medicionAnonima: false });
    const entrada = peticion({ tipo: 'nombre_del_usuario', dispositivo: DISPOSITIVO });
    expect((await atender(entrada)).status).toBe(204);
    expect(entrada.bodyUsed).toBe(false);
    expect(falso).not.toHaveBeenCalled();
  });

  it('responde 204 sin Supabase configurado y con cualquier método', async () => {
    const { atender, falso } = manejador({
      medicionAnonima: false,
      supabaseUrl: undefined,
      anonKey: undefined,
    });
    for (const metodo of ['POST', 'GET', 'PUT', 'DELETE', 'OPTIONS']) {
      const entrada = new Request('https://proyecto-de-prueba.supabase.co/functions/v1/eventos', {
        method: metodo,
      });
      expect((await atender(entrada)).status, metodo).toBe(204);
    }
    expect(falso).not.toHaveBeenCalled();
  });

  it('no deja nada en caché', async () => {
    const { atender } = manejador({ medicionAnonima: false });
    expect((await atender(peticion(EVENTO))).headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('medición encendida sin Supabase', () => {
  it('responde 503 y no intenta guardar', async () => {
    for (const faltante of [
      { supabaseUrl: undefined, anonKey: undefined },
      { supabaseUrl: undefined },
      { anonKey: undefined },
      { supabaseUrl: '' },
      { anonKey: '' },
    ] satisfies Partial<DependenciasEventos>[]) {
      const { atender, falso } = manejador(faltante);
      const respuesta = await atender(peticion(EVENTO));
      expect(respuesta.status, JSON.stringify(faltante)).toBe(503);
      expect(falso).not.toHaveBeenCalled();
    }
  });

  it('un evento no válido recibe 400 antes que 503: se valida primero', async () => {
    const { atender } = manejador({ supabaseUrl: undefined, anonKey: undefined });
    expect(
      (await atender(peticion({ tipo: 'nombre_del_usuario', dispositivo: DISPOSITIVO }))).status,
    ).toBe(400);
  });
});

describe('medición encendida con Supabase', () => {
  it('guarda con registrar_evento_app y la clave pública, y responde 204', async () => {
    const { atender, falso } = manejador();
    const respuesta = await atender(
      peticion({ tipo: 'onboarding_paso', dispositivo: DISPOSITIVO, valor: 'ajustes' }),
    );
    expect(respuesta.status).toBe(204);
    expect(await respuesta.text()).toBe('');
    expect(falso).toHaveBeenCalledTimes(1);

    const [url, init] = falso.mock.calls[0] ?? [];
    expect(url).toBe(`${URL_PRUEBA}/rest/v1/rpc/registrar_evento_app`);
    expect(init?.method).toBe('POST');
    const cabeceras = init?.headers as Record<string, string>;
    expect(cabeceras.apikey).toBe(CLAVE_PUBLICA);
    expect(cabeceras.Authorization).toBe(`Bearer ${CLAVE_PUBLICA}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      p_tipo: 'onboarding_paso',
      p_dispositivo: DISPOSITIVO,
      p_valor: 'ajustes',
    });
  });

  it('un evento sin valor llega a la base con valor nulo', async () => {
    const { atender, falso } = manejador();
    expect((await atender(peticion(EVENTO))).status).toBe(204);
    expect(JSON.parse(String(falso.mock.calls[0]?.[1]?.body))).toEqual({
      p_tipo: 'portada_vista',
      p_dispositivo: DISPOSITIVO,
      p_valor: null,
    });
  });

  it('el clic de compra se guarda sin valor: un solo enlace de compra, sin plan', async () => {
    const { atender, falso } = manejador();
    expect(
      (await atender(peticion({ tipo: 'compra_clic', dispositivo: DISPOSITIVO }))).status,
    ).toBe(204);
    expect(JSON.parse(String(falso.mock.calls[0]?.[1]?.body))).toEqual({
      p_tipo: 'compra_clic',
      p_dispositivo: DISPOSITIVO,
      p_valor: null,
    });
  });

  it('solo usa la clave pública: ninguna otra clave aparece en la llamada', async () => {
    const { atender, falso } = manejador();
    await atender(
      peticion(EVENTO, { Authorization: 'Bearer token-de-otra-persona', apikey: 'otra-clave' }),
    );
    const llamada = JSON.stringify(falso.mock.calls[0]);
    expect(llamada).toContain(CLAVE_PUBLICA);
    expect(llamada).not.toContain('token-de-otra-persona');
    expect(llamada).not.toContain('otra-clave');
    expect(llamada.toLowerCase()).not.toContain('service');
  });

  it('no reenvía la dirección del cliente ni otros campos a la base', async () => {
    const { atender, falso } = manejador();
    await atender(
      peticion(EVENTO, { 'x-forwarded-for': '192.0.2.44', 'user-agent': 'Navegador de prueba' }),
    );
    expect(Object.keys(JSON.parse(String(falso.mock.calls[0]?.[1]?.body))).sort()).toEqual([
      'p_dispositivo',
      'p_tipo',
      'p_valor',
    ]);
    expect(JSON.stringify(falso.mock.calls[0])).not.toContain('192.0.2.44');
    expect(JSON.stringify(falso.mock.calls[0])).not.toContain('Navegador de prueba');
  });

  it('acepta una URL de Supabase con barra al final', async () => {
    const { atender, falso } = manejador({ supabaseUrl: `${URL_PRUEBA}/` });
    await atender(peticion(EVENTO));
    expect(falso.mock.calls[0]?.[0]).toBe(`${URL_PRUEBA}/rest/v1/rpc/registrar_evento_app`);
  });

  it('si la base devuelve true, responde 204', async () => {
    const { atender } = manejador(
      {},
      crearFetch(() => new Response('true', { status: 200 })),
    );
    expect((await atender(peticion(EVENTO))).status).toBe(204);
  });

  it('si la base responde 200 sin cuerpo, el evento se da por guardado: 204', async () => {
    const { atender } = manejador(
      {},
      crearFetch(() => new Response(null, { status: 200 })),
    );
    expect((await atender(peticion(EVENTO))).status).toBe(204);
  });

  it('si la base devuelve false (límite por dispositivo o total del minuto), responde 429', async () => {
    const { atender, falso } = manejador(
      {},
      crearFetch(() => new Response('false', { status: 200 })),
    );
    const respuesta = await atender(peticion(EVENTO));
    expect(respuesta.status).toBe(429);
    expect(falso).toHaveBeenCalledTimes(1);
  });

  it('si la base responde 500, responde 502 sin detalles', async () => {
    const { atender } = manejador(
      {},
      crearFetch(() => new Response('{"message":"detalle interno"}', { status: 500 })),
    );
    const respuesta = await atender(peticion(EVENTO));
    expect(respuesta.status).toBe(502);
    expect(await respuesta.text()).not.toContain('detalle interno');
  });

  it('si la base rechaza el evento (400), responde 502', async () => {
    const { atender } = manejador(
      {},
      crearFetch(() => new Response('{}', { status: 400 })),
    );
    expect((await atender(peticion(EVENTO))).status).toBe(502);
  });

  it('si la llamada a la base falla o se corta, responde 502', async () => {
    const { atender } = manejador(
      {},
      crearFetch(() => Promise.reject(new Error('sin red'))),
    );
    expect((await atender(peticion(EVENTO))).status).toBe(502);
  });

  it('cada respuesta lleva Cache-Control: no-store', async () => {
    const { atender } = manejador();
    const respuestas = [
      await atender(peticion(EVENTO)),
      await atender(peticion({ tipo: 'nombre_del_usuario', dispositivo: DISPOSITIVO })),
      await atender(peticion(EVENTO, {}, 'GET')),
    ];
    for (const respuesta of respuestas)
      expect(respuesta.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('eventos no válidos', () => {
  it('un tipo que no está en la lista recibe 400 con un mensaje en español, sin tocar la base', async () => {
    const { atender, falso } = manejador();
    const respuesta = await atender(
      peticion({ tipo: 'nombre_del_usuario', dispositivo: DISPOSITIVO }),
    );
    expect(respuesta.status).toBe(400);
    expect(await respuesta.json()).toEqual({ error: 'Tipo de evento desconocido.' });
    expect(falso).not.toHaveBeenCalled();
  });

  it.each([
    ['una clave de más', { ...EVENTO, nombre: 'Ana' }],
    ['un dispositivo que no es UUID', { tipo: 'portada_vista', dispositivo: 'nino-nombre' }],
    [
      'un valor fuera de la lista',
      { tipo: 'onboarding_paso', dispositivo: DISPOSITIVO, valor: 'gratis' },
    ],
    ['un evento con valor sin valor', { tipo: 'onboarding_paso', dispositivo: DISPOSITIVO }],
    ['un valor en un evento que no lo lleva', { ...EVENTO, valor: 'monthly' }],
    [
      'un plan en la compra, que no lleva valor',
      { tipo: 'compra_clic', dispositivo: DISPOSITIVO, valor: 'annual' },
    ],
    [
      'un valor cualquiera en la compra',
      { tipo: 'compra_clic', dispositivo: DISPOSITIVO, valor: 'gratis' },
    ],
    ['un cuerpo que es una lista', [EVENTO]],
    ['un cuerpo que es texto', 'portada_vista'],
    ['un cuerpo que es null', null],
  ])('rechaza %s con 400', async (_nombre, cuerpo) => {
    const { atender, falso } = manejador();
    const respuesta = await atender(peticion(cuerpo));
    expect(respuesta.status).toBe(400);
    expect(((await respuesta.json()) as { error: string }).error.length).toBeGreaterThan(5);
    expect(falso).not.toHaveBeenCalled();
  });

  it('un cuerpo que no es JSON recibe 400', async () => {
    const { atender, falso } = manejador();
    const respuesta = await atender(peticion('{roto'));
    expect(respuesta.status).toBe(400);
    expect(falso).not.toHaveBeenCalled();
  });

  it('un cuerpo vacío recibe 400', async () => {
    const { atender } = manejador();
    expect((await atender(peticion(''))).status).toBe(400);
  });

  it('un cuerpo de más de 2 KB recibe 400 sin llegar a la validación ni a la base', async () => {
    const { atender, falso } = manejador();
    const grande = JSON.stringify({ ...EVENTO, relleno: 'x'.repeat(MAX_CUERPO_BYTES) });
    expect(grande.length).toBeGreaterThan(MAX_CUERPO_BYTES);
    const respuesta = await atender(peticion(grande));
    expect(respuesta.status).toBe(400);
    expect(((await respuesta.json()) as { error: string }).error).toMatch(/grande/);
    expect(falso).not.toHaveBeenCalled();
  });

  it('corta la lectura de un cuerpo que pasa de 2 KB aunque no declare su tamaño', async () => {
    const { atender, falso } = manejador();
    let enviados = 0;
    const flujo = new ReadableStream<Uint8Array>({
      pull(control) {
        enviados += 1024;
        control.enqueue(new TextEncoder().encode('x'.repeat(1024)));
        if (enviados >= 1024 * 1024) control.close();
      },
    });
    const entrada = new Request('https://proyecto-de-prueba.supabase.co/functions/v1/eventos', {
      method: 'POST',
      body: flujo,
      duplex: 'half',
    } as RequestInit);
    const respuesta = await atender(entrada);
    expect(respuesta.status).toBe(400);
    expect(enviados).toBeLessThan(64 * 1024); // no leyó el megabyte entero
    expect(falso).not.toHaveBeenCalled();
  });

  it('un evento válido de tamaño normal cabe de sobra en el máximo', () => {
    expect(
      JSON.stringify({ tipo: 'sesion_abandonada', dispositivo: DISPOSITIVO, valor: 'reflexion' })
        .length,
    ).toBeLessThan(MAX_CUERPO_BYTES / 4);
  });
});

describe('métodos y CORS', () => {
  it.each(['GET', 'PUT', 'PATCH', 'DELETE'])(
    '%s recibe 405 con la lista de métodos',
    async (metodo) => {
      const { atender, falso } = manejador();
      const respuesta = await atender(peticion(EVENTO, {}, metodo));
      expect(respuesta.status).toBe(405);
      expect(respuesta.headers.get('Allow')).toBe('POST, OPTIONS');
      expect(falso).not.toHaveBeenCalled();
    },
  );

  it('OPTIONS (la comprobación previa del navegador) recibe 204 con las cabeceras CORS de la app', async () => {
    const { atender, falso } = manejador({ appUrl: `${APP_URL}/` });
    const respuesta = await atender(peticion('', { Origin: APP_URL }, 'OPTIONS'));
    expect(respuesta.status).toBe(204);
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBe(APP_URL);
    expect(respuesta.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(respuesta.headers.get('Access-Control-Allow-Headers')).toContain('apikey');
    expect(respuesta.headers.get('Access-Control-Allow-Headers')).toContain('content-type');
    expect(falso).not.toHaveBeenCalled();
  });

  it('un origen distinto al de la app no recibe su origen en la cabecera', async () => {
    const { atender } = manejador({ appUrl: APP_URL });
    const respuesta = await atender(peticion(EVENTO, { Origin: 'https://otro-sitio.example.net' }));
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBe(APP_URL);
  });

  it('sin APP_URL no abre ningún origen', async () => {
    const { atender } = manejador({ appUrl: undefined });
    const respuesta = await atender(peticion(EVENTO, { Origin: APP_URL }));
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('límite de la instancia', () => {
  it('acepta 60 eventos por minuto desde la misma dirección y rechaza el siguiente con 429', async () => {
    expect(MAX_EVENTOS_POR_MINUTO).toBe(60);
    let ahora = 1_000_000;
    const { atender, falso } = manejador({ ahora: () => ahora });
    const cabeceras = { 'x-forwarded-for': '192.0.2.10' };
    for (let i = 0; i < MAX_EVENTOS_POR_MINUTO; i++) {
      expect((await atender(peticion(EVENTO, cabeceras))).status, `evento ${i + 1}`).toBe(204);
    }
    expect((await atender(peticion(EVENTO, cabeceras))).status).toBe(429);
    expect(falso).toHaveBeenCalledTimes(MAX_EVENTOS_POR_MINUTO);

    // Otra dirección sigue pudiendo enviar.
    expect((await atender(peticion(EVENTO, { 'x-forwarded-for': '192.0.2.11' }))).status).toBe(204);

    // Pasado el minuto, la primera vuelve a poder.
    ahora += 60_001;
    expect((await atender(peticion(EVENTO, cabeceras))).status).toBe(204);
  });

  it('usa la primera dirección de x-forwarded-for', async () => {
    const { atender } = manejador({ ahora: () => 5_000 });
    for (let i = 0; i < MAX_EVENTOS_POR_MINUTO; i++) {
      await atender(peticion(EVENTO, { 'x-forwarded-for': `192.0.2.20, 10.0.0.${i}` }));
    }
    expect(
      (await atender(peticion(EVENTO, { 'x-forwarded-for': '192.0.2.20, 10.9.9.9' }))).status,
    ).toBe(429);
  });

  it('un evento rechazado por validación no gasta el límite', async () => {
    const { atender } = manejador({ ahora: () => 5_000 });
    const cabeceras = { 'x-forwarded-for': '192.0.2.30' };
    for (let i = 0; i < MAX_EVENTOS_POR_MINUTO + 5; i++) {
      expect(
        (await atender(peticion({ tipo: 'inventado', dispositivo: DISPOSITIVO }, cabeceras)))
          .status,
      ).toBe(400);
    }
    expect((await atender(peticion(EVENTO, cabeceras))).status).toBe(204);
  });
});
