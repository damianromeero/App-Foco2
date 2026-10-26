// Migraciones del cobro con Hotmart (20261024110000_compras_hotmart.sql, 20261024120000_accesos.sql y
// 20261024130000_compras_finales_previas.sql) con PostgreSQL real
// (PGlite, en memoria): se ejecutan tal cual, DESPUÉS de las dos de la medición (20261024100000 y 20261024100001), de las
// que dependen: public.es_administrador() y la tabla administradores salen de la primera. Comprueba quién lee, quién
// escribe y qué restricciones tienen las tablas. Correos inventados con dominio reservado (.test).
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ESTADOS_EVENTO } from '../functions/_shared/hotmart.ts';
import {
  comoRol,
  EMULACION_SUPABASE,
  leerMigracion,
  MIGRACIONES_PANEL,
  totalFilas,
} from './ayudas-bd';

const MIGRACIONES_PROPIAS = [
  '20261024110000_compras_hotmart.sql',
  '20261024120000_accesos.sql',
  '20261024130000_compras_finales_previas.sql',
  '20261025100000_acceso_regla_hotmart.sql',
] as const;
const TABLAS = [
  'compras',
  'suscripciones_hotmart',
  'eventos_pago',
  'accesos',
  'compras_finales_previas',
] as const;

const ADMIN = '00000000-0000-4000-8000-0000000000a1';
const OTRA = '00000000-0000-4000-8000-0000000000b2';
const ANA = 'ana@ejemplo.test';
const BEA = 'bea@ejemplo.test';

let db: PGlite;

const como = (
  rol: 'anon' | 'authenticated',
  notas: Record<string, unknown>,
  sql: string,
  params: unknown[] = [],
) => comoRol(db, rol, notas, sql, params);

const admin2 = { sub: ADMIN, aal: 'aal2', role: 'authenticated', email: 'admin@ejemplo.test' };
const admin1 = { sub: ADMIN, aal: 'aal1', role: 'authenticated', email: 'admin@ejemplo.test' };
const otra2 = { sub: OTRA, aal: 'aal2', role: 'authenticated', email: 'otra@ejemplo.test' };
const cliente = (correo: string) => ({
  sub: '00000000-0000-4000-8000-0000000000c1',
  email: correo,
  role: 'authenticated',
  aal: 'aal1',
});

/** Cuántas filas devuelve una consulta de conteo, o -1 si falló (para que un error no pase por «cero filas»). */
async function contar(
  rol: 'anon' | 'authenticated',
  notas: Record<string, unknown>,
  tabla: string,
): Promise<number> {
  const resultado = await como(rol, notas, `select count(*)::int as n from public.${tabla}`);
  return resultado.ok ? Number(resultado.filas[0]?.n) : -1;
}

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(EMULACION_SUPABASE);
  for (const nombre of MIGRACIONES_PANEL) await db.exec(leerMigracion(nombre));
  // Datos de prueba, como superusuario (se salta RLS).
  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${OTRA}');
    insert into public.administradores (usuario_id) values ('${ADMIN}');
    insert into public.compras (id_hotmart, plan, monto_usd, comision_usd, suscriptor, correo, estado, fecha_aviso)
      values ('TRX-1', 'mensual', 5.99, 0.30, 'SUS-1', '${ANA}', 'aprobada', '2026-10-24T01:00:00.000Z'),
             ('TRX-2', 'anual', 59.90, null, null, '${BEA}', 'aprobada', '2026-10-24T02:00:00.000Z');
    insert into public.suscripciones_hotmart (suscriptor, plan, estado, fecha_aviso)
      values ('SUS-1', 'mensual', 'activa', '2026-10-24T01:00:00.000Z');
    insert into public.eventos_pago (id_evento, tipo, estado, fecha_aviso)
      values ('aviso-1', 'PURCHASE_APPROVED', 'aplicado', '2026-10-24T01:00:00.000Z');
    insert into public.accesos (correo, estado, origen)
      values ('${ANA}', 'activo', 'PURCHASE_APPROVED'), ('${BEA}', 'inactivo', 'PURCHASE_REFUNDED');
  `);
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('los archivos de las migraciones', () => {
  for (const nombre of MIGRACIONES_PROPIAS) {
    const sql = leerMigracion(nombre);
    // Sin comentarios: pueden nombrar `anon` para decir que no tiene permisos.
    const codigo = sql.replace(/--.*$/gm, '');

    it(`${nombre}: cada create table activa RLS y revoca anon y authenticated en el MISMO archivo`, () => {
      const tablas = [
        ...codigo.matchAll(/create table(?: if not exists)?\s+public\.([a-z_]+)/gi),
      ].map((m) => m[1]);
      // Un archivo sin create table (p. ej. la regla de acceso, que solo añade columnas y una vista) no tiene nada que comprobar aquí.
      for (const tabla of tablas) {
        expect(codigo, `RLS de ${tabla}`).toMatch(
          new RegExp(`alter table public\\.${tabla}\\s+enable row level security`, 'i'),
        );
        expect(codigo, `revoke de ${tabla}`).toMatch(
          new RegExp(`revoke all on public\\.${tabla}\\s+from anon, authenticated`, 'i'),
        );
      }
    });

    it(`${nombre}: no concede nada a anon ni escritura a authenticated`, () => {
      const concesiones = [...codigo.matchAll(/grant\s+([^;]*?)\s+on\s+[^;]*?\s+to\s+([^;]*);/gi)];
      for (const [, privilegios, destino] of concesiones) {
        expect(destino, `grant ${privilegios}`).not.toMatch(/\banon\b/i);
        expect(destino, `grant ${privilegios}`).not.toMatch(/\bpublic\b/i);
        if (/\bauthenticated\b/i.test(destino ?? ''))
          expect((privilegios ?? '').trim().toLowerCase()).toBe('select');
      }
      expect(codigo).not.toMatch(/\bservice_role\b/i);
    });
  }

  it('la restricción de estado de eventos_pago repite ESTADOS_EVENTO del código, sin faltar ni sobrar ninguno', () => {
    const sql = leerMigracion('20261024110000_compras_hotmart.sql').replace(/--.*$/gm, '');
    const bloque =
      /create table if not exists public\.eventos_pago\s*\(([\s\S]*?)\n\);/i.exec(sql)?.[1] ?? '';
    const lista = /estado text not null check \(estado in \(([^)]*)\)\)/i.exec(bloque)?.[1] ?? '';
    const enSql = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    expect(enSql.length).toBeGreaterThan(0);
    expect(enSql).toEqual([...ESTADOS_EVENTO].sort());
  });
});

describe('sin sesión (rol anon): ninguna tabla se lee ni se escribe', () => {
  for (const tabla of TABLAS) {
    it(`no puede leer public.${tabla}`, async () => {
      const resultado = await como('anon', {}, `select count(*) from public.${tabla}`);
      expect(resultado.ok).toBe(false);
      expect(resultado.ok ? '' : resultado.error).toMatch(/permission denied/);
    });

    it(`no puede escribir en public.${tabla}`, async () => {
      for (const sql of [
        `delete from public.${tabla}`,
        `update public.${tabla} set creado_en = now()`,
        `truncate public.${tabla}`,
      ]) {
        const resultado = await como('anon', {}, sql);
        expect(resultado.ok, sql).toBe(false);
      }
    });
  }

  it('no puede insertar compras, eventos de pago ni accesos', async () => {
    const intentos = [
      `insert into public.compras (id_hotmart, plan, monto_usd, correo, estado, fecha_aviso) values ('X', 'mensual', 1, '${ANA}', 'aprobada', now())`,
      `insert into public.eventos_pago (id_evento, tipo, estado) values ('x', 'PURCHASE_APPROVED', 'aplicado')`,
      `insert into public.accesos (correo, estado, origen) values ('${ANA}', 'activo', 'manual')`,
      `insert into public.suscripciones_hotmart (suscriptor, plan, estado, fecha_aviso) values ('X', 'mensual', 'activa', now())`,
    ];
    for (const sql of intentos) {
      const resultado = await como('anon', {}, sql);
      expect(resultado.ok, sql).toBe(false);
      expect(resultado.ok ? '' : resultado.error).toMatch(/permission denied/);
    }
  });
});

describe('accesos: cada persona lee solo su propia fila', () => {
  it('con su correo en el token ve exactamente su fila', async () => {
    const resultado = await como(
      'authenticated',
      cliente(ANA),
      'select correo, estado from public.accesos',
    );
    expect(resultado).toEqual({ ok: true, filas: [{ correo: ANA, estado: 'activo' }] });
  });

  it('el correo del token se compara sin distinguir mayúsculas', async () => {
    const resultado = await como(
      'authenticated',
      cliente('ANA@Ejemplo.test'),
      'select correo from public.accesos',
    );
    expect(resultado).toEqual({ ok: true, filas: [{ correo: ANA }] });
  });

  it('un correo sin fila no ve ninguna, ni la de otra persona', async () => {
    const resultado = await como(
      'authenticated',
      cliente('nadie@ejemplo.test'),
      'select correo from public.accesos',
    );
    expect(resultado).toEqual({ ok: true, filas: [] });
  });

  it('filtrar por el correo de otra persona no revela su fila', async () => {
    const resultado = await como(
      'authenticated',
      cliente(ANA),
      'select correo from public.accesos where correo = $1',
      [BEA],
    );
    expect(resultado).toEqual({ ok: true, filas: [] });
  });

  it('sin correo en el token (o con un correo vacío o nulo) no ve ninguna fila', async () => {
    for (const notas of [
      { sub: OTRA, role: 'authenticated' },
      { sub: OTRA, email: '', role: 'authenticated' },
      { sub: OTRA, email: null, role: 'authenticated' },
      {},
    ]) {
      const resultado = await como('authenticated', notas, 'select correo from public.accesos');
      expect(resultado, JSON.stringify(notas)).toEqual({ ok: true, filas: [] });
    }
  });

  it('una administradora con aal2 tampoco ve las filas de otras personas en accesos', async () => {
    const resultado = await como('authenticated', admin2, 'select correo from public.accesos');
    expect(resultado).toEqual({ ok: true, filas: [] });
  });
});

describe('authenticated no escribe en ninguna tabla de cobro', () => {
  const personas: [string, Record<string, unknown>][] = [
    ['una persona con sesión', cliente(ANA)],
    ['una persona que no es administradora, con aal2', otra2],
    ['una administradora con aal1', admin1],
    ['una administradora con aal2', admin2],
  ];
  for (const [quien, notas] of personas) {
    for (const tabla of TABLAS) {
      it(`${quien} no puede insertar, cambiar ni borrar en public.${tabla}`, async () => {
        const antes = await totalFilas(db, tabla);
        const sentencias = [
          `delete from public.${tabla}`,
          tabla === 'accesos'
            ? `update public.accesos set estado = 'activo'`
            : `update public.${tabla} set estado = estado`,
          tabla === 'compras'
            ? `insert into public.compras (id_hotmart, plan, monto_usd, correo, estado, fecha_aviso) values ('Y', 'mensual', 1, 'y@ejemplo.test', 'aprobada', now())`
            : tabla === 'suscripciones_hotmart'
              ? `insert into public.suscripciones_hotmart (suscriptor, plan, estado, fecha_aviso) values ('Y', 'mensual', 'activa', now())`
              : tabla === 'eventos_pago'
                ? `insert into public.eventos_pago (id_evento, tipo, estado) values ('y', 'PURCHASE_APPROVED', 'aplicado')`
                : `insert into public.accesos (correo, estado, origen) values ('y@ejemplo.test', 'activo', 'manual')`,
        ];
        for (const sql of sentencias) {
          const resultado = await como('authenticated', notas, sql);
          expect(resultado.ok, sql).toBe(false);
          expect(resultado.ok ? '' : resultado.error, sql).toMatch(/permission denied/);
        }
        expect(await totalFilas(db, tabla)).toBe(antes);
      });
    }
  }

  it('una persona con sesión que se da a sí misma acceso con un insert no lo consigue', async () => {
    const resultado = await como(
      'authenticated',
      cliente('listo@ejemplo.test'),
      "insert into public.accesos (correo, estado, origen) values ('listo@ejemplo.test', 'activo', 'PURCHASE_APPROVED') on conflict (correo) do update set estado = 'activo'",
    );
    expect(resultado.ok).toBe(false);
  });
});

describe('lectura de compras, suscripciones y eventos: solo es_administrador() (administradora con aal2)', () => {
  const tablas = ['compras', 'suscripciones_hotmart', 'eventos_pago'] as const;

  it('la administradora con aal2 ve todas las filas', async () => {
    expect(await contar('authenticated', admin2, 'compras')).toBe(2);
    expect(await contar('authenticated', admin2, 'suscripciones_hotmart')).toBe(1);
    expect(await contar('authenticated', admin2, 'eventos_pago')).toBe(1);
  });

  it('la administradora con solo correo (aal1) no ve ninguna fila: la lectura exige segundo factor', async () => {
    for (const tabla of tablas) expect(await contar('authenticated', admin1, tabla), tabla).toBe(0);
  });

  it('una persona que no está en administradores, aunque tenga aal2, no ve ninguna fila', async () => {
    for (const tabla of tablas) expect(await contar('authenticated', otra2, tabla), tabla).toBe(0);
  });

  it('un comprador con sesión no ve su propia compra: las compras son solo de administración', async () => {
    const resultado = await como(
      'authenticated',
      cliente(ANA),
      'select id_hotmart from public.compras',
    );
    expect(resultado).toEqual({ ok: true, filas: [] });
  });

  it('sin token (sin sub ni aal) la lectura no devuelve nada', async () => {
    for (const tabla of tablas) expect(await contar('authenticated', {}, tabla), tabla).toBe(0);
  });

  it('la administradora lee las columnas que usará el panel, con el correo y la fecha del aviso', async () => {
    const resultado = await como(
      'authenticated',
      admin2,
      'select id_hotmart, plan, monto_usd, comision_usd, suscriptor, correo, estado, fecha_aviso from public.compras order by id_hotmart',
    );
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.filas[0]).toMatchObject({
      id_hotmart: 'TRX-1',
      plan: 'mensual',
      suscriptor: 'SUS-1',
      correo: ANA,
      estado: 'aprobada',
    });
    expect(resultado.filas[1]).toMatchObject({
      id_hotmart: 'TRX-2',
      plan: 'anual',
      comision_usd: null,
      suscriptor: null,
    });
  });
});

describe('restricciones de las tablas', () => {
  const intento = (sql: string) =>
    db.exec(sql).then(
      () => 'ok',
      (error: Error) => error.message,
    );
  const compra = (campos: Record<string, string>) => {
    const base = {
      id_hotmart: "'TRX-R'",
      plan: "'mensual'",
      monto_usd: '5.99',
      correo: `'${ANA}'`,
      estado: "'aprobada'",
      fecha_aviso: 'now()',
      ...campos,
    };
    return `insert into public.compras (${Object.keys(base).join(', ')}) values (${Object.values(base).join(', ')})`;
  };

  it('compras exige fecha_aviso, correo en minúsculas, importes no negativos, plan y estado de la lista', async () => {
    expect(await intento(compra({ fecha_aviso: 'null' }))).toMatch(/null value|not-null/i);
    expect(await intento(compra({ correo: "'Ana@Ejemplo.test'" }))).toMatch(/check constraint/i);
    expect(await intento(compra({ correo: "'a'" }))).toMatch(/check constraint/i);
    expect(await intento(compra({ monto_usd: '-1' }))).toMatch(/check constraint/i);
    expect(await intento(compra({ comision_usd: '-1' }))).toMatch(/check constraint/i);
    expect(await intento(compra({ plan: "'semanal'" }))).toMatch(/check constraint/i);
    expect(await intento(compra({ estado: "'pendiente'" }))).toMatch(/check constraint/i);
    expect(await intento(compra({ id_hotmart: "''" }))).toMatch(/check constraint/i);
    expect(await totalFilas(db, 'compras')).toBe(2);
  });

  it('compras acepta una compra completa y una sin comisión ni suscriptor; creado_en se rellena solo', async () => {
    expect(
      await intento(
        compra({ id_hotmart: "'TRX-OK-1'", comision_usd: '0.30', suscriptor: "'SUS-9'" }),
      ),
    ).toBe('ok');
    expect(await intento(compra({ id_hotmart: "'TRX-OK-2'" }))).toBe('ok');
    const { rows } = await db.query<{ creado_en: Date | null }>(
      "select creado_en from public.compras where id_hotmart = 'TRX-OK-2'",
    );
    expect(rows[0]?.creado_en).not.toBeNull();
    await db.exec("delete from public.compras where id_hotmart in ('TRX-OK-1', 'TRX-OK-2')");
  });

  it('suscripciones_hotmart: el plan puede faltar; el estado de la lista y fecha_aviso son obligatorios', async () => {
    const sus = (campos: Record<string, string>) => {
      const base = {
        suscriptor: "'SUS-R'",
        plan: "'mensual'",
        estado: "'activa'",
        fecha_aviso: 'now()',
        ...campos,
      };
      return `insert into public.suscripciones_hotmart (${Object.keys(base).join(', ')}) values (${Object.values(base).join(', ')})`;
    };
    // El plan puede faltar: una cancelación que llega antes del primer cobro guarda solo la cancelación.
    expect(await intento(sus({ suscriptor: "'SUS-SIN-PLAN'", plan: 'null' }))).toBe('ok');
    expect(await intento(sus({ plan: "'trimestral'" }))).toMatch(/check constraint/i);
    expect(await intento(sus({ estado: "'pausada'" }))).toMatch(/check constraint/i);
    expect(await intento(sus({ fecha_aviso: 'null' }))).toMatch(/null value|not-null/i);
    expect(await intento(sus({}))).toBe('ok');
    await db.exec("delete from public.suscripciones_hotmart where suscriptor = 'SUS-R'");
  });

  it('eventos_pago acepta cada estado de ESTADOS_EVENTO (con y sin fecha) y rechaza uno desconocido', async () => {
    for (const estado of ESTADOS_EVENTO) {
      expect(
        await intento(
          `insert into public.eventos_pago (id_evento, tipo, estado) values ('prueba-${estado}', 'PURCHASE_APPROVED', '${estado}')`,
        ),
        estado,
      ).toBe('ok');
    }
    expect(
      await intento(
        "insert into public.eventos_pago (id_evento, tipo, estado, fecha_aviso) values ('prueba-con-fecha', 'X', 'aplicado', now())",
      ),
    ).toBe('ok');
    expect(
      await intento(
        "insert into public.eventos_pago (id_evento, tipo, estado) values ('prueba-raro', 'X', 'otro-estado')",
      ),
    ).toMatch(/check constraint/i);
    expect(
      await intento(
        "insert into public.eventos_pago (id_evento, tipo, estado) values ('', 'X', 'aplicado')",
      ),
    ).toMatch(/check constraint/i);
    await db.exec("delete from public.eventos_pago where id_evento like 'prueba-%'");
  });

  it('eventos_pago no tiene ninguna columna para el correo ni para datos de la persona', async () => {
    const { rows } = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'eventos_pago' order by column_name",
    );
    expect(rows.map((fila) => fila.column_name)).toEqual([
      'estado',
      'fecha_aviso',
      'id_evento',
      'recibido_en',
      'tipo',
    ]);
  });

  it('accesos exige correo en minúsculas, estado de la lista y origen', async () => {
    expect(
      await intento(
        "insert into public.accesos (correo, estado, origen) values ('Ana2@Ejemplo.test', 'activo', 'x')",
      ),
    ).toMatch(/check constraint/i);
    expect(
      await intento(
        "insert into public.accesos (correo, estado, origen) values ('ana2@ejemplo.test', 'suspendido', 'x')",
      ),
    ).toMatch(/check constraint/i);
    expect(
      await intento(
        "insert into public.accesos (correo, estado, origen) values ('ana2@ejemplo.test', 'activo', '')",
      ),
    ).toMatch(/check constraint/i);
    expect(
      await intento(
        "insert into public.accesos (correo, estado, origen) values ('ana2@ejemplo.test', 'activo', 'PURCHASE_APPROVED')",
      ),
    ).toBe('ok');
    await db.exec("delete from public.accesos where correo = 'ana2@ejemplo.test'");
  });
});

describe('lo que hace la función contra estas tablas (PostgREST se traduce a este SQL)', () => {
  it('on_conflict con ignore-duplicates: la clave primaria de cada tabla admite «on conflict (…) do nothing»', async () => {
    await db.exec(`
      insert into public.compras (id_hotmart, plan, monto_usd, correo, estado, fecha_aviso)
        values ('TRX-1', 'mensual', 5.99, '${ANA}', 'reembolsada', now()) on conflict (id_hotmart) do nothing;
      insert into public.suscripciones_hotmart (suscriptor, plan, estado, fecha_aviso)
        values ('SUS-1', 'mensual', 'cancelada', now()) on conflict (suscriptor) do nothing;
      insert into public.eventos_pago (id_evento, tipo, estado) values ('aviso-1', 'X', 'obsoleto') on conflict (id_evento) do nothing;
    `);
    const { rows } = await db.query<{ estado: string }>(
      "select estado from public.compras where id_hotmart = 'TRX-1' union all select estado from public.suscripciones_hotmart where suscriptor = 'SUS-1' union all select estado from public.eventos_pago where id_evento = 'aviso-1'",
    );
    expect(rows.map((fila) => fila.estado)).toEqual(['aprobada', 'activa', 'aplicado']);
  });

  it('on_conflict con merge-duplicates: accesos se actualiza por correo', async () => {
    await db.exec(
      `insert into public.accesos (correo, estado, origen, cambiado_en) values ('${BEA}', 'activo', 'PURCHASE_APPROVED', now()) on conflict (correo) do update set estado = excluded.estado, origen = excluded.origen, cambiado_en = excluded.cambiado_en`,
    );
    const { rows } = await db.query<{ estado: string; origen: string }>(
      `select estado, origen from public.accesos where correo = '${BEA}'`,
    );
    expect(rows).toEqual([{ estado: 'activo', origen: 'PURCHASE_APPROVED' }]);
    await db.exec(
      `update public.accesos set estado = 'inactivo', origen = 'PURCHASE_REFUNDED' where correo = '${BEA}'`,
    );
  });

  it('el reembolso con fecha_aviso=lt.<fecha> solo cambia si el aviso es más reciente (con milisegundos exactos)', async () => {
    const parche = (fecha: string) =>
      db.query<{ id_hotmart: string }>(
        "update public.compras set estado = 'reembolsada', fecha_aviso = $1 where id_hotmart = 'TRX-2' and fecha_aviso < $1 returning id_hotmart",
        [fecha],
      );
    // Guardada: 2026-10-24T02:00:00.000Z.
    expect((await parche('2026-10-24T01:59:59.999Z')).rows).toEqual([]); // más antiguo
    expect((await parche('2026-10-24T02:00:00.000Z')).rows).toEqual([]); // igual
    expect((await parche('2026-10-24T02:00:00.001Z')).rows).toEqual([{ id_hotmart: 'TRX-2' }]); // más reciente
    expect((await parche('2026-10-24T02:00:00.001Z')).rows).toEqual([]); // repetido
    await db.exec(
      "update public.compras set estado = 'aprobada', fecha_aviso = '2026-10-24T02:00:00.000Z' where id_hotmart = 'TRX-2'",
    );
  });
});

describe('regla de acceso (20261025100000): estados nuevos y vista accesos_vigentes', () => {
  const intento = (sql: string) =>
    db.exec(sql).then(
      () => 'ok',
      (error: Error) => error.message,
    );

  it('compras acepta el estado «mantenida» (Hotmart reintenta el cobro) y no un estado inventado', async () => {
    expect(
      await intento(
        "insert into public.compras (id_hotmart, plan, monto_usd, correo, estado, fecha_aviso) values ('TRX-M', 'mensual', 5.99, 'm@ejemplo.test', 'mantenida', now())",
      ),
    ).toBe('ok');
    expect(
      await intento(
        "insert into public.compras (id_hotmart, plan, monto_usd, correo, estado, fecha_aviso) values ('TRX-M2', 'mensual', 5.99, 'm@ejemplo.test', 'pendiente', now())",
      ),
    ).toMatch(/check constraint/i);
    await db.exec("delete from public.compras where id_hotmart = 'TRX-M'");
  });

  it('suscripciones acepta el motivo y el último cobro de la regla, y rechaza valores fuera de lista', async () => {
    expect(
      await intento(
        "insert into public.suscripciones_hotmart (suscriptor, estado, motivo, acceso_hasta, ultimo_cobro, fecha_aviso) values ('SUS-R', 'cancelada', 'voluntaria', '2999-01-01T00:00:00Z', 'aprobado', now())",
      ),
    ).toBe('ok');
    expect(
      await intento(
        "insert into public.suscripciones_hotmart (suscriptor, estado, motivo, fecha_aviso) values ('SUS-R2', 'cancelada', 'aburrimiento', now())",
      ),
    ).toMatch(/check constraint/i);
    await db.exec("delete from public.suscripciones_hotmart where suscriptor = 'SUS-R'");
  });

  it('anon no puede leer accesos_vigentes ni escribir en ella', async () => {
    expect((await como('anon', {}, 'select correo from public.accesos_vigentes')).ok).toBe(false);
    expect(
      (
        await como(
          'authenticated',
          cliente(ANA),
          "insert into public.accesos_vigentes (correo, estado, origen) values ('x@ejemplo.test', 'activo', 'x')",
        )
      ).ok,
    ).toBe(false);
  });

  it('cada persona ve en la vista solo su fila, y solo si está activa', async () => {
    expect(
      await como('authenticated', cliente(ANA), 'select correo from public.accesos_vigentes'),
    ).toEqual({ ok: true, filas: [{ correo: ANA }] });
    // Bea tiene su fila inactiva: no aparece en la vista, aunque la tabla la tenga.
    expect(
      await como('authenticated', cliente(BEA), 'select correo from public.accesos_vigentes'),
    ).toEqual({ ok: true, filas: [] });
  });

  it('un acceso activo cuyo fin (acceso_hasta) ya pasó no aparece; con un fin futuro sí', async () => {
    await db.exec(
      `update public.accesos set acceso_hasta = '2000-01-01T00:00:00Z' where correo = '${ANA}'`,
    );
    expect(
      await como('authenticated', cliente(ANA), 'select correo from public.accesos_vigentes'),
    ).toEqual({ ok: true, filas: [] });
    await db.exec(
      `update public.accesos set acceso_hasta = '2999-01-01T00:00:00Z' where correo = '${ANA}'`,
    );
    expect(
      await como('authenticated', cliente(ANA), 'select correo from public.accesos_vigentes'),
    ).toEqual({ ok: true, filas: [{ correo: ANA }] });
    await db.exec(`update public.accesos set acceso_hasta = null where correo = '${ANA}'`);
  });

  it('la tabla accesos sigue visible solo para su propia fila (la vista hereda la RLS)', async () => {
    expect(await como('authenticated', cliente(BEA), 'select correo from public.accesos')).toEqual({
      ok: true,
      filas: [{ correo: BEA }],
    });
  });
});

describe('las migraciones se pueden ejecutar de nuevo sin romper nada', () => {
  it('ejecutarlas otra vez no falla y no cambia permisos ni datos', async () => {
    const antes = await Promise.all(TABLAS.map((tabla) => totalFilas(db, tabla)));
    for (const nombre of MIGRACIONES_PROPIAS) await db.exec(leerMigracion(nombre));
    expect(await Promise.all(TABLAS.map((tabla) => totalFilas(db, tabla)))).toEqual(antes);
    const lectura = await como('anon', {}, 'select count(*) from public.compras');
    expect(lectura.ok).toBe(false);
    expect(await contar('authenticated', admin2, 'compras')).toBe(2);
    const propia = await como('authenticated', cliente(ANA), 'select correo from public.accesos');
    expect(propia).toEqual({ ok: true, filas: [{ correo: ANA }] });
  });
});
