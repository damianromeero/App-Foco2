// Eliminar la cuenta desde la app (migración 20261025110000_borrar_mi_cuenta.sql) con PostgreSQL real (PGlite, en memoria).
// La persona con sesión borra SOLO su cuenta; anon no puede ejecutar la función; sin sesión no se borra nada. La función
// de Edge «delete-account» se retiró: ya no usa la clave de servicio ni llama a ningún proveedor de cobros.
// Correos y ids inventados.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comoRol, EMULACION_SUPABASE, leerMigracion } from './ayudas-bd';

const MIGRACION = '20261025110000_borrar_mi_cuenta.sql';
const PERSONA = '11111111-1111-4111-8111-111111111111';
const OTRA = '22222222-2222-4222-8222-222222222222';
const LLAMADA = 'select public.borrar_mi_cuenta()';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('borrar_mi_cuenta: la persona borra solo su propia cuenta', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(EMULACION_SUPABASE);
    await db.exec(leerMigracion(MIGRACION));
    await db.exec(`insert into auth.users (id) values ('${PERSONA}'), ('${OTRA}')`);
  }, 60_000);

  afterAll(async () => {
    await db.close();
  }, 60_000);

  const cuentas = async (): Promise<string[]> => {
    const resultado = await db.query<{ id: string }>('select id from auth.users order by id');
    return resultado.rows.map((fila) => fila.id);
  };

  it('anon no puede ejecutarla y no borra nada', async () => {
    const resultado = await comoRol(db, 'anon', {}, LLAMADA);
    expect(resultado.ok).toBe(false);
    expect(await cuentas()).toEqual([PERSONA, OTRA].sort());
  });

  it('sin sesión no borra nada: pide iniciar sesión', async () => {
    const resultado = await comoRol(db, 'authenticated', {}, LLAMADA);
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toMatch(/iniciar sesión/i);
    expect(await cuentas()).toEqual([PERSONA, OTRA].sort());
  });

  it('con sesión borra la cuenta de quien llama y deja intacta la de otra persona', async () => {
    const resultado = await comoRol(db, 'authenticated', { sub: PERSONA }, LLAMADA);
    expect(resultado.ok).toBe(true);
    expect(await cuentas()).toEqual([OTRA]);
  });

  it('el código de la migración no menciona Stripe ni Hotmart: borrar la cuenta no cancela cobros', async () => {
    const codigo = leerMigracion(MIGRACION)
      .replace(/--.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codigo).not.toMatch(/stripe|hotmart/i);
  });

  it('la función Edge delete-account ya no existe (usaba la clave de servicio)', () => {
    expect(existsSync(join(RAIZ, 'functions', 'delete-account', 'index.ts'))).toBe(false);
  });
});
