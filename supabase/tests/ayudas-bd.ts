// Ayudas compartidas de las pruebas de base (PostgreSQL en memoria con PGlite). Emulan lo que Supabase pone alrededor de
// las migraciones: el esquema auth (auth.uid y auth.jwt leen las notas del token), los roles anon y authenticated, y los
// permisos por defecto que Supabase concede en public. Si una migración olvidara un revoke, las pruebas lo verían.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PGlite } from '@electric-sql/pglite';

/** Migraciones del panel y de la medición, en el orden en que la persona las ejecuta (docs/INFRAESTRUCTURA.md, paso 3.2). */
export const MIGRACIONES_PANEL = [
  '20261024100000_panel_admin.sql',
  '20261024100001_limite_eventos.sql',
  '20261024110000_compras_hotmart.sql',
  '20261024120000_accesos.sql',
  '20261024130000_compras_finales_previas.sql',
  '20261025100000_acceso_regla_hotmart.sql',
  '20261025110000_borrar_mi_cuenta.sql',
] as const;

/** Lee una migración de supabase/migrations/ por su nombre. */
// Se resuelve con rutas y no con `new URL(...)`: en el entorno jsdom de Vitest, URL es la de jsdom y fs no la acepta.
export const leerMigracion = (nombre: string): string =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations', nombre), 'utf8');

/** Todas las migraciones del panel, concatenadas en orden. */
export const leerMigracionesPanel = (): string => MIGRACIONES_PANEL.map(leerMigracion).join('\n');

export const EMULACION_SUPABASE = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

/** Ejecuta una sentencia con un rol y las notas de un token. Devuelve las filas o el mensaje de error de Postgres. */
export async function comoRol(
  db: PGlite,
  rol: 'anon' | 'authenticated',
  notas: Record<string, unknown>,
  sql: string,
  params: unknown[] = [],
): Promise<{ ok: true; filas: Record<string, unknown>[] } | { ok: false; error: string }> {
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(notas)]);
  await db.exec(`set role ${rol}`);
  try {
    const resultado = await db.query(sql, params);
    return { ok: true, filas: resultado.rows as Record<string, unknown>[] };
  } catch (fallo) {
    return { ok: false, error: (fallo as Error).message };
  } finally {
    await db.exec('reset role');
  }
}

/** Número de filas de una tabla, leído como superusuario (sin RLS). */
export async function totalFilas(db: PGlite, tabla: string): Promise<number> {
  const resultado = await db.query<{ n: number }>(`select count(*)::int as n from public.${tabla}`);
  return resultado.rows[0].n;
}
