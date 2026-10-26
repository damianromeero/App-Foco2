// Retención de datos (migración 20261025120000_retencion_datos.sql) con PostgreSQL real (PGlite, en memoria). Comprueba que la
// función purga por plazo, que el plazo se puede cambiar, que es idempotente y que anon y authenticated no pueden ejecutarla
// ni leer la configuración. pg_cron no existe en PGlite: el planificador solo se comprueba como código condicional.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comoRol, EMULACION_SUPABASE, leerMigracion, MIGRACIONES_PANEL } from './ayudas-bd';

const MIGRACION = '20261025120000_retencion_datos.sql';
const LLAMADA = 'select * from public.purgar_retencion()';

const fuente = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations', MIGRACION),
  'utf8',
);

describe('retención de datos dentro de la base', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(EMULACION_SUPABASE);
    for (const nombre of MIGRACIONES_PANEL) await db.exec(leerMigracion(nombre));
    await db.exec(leerMigracion(MIGRACION));
    // Un aviso de hace 1000 días y otro de hace 10 días; una medición de hace 500 días y otra de hace 5 días; un contador de
    // hace 5 días y otro de hace 10 minutos.
    await db.exec(`
      insert into public.eventos_pago (id_evento, tipo, estado, fecha_aviso, recibido_en) values
        ('viejo-pago', 'PURCHASE_APPROVED', 'aplicado', now() - interval '1000 days', now() - interval '1000 days'),
        ('nuevo-pago', 'PURCHASE_APPROVED', 'aplicado', now() - interval '10 days', now() - interval '10 days');
      insert into public.eventos_app (tipo, dispositivo, creado_en) values
        ('sesion_completada', '11111111-1111-4111-8111-111111111111', now() - interval '500 days'),
        ('sesion_completada', '22222222-2222-4222-8222-222222222222', now() - interval '5 days');
      insert into public.limite_eventos_app (clave, minuto, usos) values
        ('clave-vieja', now() - interval '5 days', 1),
        ('clave-nueva', now() - interval '10 minutes', 1);
    `);
  }, 60_000);

  afterAll(async () => {
    await db.close();
  }, 60_000);

  const filas = async (tabla: string): Promise<number> => {
    const resultado = await db.query<{ n: number }>(
      `select count(*)::int as n from public.${tabla}`,
    );
    return resultado.rows[0].n;
  };

  it('purga solo lo que supera su plazo y devuelve cuántas filas quitó por tabla', async () => {
    const resultado = await db.query<{ tabla: string; filas_borradas: string }>(LLAMADA);
    const porTabla = Object.fromEntries(
      resultado.rows.map((fila) => [fila.tabla, Number(fila.filas_borradas)]),
    );
    expect(porTabla).toEqual({ eventos_pago: 1, eventos_app: 1, limite_eventos_app: 1 });
    expect(await filas('eventos_pago')).toBe(1);
    expect(await filas('eventos_app')).toBe(1);
    expect(await filas('limite_eventos_app')).toBe(1);
  }, 60_000);

  it('es idempotente: una segunda ejecución no borra nada más', async () => {
    const resultado = await db.query<{ filas_borradas: string }>(LLAMADA);
    expect(resultado.rows.every((fila) => Number(fila.filas_borradas) === 0)).toBe(true);
  }, 60_000);

  it('el plazo es configurable: al acortarlo, lo que antes estaba dentro se purga', async () => {
    await db.exec(`update public.retencion_config set dias = 3 where tabla = 'eventos_app'`);
    const resultado = await db.query<{ tabla: string; filas_borradas: string }>(LLAMADA);
    const medicion = resultado.rows.find((fila) => fila.tabla === 'eventos_app');
    expect(Number(medicion?.filas_borradas)).toBe(1);
    expect(await filas('eventos_app')).toBe(0);
    await db.exec(`update public.retencion_config set dias = 395 where tabla = 'eventos_app'`);
  }, 60_000);

  it('anon no puede ejecutar la purga ni leer la configuración', async () => {
    const ejecutar = await comoRol(db, 'anon', {}, LLAMADA);
    expect(ejecutar.ok).toBe(false);
    const leer = await comoRol(db, 'anon', {}, 'select * from public.retencion_config');
    expect(leer.ok).toBe(false);
  }, 60_000);

  it('authenticated tampoco puede ejecutar la purga ni leer la configuración', async () => {
    const ejecutar = await comoRol(
      db,
      'authenticated',
      { sub: '11111111-1111-4111-8111-111111111111' },
      LLAMADA,
    );
    expect(ejecutar.ok).toBe(false);
    const leer = await comoRol(db, 'authenticated', {}, 'select * from public.retencion_config');
    expect(leer.ok).toBe(false);
  }, 60_000);

  it('el planificador solo se crea si pg_cron está habilitada, y no pone permisos a anon', () => {
    expect(fuente).toMatch(/extname = 'pg_cron'/);
    expect(fuente).toMatch(/cron\.schedule\('foco-mente-retencion'/);
    expect(fuente).not.toMatch(/to anon|grant[^;]*anon/i);
  });
});
