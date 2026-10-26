// Prueba de deriva de la medición: la misma lista de eventos vive en tres sitios y las tres deben decir lo mismo.
//  1. supabase/functions/_shared/eventos.ts  (la fuente para el servidor)
//  2. src/config/medicion.ts                 (el espejo que importan la app y el panel)
//  3. registrar_evento_app, en supabase/migrations/20261024100001_limite_eventos.sql (la base)
// Además comprueba que el interruptor del navegador y el del servidor valen lo mismo, que la lista de juegos sigue al
// catálogo de la app, que la compra no lleva plan, y que el código del servidor no usa la clave de servicio.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { plantilla } from '../../src/config/plantilla';
import * as cliente from '../../src/config/medicion';
import { GAME_IDS } from '../../src/domain/model';
import * as servidor from '../functions/_shared/eventos.ts';
import { leerMigracion } from './ayudas-bd';

/** Lee un archivo de texto del proyecto por su ruta desde la raíz (la carpeta que contiene `supabase/` y `src/`). */
const leerArchivo = (ruta: string): string =>
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..', ruta), 'utf8');

const SQL = leerMigracion('20261024100001_limite_eventos.sql');

/** Los textos entre comillas simples de un fragmento de SQL, en orden. */
const textos = (fragmento: string): string[] =>
  [...fragmento.matchAll(/'([^']*)'/g)].map((coincidencia) => coincidencia[1] ?? '');

/** Lista de tipos que acepta la función: lo que va dentro de `p_tipo not in ( … )`. */
function tiposDeLaBase(): string[] {
  const coincidencia = /p_tipo not in \(([^)]*)\)/.exec(SQL);
  if (!coincidencia?.[1]) throw new Error('La migración no tiene la lista `p_tipo not in (…)`.');
  return textos(coincidencia[1]);
}

/** Qué lista de valores lleva cada tipo: las ramas `when 'tipo' then 'lista'` de la función. */
function valorDeCadaTipoEnLaBase(): Record<string, string> {
  const caso = /v_tipo_valor := case p_tipo([\s\S]*?)else null\s+end;/.exec(SQL);
  if (!caso?.[1]) throw new Error('La migración no tiene el `case p_tipo`.');
  return Object.fromEntries(
    [...caso[1].matchAll(/when '([^']*)' then '([^']*)'/g)].map((coincidencia) => [
      coincidencia[1] ?? '',
      coincidencia[2] ?? '',
    ]),
  );
}

/** Las listas de valores de la función: `(v_tipo_valor = 'lista' and p_valor in ( … ))`. */
function listasDeValoresEnLaBase(): Record<string, string[]> {
  const listas = [...SQL.matchAll(/v_tipo_valor = '([^']*)' and p_valor in \(([^)]*)\)/g)];
  return Object.fromEntries(
    listas.map((coincidencia) => [coincidencia[1] ?? '', textos(coincidencia[2] ?? '')]),
  );
}

describe('espejo del navegador = servidor', () => {
  it('la lista de eventos es la misma', () => {
    expect(cliente.EVENTOS_APP).toEqual(servidor.EVENTOS_APP);
  });

  it('las listas de valores son las mismas', () => {
    expect(cliente.VALORES).toEqual(servidor.VALORES);
  });

  it('los dos exportan lo mismo', () => {
    const exportadosPorElCliente = Object.keys(cliente).filter(
      (nombre) => typeof (cliente as Record<string, unknown>)[nombre] !== 'undefined',
    );
    for (const nombre of exportadosPorElCliente)
      expect(Object.keys(servidor), nombre).toContain(nombre);
  });
});

describe('la base = la app', () => {
  it('acepta exactamente los mismos tipos de evento, en el mismo orden', () => {
    expect(tiposDeLaBase()).toEqual(servidor.EVENTOS_APP.map((evento) => evento.tipo));
  });

  it('cada tipo usa la misma lista de valores (y los que no llevan valor, ninguna)', () => {
    const esperado = Object.fromEntries(
      servidor.EVENTOS_APP.filter((evento) => evento.valor !== null).map((evento) => [
        evento.tipo,
        evento.valor,
      ]),
    );
    expect(valorDeCadaTipoEnLaBase()).toEqual(esperado);
  });

  it('las listas de valores son las mismas, en el mismo orden', () => {
    expect(listasDeValoresEnLaBase()).toEqual(servidor.VALORES);
  });

  it('la base no valida contra una lista que la app no tenga', () => {
    expect(Object.keys(listasDeValoresEnLaBase()).sort()).toEqual(
      Object.keys(servidor.VALORES).sort(),
    );
  });
});

describe('la medición sigue al catálogo de la app', () => {
  it('la lista de juegos es la de GAME_IDS: un juego nuevo hay que añadirlo también a la medición', () => {
    expect([...cliente.VALORES.juego]).toEqual([...GAME_IDS]);
  });

  it('la compra no lleva plan: un solo enlace de compra, así que la medición no distingue mensual de anual', () => {
    expect(Object.keys(cliente.VALORES)).not.toContain('plan');
    expect(cliente.EVENTOS_APP.find((evento) => evento.tipo === 'compra_clic')?.valor).toBeNull();
    expect(valorDeCadaTipoEnLaBase()).not.toHaveProperty('compra_clic');
  });
});

describe('interruptores', () => {
  it('el del navegador (plantilla.medicionAnonima) y el del servidor (medicionAnonima) valen lo mismo', () => {
    expect(plantilla.medicionAnonima).toBe(servidor.medicionAnonima);
  });

  it('en la plantilla que se vende, la medición sale apagada', () => {
    expect(servidor.medicionAnonima).toBe(false);
    expect(plantilla.medicionAnonima).toBe(false);
  });

  it('la función eventos no pide verificación de sesión: la llama el navegador con la clave pública', () => {
    expect(leerArchivo('supabase/config.toml')).toMatch(
      /\[functions\.eventos\]\s*\n\s*verify_jwt = false/,
    );
  });
});

describe('el servidor de la medición', () => {
  const ARCHIVOS = [
    'supabase/functions/_shared/eventos.ts',
    'supabase/functions/eventos/handler.ts',
    'supabase/functions/eventos/index.ts',
  ];

  it('no usa la clave de servicio en ningún archivo', () => {
    for (const archivo of ARCHIVOS) {
      expect(leerArchivo(archivo), archivo).not.toMatch(
        /service[_-]?role|SERVICE_ROLE|adminClient/i,
      );
    }
  });

  it('solo usa la clave pública (SUPABASE_ANON_KEY)', () => {
    expect(leerArchivo('supabase/functions/eventos/index.ts')).toContain(
      "Deno.env.get('SUPABASE_ANON_KEY')",
    );
  });

  it('el módulo de la lista y el manejador son puros: sin Deno ni paquetes npm', () => {
    for (const archivo of [
      'supabase/functions/_shared/eventos.ts',
      'supabase/functions/eventos/handler.ts',
    ]) {
      const codigo = leerArchivo(archivo);
      expect(codigo, archivo).not.toMatch(/\bDeno\./);
      expect(codigo, archivo).not.toMatch(/from\s+['"]npm:/);
    }
  });
});
