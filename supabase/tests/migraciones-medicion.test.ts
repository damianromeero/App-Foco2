// Migraciones del panel y de la medición (20261024100000 y 20261024100001) con PostgreSQL real (PGlite): quién puede
// leer, quién puede escribir y cómo limita registrar_evento_app. Solo se aplican las dos migraciones de la medición,
// así estas pruebas no dependen de las de compras y accesos.
//
// Sobre el reloj: los contadores usan el minuto actual. Para no depender de cruzar un minuto a mitad de una prueba, las
// comprobaciones de «la siguiente llamada se rechaza» preparan antes el contador del minuto actual.
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EVENTOS_APP, VALORES, type TipoValor } from '../functions/_shared/eventos.ts';
import { comoRol, EMULACION_SUPABASE, leerMigracion, totalFilas } from './ayudas-bd';

/** Solo las dos migraciones de la medición, en el orden en que la persona las ejecuta. */
const MIGRACIONES_MEDICION = [
  '20261024100000_panel_admin.sql',
  '20261024100001_limite_eventos.sql',
] as const;

const ADMINISTRADORA = '00000000-0000-4000-8000-0000000000a1';
const PERSONA_CUALQUIERA = '00000000-0000-4000-8000-0000000000b2';

/** UUID de dispositivo de prueba, distinto para cada número. */
const dispositivo = (n: number): string =>
  `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

let db: PGlite;
let siguiente = 1000;
const nuevoDispositivo = (): string => dispositivo(siguiente++);

/** Llama a la función como anon (la clave pública). Devuelve lo que devuelve la base, o lanza con su mensaje de error. */
async function registrar(
  disp: string,
  tipo: string,
  valor: string | null = null,
): Promise<boolean> {
  const resultado = await comoRol(
    db,
    'anon',
    {},
    'select public.registrar_evento_app($1, $2, $3) as guardado',
    [tipo, disp, valor],
  );
  if (!resultado.ok) throw new Error(resultado.error);
  return resultado.filas[0]?.guardado as boolean;
}

/** Eventos guardados de un dispositivo, leídos como superusuario. */
async function eventosDe(disp: string): Promise<number> {
  const resultado = await db.query<{ n: number }>(
    'select count(*)::int as n from public.eventos_app where dispositivo = $1',
    [disp],
  );
  return resultado.rows[0]?.n ?? 0;
}

/** Contadores de un dispositivo, leídos como superusuario. */
async function contadoresDe(disp: string): Promise<number> {
  const resultado = await db.query<{ n: number }>(
    'select count(*)::int as n from public.limite_eventos_app where clave = $1',
    [`dispositivo:${disp}`],
  );
  return resultado.rows[0]?.n ?? 0;
}

/** Prepara el contador del minuto actual con un valor concreto (superusuario): la siguiente llamada cae justo en el límite. */
async function fijarContador(clave: string, usos: number): Promise<void> {
  await db.query(
    `insert into public.limite_eventos_app (clave, minuto, usos) values ($1, date_trunc('minute', now()), $2)
     on conflict (clave, minuto) do update set usos = excluded.usos`,
    [clave, usos],
  );
}

/** Un valor válido de cada lista, para el evento que la usa. */
const valorDePrueba = (tipoValor: TipoValor | null): string | null =>
  tipoValor === null ? null : (VALORES[tipoValor][0] ?? null);

const sesionDe = (sub: string, aal: 'aal1' | 'aal2') => ({ sub, aal, role: 'authenticated' });

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(EMULACION_SUPABASE);
  for (const nombre of MIGRACIONES_MEDICION) await db.exec(leerMigracion(nombre));
  await db.exec(
    `insert into auth.users (id) values ('${ADMINISTRADORA}'), ('${PERSONA_CUALQUIERA}');`,
  );
}, 60_000);

afterAll(async () => {
  await db.close();
});

describe('administradores', () => {
  it('la migración no añade a nadie como administrador', async () => {
    expect(await totalFilas(db, 'administradores')).toBe(0);
    // Con la lista vacía, nadie es administrador, ni siquiera con segundo factor.
    const resultado = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal2'),
      'select public.soy_administrador() as soy, public.es_administrador() as es',
    );
    expect(resultado).toEqual({ ok: true, filas: [{ soy: false, es: false }] });
  });

  it('soy_administrador y es_administrador no son ejecutables por anon', async () => {
    for (const funcion of ['soy_administrador', 'es_administrador']) {
      const resultado = await comoRol(db, 'anon', {}, `select public.${funcion}()`);
      expect(resultado.ok, funcion).toBe(false);
      expect(resultado.ok ? '' : resultado.error).toMatch(/permission denied/);
    }
  });

  it('las funciones del panel son security definer con el search_path vacío', async () => {
    const funciones = await db.query<{
      proname: string;
      prosecdef: boolean;
      proconfig: string[] | null;
    }>(
      `select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('soy_administrador', 'es_administrador', 'registrar_evento_app') order by p.proname`,
    );
    expect(funciones.rows.map((fila) => fila.proname)).toEqual([
      'es_administrador',
      'registrar_evento_app',
      'soy_administrador',
    ]);
    for (const fila of funciones.rows) {
      expect(fila.prosecdef, fila.proname).toBe(true);
      const ruta = (fila.proconfig ?? []).find((ajuste) => ajuste.startsWith('search_path='));
      expect(ruta?.replace(/^search_path=/, '').replaceAll('"', ''), fila.proname).toBe('');
    }
  });
});

describe('quién lee y quién escribe', () => {
  const TABLAS = ['eventos_app', 'administradores', 'limite_eventos_app'];

  beforeAll(async () => {
    await registrar(nuevoDispositivo(), 'portada_vista');
  });

  it('las tres tablas tienen RLS activo', async () => {
    const resultado = await db.query<{ relname: string; activo: boolean }>(
      `select relname, relrowsecurity as activo from pg_class where relname = any($1) and relkind = 'r' order by relname`,
      [TABLAS],
    );
    expect(resultado.rows).toEqual([
      { relname: 'administradores', activo: true },
      { relname: 'eventos_app', activo: true },
      { relname: 'limite_eventos_app', activo: true },
    ]);
  });

  it('anon no lee ninguna de las tres tablas', async () => {
    for (const tabla of TABLAS) {
      const lectura = await comoRol(db, 'anon', {}, `select count(*) from public.${tabla}`);
      expect(lectura.ok, tabla).toBe(false);
      expect(lectura.ok ? '' : lectura.error, tabla).toMatch(/permission denied/);
    }
  });

  it('una persona con sesión que no es administradora no lee eventos ni administradores, ni con segundo factor', async () => {
    expect(await totalFilas(db, 'eventos_app')).toBeGreaterThan(0);
    for (const aal of ['aal1', 'aal2'] as const) {
      for (const tabla of ['eventos_app', 'administradores']) {
        const lectura = await comoRol(
          db,
          'authenticated',
          sesionDe(PERSONA_CUALQUIERA, aal),
          `select count(*)::int as n from public.${tabla}`,
        );
        expect(lectura, `${tabla} ${aal}`).toEqual({ ok: true, filas: [{ n: 0 }] });
      }
    }
  });

  it('authenticated no lee los contadores del límite', async () => {
    const lectura = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal2'),
      'select count(*) from public.limite_eventos_app',
    );
    expect(lectura.ok).toBe(false);
    expect(lectura.ok ? '' : lectura.error).toMatch(/permission denied/);
  });

  it('ni anon ni authenticated escriben directamente en eventos_app', async () => {
    const intentos = [
      `insert into public.eventos_app (tipo, dispositivo) values ('portada_vista', '${dispositivo(1)}')`,
      `update public.eventos_app set tipo = 'portada_vista'`,
      'delete from public.eventos_app',
    ];
    for (const rol of ['anon', 'authenticated'] as const) {
      for (const sql of intentos) {
        const resultado = await comoRol(db, rol, sesionDe(ADMINISTRADORA, 'aal2'), sql);
        expect(resultado.ok, `${rol}: ${sql}`).toBe(false);
        expect(resultado.ok ? '' : resultado.error).toMatch(/permission denied/);
      }
    }
  });

  it('ni anon ni authenticated escriben en administradores ni en los contadores', async () => {
    const intentos = [
      `insert into public.administradores (usuario_id) values ('${PERSONA_CUALQUIERA}')`,
      `insert into public.limite_eventos_app (clave, minuto, usos) values ('total', now(), 0)`,
      'delete from public.administradores',
    ];
    for (const rol of ['anon', 'authenticated'] as const) {
      for (const sql of intentos) {
        const resultado = await comoRol(db, rol, sesionDe(ADMINISTRADORA, 'aal2'), sql);
        expect(resultado.ok, `${rol}: ${sql}`).toBe(false);
      }
    }
    expect(await totalFilas(db, 'administradores')).toBe(0);
  });

  it('las filas de eventos_app respetan la forma, también con la clave de servicio (superusuario)', async () => {
    for (const [tipo, valor] of [
      ['Tipo con Mayúsculas', null],
      ['', null],
      ['portada_vista', 'Con Mayúsculas'],
      ['portada_vista', ''],
      ['portada_vista', 'x'.repeat(61)],
    ] as const) {
      await expect(
        db.query('insert into public.eventos_app (tipo, dispositivo, valor) values ($1, $2, $3)', [
          tipo,
          dispositivo(2),
          valor,
        ]),
      ).rejects.toThrow(/check constraint|violates/);
    }
  });
});

describe('solo una administradora con segundo factor lee eventos_app', () => {
  beforeAll(async () => {
    await db.exec(`insert into public.administradores (usuario_id) values ('${ADMINISTRADORA}')`);
    await registrar(nuevoDispositivo(), 'precios_vista');
  });

  it('con segundo factor (aal2) ve las filas y es_administrador es true', async () => {
    const total = await totalFilas(db, 'eventos_app');
    const lectura = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal2'),
      'select count(*)::int as n from public.eventos_app',
    );
    expect(lectura).toEqual({ ok: true, filas: [{ n: total }] });
    const funciones = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal2'),
      'select public.soy_administrador() as soy, public.es_administrador() as es',
    );
    expect(funciones).toEqual({ ok: true, filas: [{ soy: true, es: true }] });
  });

  it('solo con correo (aal1) no ve ninguna fila y es_administrador es false, aunque soy_administrador sea true', async () => {
    const lectura = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal1'),
      'select count(*)::int as n from public.eventos_app',
    );
    expect(lectura).toEqual({ ok: true, filas: [{ n: 0 }] });
    const funciones = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal1'),
      'select public.soy_administrador() as soy, public.es_administrador() as es',
    );
    expect(funciones).toEqual({ ok: true, filas: [{ soy: true, es: false }] });
  });

  it('sin la nota aal en el token tampoco es administradora con segundo factor', async () => {
    const lectura = await comoRol(
      db,
      'authenticated',
      { sub: ADMINISTRADORA, role: 'authenticated' },
      'select count(*)::int as n from public.eventos_app',
    );
    expect(lectura).toEqual({ ok: true, filas: [{ n: 0 }] });
  });

  it('otra persona con segundo factor sigue sin ver nada', async () => {
    const lectura = await comoRol(
      db,
      'authenticated',
      sesionDe(PERSONA_CUALQUIERA, 'aal2'),
      'select count(*)::int as n from public.eventos_app',
    );
    expect(lectura).toEqual({ ok: true, filas: [{ n: 0 }] });
  });

  it('la administradora lee la lista de administradores solo con segundo factor', async () => {
    const con = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal2'),
      'select count(*)::int as n from public.administradores',
    );
    expect(con).toEqual({ ok: true, filas: [{ n: 1 }] });
    const sin = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal1'),
      'select count(*)::int as n from public.administradores',
    );
    expect(sin).toEqual({ ok: true, filas: [{ n: 0 }] });
  });

  it('quitar a la administradora de la lista le quita el acceso al momento', async () => {
    await db.exec(`delete from public.administradores where usuario_id = '${ADMINISTRADORA}'`);
    const lectura = await comoRol(
      db,
      'authenticated',
      sesionDe(ADMINISTRADORA, 'aal2'),
      'select count(*)::int as n from public.eventos_app',
    );
    expect(lectura).toEqual({ ok: true, filas: [{ n: 0 }] });
  });
});

describe('registrar_evento_app: entrada', () => {
  it('devuelve boolean (la función eventos necesita distinguir el rechazo)', async () => {
    const resultado = await db.query<{ tipo: string; args: string }>(
      `select pg_get_function_result(p.oid) as tipo, pg_get_function_identity_arguments(p.oid) as args
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'registrar_evento_app'`,
    );
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0]?.tipo).toBe('boolean');
    expect(resultado.rows[0]?.args).toMatch(/^p_tipo text, p_dispositivo uuid, p_valor text/);
  });

  it('anon puede ejecutarla y cada tipo válido se guarda con su valor', async () => {
    for (const evento of EVENTOS_APP) {
      const disp = nuevoDispositivo();
      const valor = valorDePrueba(evento.valor);
      expect(await registrar(disp, evento.tipo, valor), evento.tipo).toBe(true);
      const fila = await db.query<{ tipo: string; valor: string | null }>(
        'select tipo, valor from public.eventos_app where dispositivo = $1',
        [disp],
      );
      expect(fila.rows, evento.tipo).toEqual([{ tipo: evento.tipo, valor }]);
    }
  });

  it('acepta cada valor de cada lista en el evento que la usa', async () => {
    for (const evento of EVENTOS_APP) {
      if (evento.valor === null) continue;
      for (const valor of VALORES[evento.valor]) {
        expect(
          await registrar(nuevoDispositivo(), evento.tipo, valor),
          `${evento.tipo}:${valor}`,
        ).toBe(true);
      }
    }
  });

  it('authenticated también puede ejecutarla', async () => {
    const disp = nuevoDispositivo();
    const resultado = await comoRol(
      db,
      'authenticated',
      sesionDe(PERSONA_CUALQUIERA, 'aal1'),
      'select public.registrar_evento_app($1, $2, $3) as guardado',
      ['portada_vista', disp, null],
    );
    expect(resultado).toEqual({ ok: true, filas: [{ guardado: true }] });
  });

  it.each([
    ['un tipo que no está en la lista', 'nombre_del_usuario', null, /tipo-de-evento-no-valido/],
    ['un tipo con otra capitalización', 'PORTADA_VISTA', null, /tipo-de-evento-no-valido/],
    ['un tipo vacío', '', null, /tipo-de-evento-no-valido/],
    ['un tipo nulo', null, null, /tipo-de-evento-no-valido/],
    ['un valor en un evento que no lo lleva', 'portada_vista', 'monthly', /evento-sin-valor/],
    ['un plan en la compra, que no lleva valor', 'compra_clic', 'monthly', /evento-sin-valor/],
    ['un plan anual en la compra', 'compra_clic', 'annual', /evento-sin-valor/],
    ['un valor cualquiera en la compra', 'compra_clic', 'gratis', /evento-sin-valor/],
    ['un evento con valor sin valor', 'onboarding_paso', null, /falta-el-valor/],
    [
      'un valor fuera de la lista del paso',
      'onboarding_paso',
      'gratis',
      /valor-de-evento-no-valido/,
    ],
    ['un valor de otra lista', 'onboarding_paso', 'respiracion', /valor-de-evento-no-valido/],
    [
      'un paso del inicio que no existe',
      'onboarding_paso',
      'respiracion',
      /valor-de-evento-no-valido/,
    ],
    ['un juego que no existe', 'juego_terminado', 'mi-nombre-es-ana', /valor-de-evento-no-valido/],
    ['texto libre como valor', 'sesion_abandonada', 'Me llamo Ana', /valor-de-evento-no-valido/],
  ])('rechaza %s', async (_nombre, tipo, valor, mensaje) => {
    const disp = nuevoDispositivo();
    await expect(registrar(disp, tipo as string, valor)).rejects.toThrow(mensaje);
    expect(await eventosDe(disp)).toBe(0);
    // Una entrada no válida no cuenta para el límite.
    expect(await contadoresDe(disp)).toBe(0);
  });

  it('rechaza un identificador que no es un UUID o que es nulo', async () => {
    const noUuid = await comoRol(
      db,
      'anon',
      {},
      'select public.registrar_evento_app($1, $2, $3) as guardado',
      ['portada_vista', 'nino-nombre', null],
    );
    expect(noUuid.ok).toBe(false);
    expect(noUuid.ok ? '' : noUuid.error).toMatch(/uuid/i);
    const nulo = await comoRol(
      db,
      'anon',
      {},
      'select public.registrar_evento_app($1, $2, $3) as guardado',
      ['portada_vista', null, null],
    );
    expect(nulo.ok).toBe(false);
    expect(nulo.ok ? '' : nulo.error).toMatch(/dispositivo-no-valido/);
  });

  it('el valor por defecto de p_valor es nulo', async () => {
    const resultado = await comoRol(
      db,
      'anon',
      {},
      'select public.registrar_evento_app($1, $2) as guardado',
      ['portada_vista', nuevoDispositivo()],
    );
    expect(resultado).toEqual({ ok: true, filas: [{ guardado: true }] });
  });
});

describe('registrar_evento_app: límites', () => {
  it('hasta 30 eventos del mismo dispositivo en el minuto se guardan', async () => {
    const disp = nuevoDispositivo();
    const resultados: boolean[] = [];
    for (let i = 0; i < 30; i++) resultados.push(await registrar(disp, 'portada_vista'));
    // Aunque cruce un minuto, cada tramo tiene como mucho 30: todas se guardan.
    expect(resultados.every((guardado) => guardado)).toBe(true);
    expect(await eventosDe(disp)).toBe(30);
  });

  it('el evento número 31 del dispositivo devuelve false y no se guarda', async () => {
    const disp = nuevoDispositivo();
    await fijarContador(`dispositivo:${disp}`, 30);
    expect(await registrar(disp, 'portada_vista')).toBe(false);
    expect(await eventosDe(disp)).toBe(0);
  });

  it('el rechazo no lanza ni deshace el contador: el intento queda contado', async () => {
    const disp = nuevoDispositivo();
    await fijarContador(`dispositivo:${disp}`, 30);
    expect(await registrar(disp, 'portada_vista')).toBe(false);
    const contador = await db.query<{ usos: number }>(
      "select usos from public.limite_eventos_app where clave = $1 and minuto = date_trunc('minute', now())",
      [`dispositivo:${disp}`],
    );
    expect(contador.rows[0]?.usos).toBe(31);
  });

  it('otro dispositivo sigue pudiendo registrar mientras el primero está limitado', async () => {
    const limitado = nuevoDispositivo();
    await fijarContador(`dispositivo:${limitado}`, 30);
    expect(await registrar(limitado, 'portada_vista')).toBe(false);
    const otro = nuevoDispositivo();
    expect(await registrar(otro, 'portada_vista')).toBe(true);
    expect(await eventosDe(otro)).toBe(1);
  });

  it('con el total del minuto en 600, el siguiente se rechaza aunque el dispositivo esté por debajo del suyo', async () => {
    const disp = nuevoDispositivo();
    await fijarContador('total', 600);
    expect(await registrar(disp, 'portada_vista')).toBe(false);
    expect(await eventosDe(disp)).toBe(0);
    // Con el total justo por debajo, el último cabe.
    await fijarContador('total', 599);
    expect(await registrar(disp, 'portada_vista')).toBe(true);
    expect(await eventosDe(disp)).toBe(1);
    await db.query("delete from public.limite_eventos_app where clave = 'total'");
  });

  it('limpieza: los contadores de más de una hora se borran al llamar a la función', async () => {
    await db.query(
      "insert into public.limite_eventos_app (clave, minuto, usos) values ('dispositivo:antiguo', now() - interval '2 hours', 5)",
    );
    await registrar(nuevoDispositivo(), 'portada_vista');
    const viejos = await db.query<{ n: number }>(
      "select count(*)::int as n from public.limite_eventos_app where minuto < now() - interval '1 hour'",
    );
    expect(viejos.rows[0]?.n).toBe(0);
  });

  it('los valores de la base son 30 por dispositivo y 600 en total', () => {
    const sql = leerMigracion('20261024100001_limite_eventos.sql');
    expect(
      [...sql.matchAll(/v_usos > (\d+)/g)].map((coincidencia) => Number(coincidencia[1])),
    ).toEqual([30, 600]);
  });
});
