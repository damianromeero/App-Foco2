// Gate de publicación (npm run verificar). Sale con código 1 solo si hay ERRORES REALES de la plantilla.
// Los PENDIENTES DEL ALUMNO se listan y NO bloquean: son lo que aún tiene que conectar o sustituir.
//
// ERRORES REALES (bloquean):
//   E1. Faltan archivos que la plantilla necesita (guía, funciones, migraciones, configuración).
//   E2. Falta el bloque `conexiones: { supabase, pagos, correo, ia }` o no tiene la forma esperada.
//   E3. AGENTS.md y CLAUDE.md no son idénticos.
//   E4. El código de la app (src/) importa supabase/functions o supabase/migrations, o nombra un secreto de servidor.
//   E5. La clave de servicio de Supabase aparece en un archivo que no es una función de supabase/functions/.
//   E6. Migraciones: cada tabla con RLS activo en su mismo archivo; ningún permiso ni política para anon o public;
//       ningún drop table.
//   E7. medicionAnonima no coincide entre src/config/plantilla.ts y supabase/functions/_shared/eventos.ts.
//   E8. Claves con forma real en archivos versionados, o un .env con valores versionado.
//   E9. Datos personales reales en archivos versionados: correos de dominios que no son de ejemplo, IBAN, NIF/NIE, teléfonos.
//   E-entorno. Con conexiones.supabase en true, faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY.
//
// PENDIENTES DEL ALUMNO (no bloquean):
//   P1. Marcadores [COMPLETAR: …] y [VERIFICAR: …] en src/, supabase/functions/, docs/, README.md y LICENSE.
//   P2. Interruptores de conexión en false (supabase, pagos, correo, ia), cada uno con su paso de la guía.
//   P3. Variables de entorno sin definir, y la comprobación manual de las del servidor.
//   P4. Correo de contacto de ejemplo (contactoEmail en src/config/plantilla.ts).
//   P5. Medición anónima apagada (informativo).
//
// E5, E8 y E9 se comprueban en scripts/barrido-secretos.mjs, con las mismas reglas que `npm run barrido`.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  archivosPublicables,
  CLAVE_SERVICIO,
  DOMINIO_DE_EJEMPLO,
  revisarPublicacion,
  textoDe,
} from './barrido-secretos.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLANTILLA = 'src/config/plantilla.ts';
const EVENTOS_SERVIDOR = 'supabase/functions/_shared/eventos.ts';
const MIGRACIONES = 'supabase/migrations';

const existe = (rel) => existsSync(join(RAIZ, rel));
const leer = (rel) => (existe(rel) ? readFileSync(join(RAIZ, rel), 'utf8') : '');
const errores = [];
const pendientes = [];

// E1. Archivos que la plantilla necesita.
const REQUERIDOS = [
  'src/config/plantilla.ts',
  'src/config/medicion.ts',
  'src/services/acceso.ts',
  'supabase/functions/hotmart-aviso/index.ts',
  'supabase/functions/eventos/index.ts',
  'supabase/functions/_shared/eventos.ts',
  'supabase/functions/_shared/hotmart.ts',
  'supabase/migrations/20261024100000_panel_admin.sql',
  'supabase/migrations/20261024100001_limite_eventos.sql',
  'supabase/migrations/20261024110000_compras_hotmart.sql',
  'supabase/migrations/20261024120000_accesos.sql',
  'docs/INFRAESTRUCTURA.md',
  'docs/GUIA-ALUMNO.md',
  'AGENTS.md',
  'CLAUDE.md',
];
for (const rel of REQUERIDOS) {
  if (!existe(rel)) errores.push(`E1 falta ${rel}, que la plantilla necesita.`);
}

// E2 y P2. Bloque conexiones: supabase, pagos (cobros con Hotmart), correo y ia.
const BLOQUE =
  /conexiones:\s*\{\s*supabase:\s*(true|false),\s*pagos:\s*(true|false),\s*correo:\s*(true|false),\s*ia:\s*(true|false)\s*\}/;
const bloque = leer(PLANTILLA).match(BLOQUE);
const conexiones = bloque && {
  supabase: bloque[1] === 'true',
  pagos: bloque[2] === 'true',
  correo: bloque[3] === 'true',
  ia: bloque[4] === 'true',
};
/** Pasos de docs/INFRAESTRUCTURA.md que cierra cada conexión. Ninguna se pone en true antes de su prueba. */
const PASO_DE = {
  supabase: 'pasos 3, 4 y 6 (proyecto, acceso y migraciones)',
  pagos: 'pasos 7 a 13 (Hotmart, funciones, aviso y prueba de compra)',
  correo: 'paso 5 (correo de entrada propio, SMTP)',
  ia: null,
};
if (!conexiones) {
  errores.push(
    'E2 falta el bloque `conexiones: { supabase, pagos, correo, ia }` con true o false en src/config/plantilla.ts.',
  );
} else {
  for (const [servicio, paso] of Object.entries(PASO_DE)) {
    if (conexiones[servicio]) continue;
    pendientes.push(
      paso
        ? `conexiones.${servicio} está en false: docs/INFRAESTRUCTURA.md, ${paso}. Cámbialo a true en src/config/plantilla.ts solo cuando su prueba salga bien.`
        : `conexiones.${servicio} está en false: la guía no tiene paso de IA y la plantilla no llama a ninguna IA. Déjalo en false salvo que añadas una función de IA.`,
    );
  }
}

// E3. AGENTS.md y CLAUDE.md son la misma guía para dos herramientas.
if (existe('AGENTS.md') && existe('CLAUDE.md')) {
  const agentes = readFileSync(join(RAIZ, 'AGENTS.md'));
  const claude = readFileSync(join(RAIZ, 'CLAUDE.md'));
  if (!agentes.equals(claude)) errores.push('E3 AGENTS.md y CLAUDE.md no son idénticos.');
}

const publicables = archivosPublicables(RAIZ);

// E4. El código de la app no importa funciones ni migraciones. Los nombres de secretos los revisa el barrido.
const IMPORTA_SERVIDOR = /\b(?:from|import)\s*\(?\s*["'][^"']*supabase\/(?:functions|migrations)/;
for (const rel of publicables) {
  if (!rel.startsWith('src/') || !/\.(tsx?|jsx?|mjs|cjs)$/.test(rel)) continue;
  const texto = textoDe(RAIZ, rel);
  if (texto !== null && IMPORTA_SERVIDOR.test(texto)) {
    errores.push(
      `E4 ${rel} importa código de supabase/functions o supabase/migrations: el navegador nunca debe importarlo.`,
    );
  }
}

// E5, E8 y E9. Mismas reglas que `npm run barrido`.
for (const hallazgo of revisarPublicacion(RAIZ).encontrados) errores.push(hallazgo);

// E6. Migraciones: RLS en cada tabla de su mismo archivo, ningún permiso ni política para anon o public, ningún drop table.
const roles = (sentencia) => {
  const coincide = sentencia.match(/\bto\s+([a-z_,\s]+?)(?:\s+(?:using|with check|for|on)\b|$)/);
  return coincide ? coincide[1].split(',').map((rol) => rol.trim()) : [];
};
/**
 * Única concesión a anon que admite el gate: la puerta anónima de la medición de la app (eventos de visitantes sin
 * sesión). Es la sentencia exacta de su migración. La función registrar_evento_app valida y limita dentro de la base, y
 * es la única puerta anónima por diseño. Aprobada por el lead del proyecto. Cualquier otro permiso o política para anon
 * sigue siendo un error real.
 */
const CONCESION_ANON_PERMITIDA = {
  archivo: '20261024100001_limite_eventos.sql',
  sentencia: 'grant execute on function public.registrar_evento_app(text, uuid, text) to anon',
};
if (existe(MIGRACIONES)) {
  for (const nombre of readdirSync(join(RAIZ, MIGRACIONES))
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort()) {
    const sql = leer(`${MIGRACIONES}/${nombre}`)
      .replace(/--[^\n]*/g, '')
      .toLowerCase();
    for (const [, tabla] of sql.matchAll(
      /create table (?:if not exists )?(?:public\.)?([a-z0-9_]+)/g,
    )) {
      const rls = new RegExp(
        `alter table (?:only )?(?:public\\.)?${tabla} enable row level security`,
      );
      if (!rls.test(sql)) {
        errores.push(`E6 ${nombre}: la tabla ${tabla} no tiene RLS activo en este mismo archivo.`);
      }
    }
    for (const sentencia of sql.split(';').map((s) => s.replace(/\s+/g, ' ').trim())) {
      if (/\bdrop table\b/.test(sentencia)) errores.push(`E6 ${nombre}: contiene drop table.`);
      if (/\b(?:grant|create policy)\b/.test(sentencia)) {
        const quien = roles(sentencia);
        const permitida =
          nombre === CONCESION_ANON_PERMITIDA.archivo &&
          sentencia === CONCESION_ANON_PERMITIDA.sentencia;
        if ((quien.includes('anon') || quien.includes('public')) && !permitida) {
          errores.push(
            `E6 ${nombre}: concede acceso al rol anon (permiso o política para visitantes sin sesión).`,
          );
        }
      }
    }
  }
}

// E7. La medición anónima tiene un interruptor en la app y otro en el servidor: deben valer lo mismo.
const medicionServidor = leer(EVENTOS_SERVIDOR).match(
  /export const medicionAnonima\s*=\s*(true|false)\b/,
);
const medicionApp = leer(PLANTILLA).match(/^\s*medicionAnonima:\s*(true|false)\b/m);
if (!medicionServidor || !medicionApp) {
  errores.push(`E7 no se puede leer medicionAnonima en ${PLANTILLA} o en ${EVENTOS_SERVIDOR}.`);
} else if (medicionServidor[1] !== medicionApp[1]) {
  errores.push(
    `E7 medicionAnonima no coincide: ${PLANTILLA} tiene ${medicionApp[1]} y ${EVENTOS_SERVIDOR} tiene ${medicionServidor[1]}.`,
  );
}

// E-entorno y P3. Variables de la app, en .env.local o en el panel del hosting. Nunca se muestran sus valores.
const envLocal = leer('.env.local');
const definida = (nombre) =>
  Boolean(process.env[nombre]) || new RegExp(`^\\s*${nombre}\\s*=\\s*\\S`, 'm').test(envLocal);
const VARIABLES = [
  {
    nombre: 'VITE_SUPABASE_URL',
    servicio: 'supabase',
    paso: 'paso 11',
    efecto: 'Sin ella, /entrar lleva directo a la app gratuita, sin pedir correo',
  },
  { nombre: 'VITE_SUPABASE_ANON_KEY', servicio: 'supabase', paso: 'paso 11' },
  {
    nombre: 'VITE_ENLACE_COMPRA',
    paso: 'paso 11',
    efecto:
      'Sin ella, el botón de compra de /paywall y /precios lleva a la app sin cobrar y no aparece «Comprar» en /entrar ni en /sin-compra',
  },
  { nombre: 'VITE_APP_URL', paso: 'paso 11' },
  { nombre: 'VITE_SUPPORT_EMAIL', paso: 'pasos 2 y 11' },
];
for (const { nombre, servicio, paso, efecto } of VARIABLES) {
  if (definida(nombre)) continue;
  if (servicio && conexiones?.[servicio]) {
    errores.push(`E-entorno falta ${nombre}: con conexiones.${servicio} en true es obligatoria.`);
  } else {
    pendientes.push(
      `la variable ${nombre} aún no está definida (en .env.local o en el panel de tu hosting, docs/INFRAESTRUCTURA.md, ${paso}).${efecto ? ` ${efecto}: la pantalla no avisa a tus clientes.` : ''}`,
    );
  }
}
pendientes.push(
  `HOTMART_HOTTOK (paso 9) y la clave de servicio ${CLAVE_SERVICIO}_KEY, que inyecta Supabase en las funciones (paso 8): este comando no los comprueba, revísalos a mano (docs/INFRAESTRUCTURA.md).`,
);

// P1. Marcadores pendientes, agrupados por archivo. Un «…» solo (ejemplo de la guía) no cuenta. Se busca en el texto
// entero, porque un marcador puede ocupar varias líneas (p. ej. supabase/functions/_shared/rest.ts).
const MARCADOR = /\[(COMPLETAR|VERIFICAR):(?!\s*…\s*\])[^\]]{0,400}\]/g;
/** Pasos de docs/INFRAESTRUCTURA.md que cierran los marcadores de cada archivo. */
const PASO_DEL_MARCADOR = {
  'src/content/legal.ts': 'paso 2 (y paso 15 para los VERIFICAR del abogado)',
  'src/pages/admin/Seguridad.tsx': 'paso 12 (segundo factor)',
  'supabase/functions/_shared/hotmart.ts':
    'paso 7 (códigos de oferta) y paso 10 (nombres de campo)',
  'supabase/functions/_shared/rest.ts': 'paso 8 (funciones de Supabase)',
  LICENSE: 'paso 2 (ley aplicable)',
};
const seguimiento = (rel) =>
  rel.startsWith('src/') ||
  rel.startsWith('supabase/functions/') ||
  rel.startsWith('docs/') ||
  rel === 'README.md' ||
  rel === 'LICENSE';
for (const rel of publicables.filter(seguimiento)) {
  const texto = textoDe(RAIZ, rel);
  if (texto === null) continue;
  const marcas = [...texto.matchAll(MARCADOR)].map(
    (marca) => texto.slice(0, marca.index).split('\n').length,
  );
  if (marcas.length > 0) {
    const lineas = [...new Set(marcas)];
    const cierran = PASO_DEL_MARCADOR[rel] ?? 'los de docs/INFRAESTRUCTURA.md que los mencionen';
    pendientes.push(
      `marcadores sin completar en ${rel} (${marcas.length}, líneas ${lineas.slice(0, 8).join(', ')}${lineas.length > 8 ? '…' : ''}). Los cierran: ${cierran}.`,
    );
  }
}

// P4. Correo de contacto. Si es de un dominio de ejemplo, queda pendiente: nunca es un error.
const contacto = leer(PLANTILLA).match(/contactoEmail:\s*['"]([^'"]*)['"]/);
if (!contacto) {
  errores.push('E2 falta contactoEmail en src/config/plantilla.ts.');
} else {
  const dominio = contacto[1].split('@')[1] ?? '';
  if (!dominio || DOMINIO_DE_EJEMPLO.test(dominio.toLowerCase())) {
    pendientes.push(
      'el correo de contacto (contactoEmail en src/config/plantilla.ts) es de ejemplo: cámbialo por tu correo de contacto (docs/INFRAESTRUCTURA.md, pasos 1 y 2).',
    );
  }
}

// P5. Medición anónima apagada: informativo.
const medicion = leer(PLANTILLA).match(/^\s*medicionAnonima:\s*(true|false)\b/m);
if (medicion?.[1] === 'false') {
  pendientes.push(
    'la medición anónima está apagada (medicionAnonima en false): es opcional e informativo. Enciéndela solo tras el paso 14 de docs/INFRAESTRUCTURA.md.',
  );
}

// Informe.
console.log('Gate de publicación (npm run verificar)');
console.log(
  `Conexiones en ${PLANTILLA}: ${
    conexiones
      ? `supabase=${conexiones.supabase}, pagos=${conexiones.pagos}, correo=${conexiones.correo}, ia=${conexiones.ia}`
      : 'no leídas'
  }`,
);
console.log(`\nPendientes del alumno (${pendientes.length}), no bloquean:`);
if (pendientes.length === 0) console.log('  ninguno');
for (const pendiente of pendientes) console.log(`  - ${pendiente}`);
console.log(`\nErrores reales (${errores.length}), sí bloquean:`);
if (errores.length === 0) console.log('  ninguno');
for (const error of errores) console.log(`  - ${error}`);

if (errores.length > 0) {
  console.error('\nResultado: hay errores reales de la plantilla. Corrígelos antes de seguir.');
  process.exit(1);
}
console.log(
  pendientes.length === 0
    ? '\nResultado: sin errores ni pendientes. Lista para publicar.'
    : `\nResultado: sin errores reales. Quedan ${pendientes.length} pendientes del alumno (docs/INFRAESTRUCTURA.md, paso 16).`,
);
