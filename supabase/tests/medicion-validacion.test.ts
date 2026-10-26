// Validación de los eventos de la medición anónima (supabase/functions/_shared/eventos.ts): lista cerrada de tipos,
// identificador de dispositivo en forma de UUID y valores de lista. Nada de texto libre ni de claves de más.
import { describe, expect, it } from 'vitest';
import {
  EVENTOS_APP,
  VALORES,
  validarEvento,
  type TipoValor,
} from '../functions/_shared/eventos.ts';

const DISPOSITIVO = '3f2c9c1e-7a1b-4d7e-9b7a-2f6d1e0c9a11';

/** Un valor válido para cada tipo de valor. */
const valorDePrueba = (tipoValor: TipoValor | null): string | undefined =>
  tipoValor === null ? undefined : VALORES[tipoValor][0];

describe('lista cerrada de eventos', () => {
  it('tiene entre 12 y 20 eventos, sin repetir', () => {
    expect(EVENTOS_APP.length).toBeGreaterThanOrEqual(12);
    expect(EVENTOS_APP.length).toBeLessThanOrEqual(20);
    const tipos = EVENTOS_APP.map((evento) => evento.tipo);
    expect(new Set(tipos).size).toBe(tipos.length);
  });

  it('incluye los tipos que usan el acceso y la compra', () => {
    const tipos = EVENTOS_APP.map((evento) => evento.tipo) as string[];
    for (const obligatorio of [
      'portada_vista',
      'precios_vista',
      'compra_clic',
      'acceso_enlace_pedido',
      'acceso_confirmado',
      'sin_compra_visto',
    ]) {
      expect(tipos, obligatorio).toContain(obligatorio);
    }
    // Un solo enlace de compra: la app no sabe qué plan elige la persona, así que el clic no lleva valor.
    expect(EVENTOS_APP.find((evento) => evento.tipo === 'compra_clic')?.valor).toBeNull();
    expect(Object.keys(VALORES)).not.toContain('plan');
  });

  it('cada tipo tiene la forma que exige la base y una etiqueta en español para el panel', () => {
    for (const evento of EVENTOS_APP) {
      expect(evento.tipo, evento.tipo).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(evento.tipo.length).toBeLessThanOrEqual(40);
      expect(evento.etiqueta.trim().length, evento.tipo).toBeGreaterThan(3);
    }
  });

  it('las listas de valores no repiten nada y cada valor cumple el formato de la base', () => {
    for (const [tipoValor, lista] of Object.entries(VALORES)) {
      expect(new Set(lista).size, tipoValor).toBe(lista.length);
      for (const valor of lista) {
        expect(valor, `${tipoValor}:${valor}`).toMatch(/^[a-z0-9][a-z0-9-]*$/);
        expect(valor.length).toBeLessThanOrEqual(60);
      }
    }
  });

  it('cada evento con valor apunta a una lista que existe', () => {
    for (const evento of EVENTOS_APP) {
      if (evento.valor !== null)
        expect(VALORES[evento.valor].length, evento.tipo).toBeGreaterThan(0);
    }
  });
});

describe('validarEvento: lo que se acepta', () => {
  it('acepta cada evento de la lista con un valor de su tipo', () => {
    for (const evento of EVENTOS_APP) {
      const valor = valorDePrueba(evento.valor);
      const cuerpo =
        valor === undefined
          ? { tipo: evento.tipo, dispositivo: DISPOSITIVO }
          : { tipo: evento.tipo, dispositivo: DISPOSITIVO, valor };
      expect(validarEvento(cuerpo), evento.tipo).toEqual({ ok: true, evento: cuerpo });
    }
  });

  it('acepta todos los valores de cada lista en el evento que la usa', () => {
    for (const evento of EVENTOS_APP) {
      if (evento.valor === null) continue;
      for (const valor of VALORES[evento.valor]) {
        expect(
          validarEvento({ tipo: evento.tipo, dispositivo: DISPOSITIVO, valor }).ok,
          `${evento.tipo}:${valor}`,
        ).toBe(true);
      }
    }
  });

  it('un evento sin valor puede traer valor nulo (equivale a no traerlo)', () => {
    expect(validarEvento({ tipo: 'portada_vista', dispositivo: DISPOSITIVO, valor: null })).toEqual(
      {
        ok: true,
        evento: { tipo: 'portada_vista', dispositivo: DISPOSITIVO },
      },
    );
  });

  it('acepta el UUID en mayúsculas', () => {
    expect(
      validarEvento({ tipo: 'portada_vista', dispositivo: DISPOSITIVO.toUpperCase() }).ok,
    ).toBe(true);
  });
});

describe('validarEvento: lo que se rechaza', () => {
  it.each([null, undefined, 'portada_vista', 42, true, [], [{ tipo: 'portada_vista' }]])(
    'rechaza un cuerpo que no es un objeto: %j',
    (cuerpo) => {
      expect(validarEvento(cuerpo).ok).toBe(false);
    },
  );

  it('rechaza un tipo que no está en la lista, también los nombres del objeto', () => {
    for (const tipo of [
      'nombre_del_usuario',
      'PORTADA_VISTA',
      '',
      '__proto__',
      'constructor',
      'toString',
      'portada_vista ',
      7,
      null,
      undefined,
    ]) {
      const resultado = validarEvento({ tipo, dispositivo: DISPOSITIVO });
      expect(resultado.ok, String(tipo)).toBe(false);
    }
  });

  it('rechaza un dispositivo que no es un UUID', () => {
    for (const dispositivo of [
      '',
      'nino-nombre',
      'correo@example.com',
      '3f2c9c1e7a1b4d7e9b7a2f6d1e0c9a11',
      `${DISPOSITIVO}x`,
      12345,
      null,
      undefined,
      {},
    ]) {
      expect(validarEvento({ tipo: 'portada_vista', dispositivo }).ok, String(dispositivo)).toBe(
        false,
      );
    }
  });

  it('rechaza cualquier clave de más, aunque el resto sea válido', () => {
    for (const extra of [
      { nombre: 'Ana' },
      { correo: 'ana@example.com' },
      { ip: '192.0.2.1' },
      { texto: 'libre' },
      { __proto__: { x: 1 }, usuario: 'x' },
    ]) {
      const resultado = validarEvento({
        tipo: 'portada_vista',
        dispositivo: DISPOSITIVO,
        ...extra,
      });
      expect(resultado.ok, JSON.stringify(extra)).toBe(false);
    }
  });

  it('rechaza un valor en un evento que no lleva valor', () => {
    expect(
      validarEvento({ tipo: 'portada_vista', dispositivo: DISPOSITIVO, valor: 'monthly' }),
    ).toMatchObject({ ok: false });
  });

  it('acepta la compra sin valor, con valor ausente o nulo', () => {
    expect(validarEvento({ tipo: 'compra_clic', dispositivo: DISPOSITIVO })).toEqual({
      ok: true,
      evento: { tipo: 'compra_clic', dispositivo: DISPOSITIVO },
    });
    expect(
      validarEvento({ tipo: 'compra_clic', dispositivo: DISPOSITIVO, valor: null }),
    ).toMatchObject({ ok: true });
  });

  it('rechaza cualquier valor en la compra, también un plan', () => {
    for (const valor of [
      'monthly',
      'annual',
      'gratis',
      'respiracion',
      'Annual',
      1,
      ['monthly'],
      {},
    ]) {
      expect(
        validarEvento({ tipo: 'compra_clic', dispositivo: DISPOSITIVO, valor }),
        JSON.stringify(valor),
      ).toEqual({ ok: false, error: 'Este evento no lleva valor.' });
    }
  });

  it('rechaza un evento con valor al que le falta el valor', () => {
    for (const valor of [undefined, null]) {
      expect(validarEvento({ tipo: 'onboarding_paso', dispositivo: DISPOSITIVO, valor })).toEqual({
        ok: false,
        error: 'Falta el valor del evento.',
      });
    }
  });

  it('rechaza un valor fuera de la lista del evento, texto libre incluido', () => {
    const casos: [string, unknown][] = [
      ['onboarding_paso', 'respiracion'], // existe, pero en otra lista
      ['onboarding_paso', 'monthly'],
      ['juego_terminado', 'mi-nombre-es-ana'],
      ['juego_terminado', 'monthly'],
      ['sesion_abandonada', 'objetivo'],
      ['sesion_abandonada', 'Me llamo Ana'],
      ['onboarding_paso', 1],
      ['onboarding_paso', ['objetivo']],
      ['onboarding_paso', {}],
    ];
    for (const [tipo, valor] of casos) {
      expect(
        validarEvento({ tipo, dispositivo: DISPOSITIVO, valor }).ok,
        `${tipo}:${JSON.stringify(valor)}`,
      ).toBe(false);
    }
  });

  it('los mensajes de error están en español', () => {
    const resultado = validarEvento({ tipo: 'nombre_del_usuario', dispositivo: DISPOSITIVO });
    expect(resultado).toEqual({ ok: false, error: 'Tipo de evento desconocido.' });
  });
});
