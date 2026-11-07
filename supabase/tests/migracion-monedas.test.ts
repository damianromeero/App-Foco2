// Migración 20261104120000_monedas_hotmart.sql con PostgreSQL real (PGlite, en memoria). Comprueba que una compra en otra
// moneda entra sin importe en USD y que una moneda mal escrita se rechaza. Correo inventado con dominio reservado (.test).
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EMULACION_SUPABASE, leerMigracion, MIGRACIONES_PANEL } from './ayudas-bd';

const PREVIAS = [
  '20261024110000_compras_hotmart.sql',
  '20261024120000_accesos.sql',
  '20261024130000_compras_finales_previas.sql',
  '20261025100000_acceso_regla_hotmart.sql',
] as const;

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(EMULACION_SUPABASE);
  for (const nombre of MIGRACIONES_PANEL) await db.exec(leerMigracion(nombre));
  for (const nombre of PREVIAS) await db.exec(leerMigracion(nombre));
  await db.exec(leerMigracion('20261104120000_monedas_hotmart.sql'));
});

afterAll(async () => {
  await db.close();
});

const intento = async (sql: string) => {
  try {
    await db.exec(sql);
    return null;
  } catch (error) {
    return String(error);
  }
};

describe('pagos en otras monedas', () => {
  it('una compra en BRL se guarda sin importe en USD y con su moneda original', async () => {
    expect(
      await intento(
        "insert into public.compras (id_hotmart, plan, monto_usd, moneda, monto_original, correo, estado, fecha_aviso) values ('TRX-BRL', 'mensual', null, 'BRL', 29.90, 'ana@ejemplo.test', 'aprobada', now())",
      ),
    ).toBeNull();
    const { rows } = await db.query<{
      monto_usd: string | null;
      moneda: string;
      monto_original: string;
    }>("select monto_usd, moneda, monto_original from public.compras where id_hotmart = 'TRX-BRL'");
    expect(rows[0]).toEqual({ monto_usd: null, moneda: 'BRL', monto_original: '29.90' });
  });

  it('una compra antigua sin moneda queda como USD', async () => {
    expect(
      await intento(
        "insert into public.compras (id_hotmart, plan, monto_usd, correo, estado, fecha_aviso) values ('TRX-USD', 'mensual', 4.99, 'bea@ejemplo.test', 'aprobada', now())",
      ),
    ).toBeNull();
    const { rows } = await db.query<{ moneda: string }>(
      "select moneda from public.compras where id_hotmart = 'TRX-USD'",
    );
    expect(rows[0]?.moneda).toBe('USD');
  });

  it('una moneda que no es un código de 3 letras mayúsculas se rechaza', async () => {
    expect(
      await intento(
        "insert into public.compras (id_hotmart, plan, monto_usd, moneda, correo, estado, fecha_aviso) values ('TRX-MAL', 'mensual', 1, 'br', 'x@ejemplo.test', 'aprobada', now())",
      ),
    ).toMatch(/check constraint/i);
  });

  it('un importe original negativo se rechaza', async () => {
    expect(
      await intento(
        "insert into public.compras (id_hotmart, plan, monto_usd, moneda, monto_original, correo, estado, fecha_aviso) values ('TRX-NEG', 'mensual', 1, 'USD', -1, 'x@ejemplo.test', 'aprobada', now())",
      ),
    ).toMatch(/check constraint/i);
  });
});
