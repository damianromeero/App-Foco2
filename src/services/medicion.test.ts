import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENTOS_APP, VALORES } from '../config/medicion';
import type * as ModuloPlantilla from '../config/plantilla';
import {
  CLAVE_DISPOSITIVO,
  DIAS_RENOVACION,
  identificadorDispositivo,
  registrarEvento,
} from './medicion';

// El interruptor, la nube y la configuración se cambian desde aquí. En la plantilla real la medición sale apagada.
interface EstadoDePrueba {
  medicion: boolean;
  nube: boolean;
  url: string | undefined;
  clave: string | undefined;
}

const estado = vi.hoisted<EstadoDePrueba>(() => ({
  medicion: true,
  nube: true,
  url: 'https://proyecto-de-prueba.supabase.co',
  clave: 'clave-publica-de-prueba',
}));

vi.mock('../config/plantilla', async (importarOriginal) => {
  const original = await importarOriginal<typeof ModuloPlantilla>();
  return {
    ...original,
    plantilla: {
      ...original.plantilla,
      get medicionAnonima() {
        return estado.medicion;
      },
    },
  };
});

vi.mock('../config/env', () => ({
  env: {
    get supabaseUrl() {
      return estado.url;
    },
    get supabaseAnonKey() {
      return estado.clave;
    },
  },
}));

vi.mock('./supabase', () => ({ isCloudEnabled: () => estado.nube }));

const DIA = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ID_GUARDADO = '3f2c8a1e-9b7d-4c5a-8e6f-1a2b3c4d5e6f';
const URL_EVENTOS = 'https://proyecto-de-prueba.supabase.co/functions/v1/eventos';

/** `fetch` falso que responde 204 como la función `eventos`. */
function simularRed() {
  const envio = vi.fn<typeof fetch>(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal('fetch', envio);
  return envio;
}

/** Cuerpo de la primera petición, ya leído. */
function cuerpoEnviado(envio: ReturnType<typeof simularRed>, llamada = 0): Record<string, unknown> {
  const cuerpo = envio.mock.calls[llamada]?.[1]?.body;
  if (typeof cuerpo !== 'string') throw new Error('La petición no lleva un cuerpo de texto.');
  return JSON.parse(cuerpo) as Record<string, unknown>;
}

beforeEach(() => {
  estado.medicion = true;
  estado.nube = true;
  estado.url = 'https://proyecto-de-prueba.supabase.co';
  estado.clave = 'clave-publica-de-prueba';
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('medición apagada o sin nube', () => {
  it('con la medición apagada no envía ninguna petición ni guarda nada, para ningún evento de la lista', () => {
    estado.medicion = false;
    const envio = simularRed();
    for (const evento of EVENTOS_APP) {
      registrarEvento(evento.tipo, evento.valor === null ? undefined : VALORES[evento.valor][0]);
    }
    expect(envio).not.toHaveBeenCalled();
    expect(localStorage.getItem(CLAVE_DISPOSITIVO)).toBeNull();
    expect(localStorage).toHaveLength(0);
  });

  it('sin Supabase configurado (isCloudEnabled falso) no envía nada ni guarda nada', () => {
    estado.nube = false;
    const envio = simularRed();
    registrarEvento('portada_vista');
    expect(envio).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
  });

  it('sin URL o sin clave pública no envía nada', () => {
    const envio = simularRed();
    estado.url = undefined;
    registrarEvento('portada_vista');
    estado.url = 'https://proyecto-de-prueba.supabase.co';
    estado.clave = undefined;
    registrarEvento('portada_vista');
    expect(envio).not.toHaveBeenCalled();
  });
});

describe('medición encendida y configurada', () => {
  it('envía el evento a la función eventos con la clave pública y keepalive', () => {
    const envio = simularRed();
    registrarEvento('portada_vista');
    expect(envio).toHaveBeenCalledTimes(1);
    const [url, init] = envio.mock.calls[0] ?? [];
    expect(url).toBe(URL_EVENTOS);
    expect(init?.method).toBe('POST');
    expect(init?.keepalive).toBe(true);
    expect(init?.headers).toEqual({
      apikey: 'clave-publica-de-prueba',
      'content-type': 'application/json',
    });
    const { dispositivo, ...resto } = cuerpoEnviado(envio);
    expect(resto).toEqual({ tipo: 'portada_vista' });
    expect(dispositivo).toMatch(UUID);
  });

  it('un evento con valor lo envía en el cuerpo', () => {
    const envio = simularRed();
    registrarEvento('onboarding_paso', 'ajustes');
    const { dispositivo, ...resto } = cuerpoEnviado(envio);
    expect(resto).toEqual({ tipo: 'onboarding_paso', valor: 'ajustes' });
    expect(dispositivo).toMatch(UUID);
  });

  it('el clic de compra se envía sin valor: un solo enlace de compra, sin plan', () => {
    const envio = simularRed();
    registrarEvento('compra_clic');
    const { dispositivo, ...resto } = cuerpoEnviado(envio);
    expect(resto).toEqual({ tipo: 'compra_clic' });
    expect(dispositivo).toMatch(UUID);
  });

  it('el cuerpo solo lleva tipo, dispositivo y, a veces, valor', () => {
    const envio = simularRed();
    for (const evento of EVENTOS_APP) {
      registrarEvento(evento.tipo, evento.valor === null ? undefined : VALORES[evento.valor][0]);
    }
    expect(envio).toHaveBeenCalledTimes(EVENTOS_APP.length);
    for (const [indice, evento] of EVENTOS_APP.entries()) {
      const claves = Object.keys(cuerpoEnviado(envio, indice)).sort();
      expect(claves, evento.tipo).toEqual(
        evento.valor === null ? ['dispositivo', 'tipo'] : ['dispositivo', 'tipo', 'valor'],
      );
    }
  });

  it('acepta una URL de Supabase con barra al final', () => {
    estado.url = 'https://proyecto-de-prueba.supabase.co/';
    const envio = simularRed();
    registrarEvento('portada_vista');
    expect(envio.mock.calls[0]?.[0]).toBe(URL_EVENTOS);
  });

  it('no envía un valor fuera de la lista ni un valor donde no corresponde ni un valor que falta', () => {
    const envio = simularRed();
    registrarEvento('onboarding_paso', 'gratis');
    registrarEvento('onboarding_paso', 'respiracion'); // existe, pero en otra lista
    registrarEvento('onboarding_paso');
    registrarEvento('compra_clic', 'monthly'); // la compra no lleva plan
    registrarEvento('compra_clic', 'annual');
    registrarEvento('portada_vista', 'monthly');
    registrarEvento('juego_terminado', 'Me llamo Ana');
    expect(envio).not.toHaveBeenCalled();
  });

  it('acepta todos los juegos, pasos y pantallas de la lista', () => {
    const envio = simularRed();
    let esperadas = 0;
    for (const evento of EVENTOS_APP) {
      if (evento.valor === null) continue;
      for (const valor of VALORES[evento.valor]) {
        registrarEvento(evento.tipo, valor);
        esperadas += 1;
      }
    }
    expect(envio).toHaveBeenCalledTimes(esperadas);
  });
});

describe('identificador de dispositivo', () => {
  it('es un UUID v4 que se guarda con su fecha de creación en localStorage', () => {
    const ahora = 1_700_000_000_000;
    const id = identificadorDispositivo(ahora);
    expect(id).toMatch(UUID_V4);
    expect(JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO) ?? 'null')).toEqual({
      id,
      creadoEn: ahora,
    });
  });

  it('la clave de almacenamiento es foco-dispositivo', () => {
    expect(CLAVE_DISPOSITIVO).toBe('foco-dispositivo');
  });

  it('es estable: varias llamadas y varios eventos usan el mismo', () => {
    const envio = simularRed();
    const primero = identificadorDispositivo();
    expect(identificadorDispositivo()).toBe(primero);
    registrarEvento('portada_vista');
    registrarEvento('precios_vista');
    expect(cuerpoEnviado(envio, 0).dispositivo).toBe(primero);
    expect(cuerpoEnviado(envio, 1).dispositivo).toBe(primero);
  });

  it('se renueva a los 30 días y no antes', () => {
    expect(DIAS_RENOVACION).toBe(30);
    localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify({ id: ID_GUARDADO, creadoEn: 0 }));
    expect(identificadorDispositivo(29 * DIA)).toBe(ID_GUARDADO);

    const renovado = identificadorDispositivo(30 * DIA);
    expect(renovado).toMatch(UUID_V4);
    expect(renovado).not.toBe(ID_GUARDADO);
    expect(JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO) ?? 'null')).toEqual({
      id: renovado,
      creadoEn: 30 * DIA,
    });
    // El nuevo vale otros 30 días.
    expect(identificadorDispositivo(59 * DIA)).toBe(renovado);
  });

  it('si la fecha guardada está en el futuro (el reloj se movió), genera uno nuevo', () => {
    localStorage.setItem(
      CLAVE_DISPOSITIVO,
      JSON.stringify({ id: ID_GUARDADO, creadoEn: 10 * DIA }),
    );
    expect(identificadorDispositivo(DIA)).not.toBe(ID_GUARDADO);
  });

  it.each([
    ['no es JSON', '{no es json'],
    ['no es un objeto', '"hola"'],
    ['el id no es un UUID', JSON.stringify({ id: 'ana-lopez', creadoEn: 1 })],
    ['falta la fecha', JSON.stringify({ id: ID_GUARDADO })],
    ['la fecha no es un número', JSON.stringify({ id: ID_GUARDADO, creadoEn: 'ayer' })],
  ])('si lo guardado no tiene forma válida (%s), genera uno nuevo', (_motivo, guardado) => {
    localStorage.setItem(CLAVE_DISPOSITIVO, guardado);
    expect(identificadorDispositivo(1000)).toMatch(UUID_V4);
    expect(JSON.parse(localStorage.getItem(CLAVE_DISPOSITIVO) ?? 'null')).toMatchObject({
      creadoEn: 1000,
    });
  });

  it('si el navegador no tiene randomUUID usa getRandomValues y sigue siendo un UUID v4', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff) });
    expect(identificadorDispositivo(1000)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
  });

  it('si el almacenamiento falla, usa uno en memoria que no cambia mientras dure la página', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('almacenamiento bloqueado');
    });
    vi.resetModules();
    const { identificadorDispositivo: fresco, registrarEvento: registrarFresco } =
      await import('./medicion');
    const envio = simularRed();

    const ahora = Date.now();
    const primero = fresco(ahora);
    expect(primero).toMatch(UUID_V4);
    expect(fresco(ahora + 1000)).toBe(primero);
    expect(() => {
      registrarFresco('portada_vista');
    }).not.toThrow();
    expect(cuerpoEnviado(envio).dispositivo).toBe(primero);
    // También en memoria se renueva a los 30 días.
    expect(fresco(ahora + 31 * DIA)).not.toBe(primero);
  });
});

describe('registrarEvento nunca lanza ni espera', () => {
  it('devuelve de inmediato, sin esperar la respuesta', () => {
    // La petición nunca termina: si registrarEvento la esperara, esta prueba no acabaría.
    const envio = vi.fn<typeof fetch>(() => new Promise<Response>(() => undefined));
    vi.stubGlobal('fetch', envio);
    registrarEvento('portada_vista');
    expect(envio).toHaveBeenCalledTimes(1);
  });

  it('si la red falla, el error se traga', async () => {
    const envio = vi.fn<typeof fetch>(() => Promise.reject(new Error('sin red')));
    vi.stubGlobal('fetch', envio);
    expect(() => {
      registrarEvento('portada_vista');
    }).not.toThrow();
    // Si el rechazo quedara sin atender, Vitest fallaría la ejecución con «Unhandled Rejection».
    await new Promise((resolver) => setTimeout(resolver, 0));
    expect(envio).toHaveBeenCalledTimes(1);
  });

  it('si fetch lanza al instante o no existe, tampoco lanza', () => {
    vi.stubGlobal('fetch', () => {
      throw new Error('fetch roto');
    });
    expect(() => {
      registrarEvento('portada_vista');
    }).not.toThrow();
    vi.stubGlobal('fetch', undefined);
    expect(() => {
      registrarEvento('portada_vista');
    }).not.toThrow();
  });

  it('si no hay forma de generar un identificador, no envía nada y no lanza', () => {
    const envio = simularRed();
    vi.stubGlobal('crypto', undefined);
    expect(() => {
      registrarEvento('portada_vista');
    }).not.toThrow();
    expect(envio).not.toHaveBeenCalled();
  });
});
