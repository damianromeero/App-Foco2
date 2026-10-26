// Barrido de secretos y datos personales de lo que se publica. Lo usan dos sitios con las mismas reglas:
//  - el gate de publicación (npm run verificar, scripts/verificar-publicacion.mjs): cada hallazgo es un error real;
//  - este comando (npm run barrido): sale con código 1 si hay cualquier hallazgo.
// Revisa los archivos rastreados por git y no ignorados (incluye lo nuevo sin confirmar). Lo que ignora git
// (.env.local, node_modules, dist) no se revisa. Nunca imprime el valor encontrado: solo el archivo, la línea y la regla.
//
// Reglas (los códigos son los del gate):
//   E4. Nombres de secretos de servidor en src/ (HOTMART_HOTTOK, STRIPE_SECRET_KEY, RESEND_API_KEY).
//   E5. La clave de servicio de Supabase en cualquier archivo que no sea de supabase/functions/.
//   E8. Claves con forma real (Stripe, GitHub, AWS, clave privada, JWT) y archivos .env versionados con valores
//       (solo se publica .env.example).
//   E9. Datos personales: correos fuera de dominios de ejemplo, IBAN, NIF/NIE y teléfonos.
// Excepción única: en la línea contactoEmail de src/config/plantilla.ts, donde la persona pone su correo de contacto,
// no se revisa el correo. Ninguna otra línea de ningún archivo queda exenta.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Nombre de la clave de servicio de Supabase, armado por partes: este archivo no puede contenerla literal,
 * porque la regla E5 la marcaría a él también.
 */
export const CLAVE_SERVICIO = ['SUPABASE', 'SERVICE', 'ROLE'].join('_');
const CLAVE_DE_SERVICIO = new RegExp(CLAVE_SERVICIO);
/** Otros secretos de servidor que el código de la app (src/) no debe nombrar (E4). */
const OTROS_SECRETOS_DE_SERVIDOR = /\b(?:HOTMART_HOTTOK|STRIPE_SECRET_KEY|RESEND_API_KEY)\b/;

/** Claves con forma real (E8). Los placeholders de la documentación («sk_test_...») no coinciden. */
const CLAVES = [
  [
    'clave de Stripe',
    /\bsk_(?:live|test)_[A-Za-z0-9]{16,}|\bpk_live_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{16,}/,
  ],
  ['token de GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['clave de acceso de AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['clave privada', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  [
    'token JWT (clave de Supabase u otro token)',
    /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,
  ],
];

/** Dominios de ejemplo: los únicos que pueden aparecer en un correo publicado (E9 y P4 del gate). */
export const DOMINIO_DE_EJEMPLO =
  /(^|\.)(correo\.com|ejemplo\.com|tu-dominio\.[a-z]+|example\.[a-z]+|test)$/;
const CORREO = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;
/** Otros datos personales: cuentas bancarias, identificadores fiscales y teléfonos (E9). */
const OTROS_DATOS = [
  ['número de cuenta IBAN', /\bES\d{2}(?: ?\d{4}){5}\b/],
  ['NIF o NIE', /(?<![0-9A-Za-z])(?:\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-Z])(?![0-9A-Za-z])/],
  ['teléfono con prefijo', /(?:\+34|\+52)[ .-]?\d{3}[ .-]?\d{3}[ .-]?\d{2,4}\b/],
  ['teléfono móvil', /(?<!\d)[67]\d{2}[ .-]\d{3}[ .-]\d{3}(?!\d)/],
];

/**
 * Excepción única y exacta (E9), decidida por el lead: el aviso de deprecación de glob@11.1.0 en package-lock.json lleva el
 * correo público de su mantenedor (registro de npm). No es dato de ninguna persona y no se puede quitar sin cambiar una
 * dependencia de compilación (vite-plugin-pwa → workbox-build exige glob ^11). Solo ese correo, solo en esa línea de
 * package-lock.json. Cualquier otro correo del lockfile, o ese mismo correo en otra línea, sigue siendo un hallazgo.
 */
const EXENCION_DE_LOCKFILE = {
  ruta: 'package-lock.json',
  // Partido para que el barrido no se marque a sí mismo: la comparación es exacta y solo vale en package-lock.json.
  correo: ['i', 'izs.me'].join('@'),
  contiene: '"deprecated"',
};

/** ¿Este correo es la excepción exacta del lockfile? */
export function esExencionDeLockfile(ruta, linea, correo) {
  return (
    ruta === EXENCION_DE_LOCKFILE.ruta &&
    correo === EXENCION_DE_LOCKFILE.correo &&
    linea.includes(EXENCION_DE_LOCKFILE.contiene)
  );
}

const IGNORADOS_SIN_GIT = new Set([
  'node_modules',
  'dist',
  'dist-ssr',
  'coverage',
  '.git',
  'test-results',
  'playwright-report',
]);

/** Archivos que se publican: rastreados o nuevos y no ignorados por git. Sin git, recorre la carpeta sin lo ignorado típico. */
export function archivosPublicables(raiz) {
  try {
    const salida = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    return [...new Set(salida.split('\0'))].filter(
      (ruta) => ruta !== '' && existsSync(join(raiz, ruta)),
    );
  } catch {
    const recorrer = (dir) =>
      readdirSync(dir).flatMap((nombre) => {
        if (IGNORADOS_SIN_GIT.has(nombre) || nombre === '.env.local') return [];
        const ruta = join(dir, nombre);
        return statSync(ruta).isDirectory()
          ? recorrer(ruta)
          : [relative(raiz, ruta).split(sep).join('/')];
      });
    return recorrer(raiz);
  }
}

/** Texto del archivo, o null si es binario (tiene bytes nulos al principio). */
export function textoDe(raiz, ruta) {
  const bytes = readFileSync(join(raiz, ruta));
  if (bytes.subarray(0, 8000).includes(0)) return null;
  return bytes.toString('utf8');
}

/** Hallazgos de un texto: archivo, línea, código de la regla. Nunca el valor encontrado. */
export function hallazgos(ruta, texto) {
  const enFunciones = ruta.startsWith('supabase/functions/');
  const enSrc = ruta.startsWith('src/');
  const encontrados = [];
  texto.split(/\r?\n/).forEach((linea, indice) => {
    const donde = `${ruta}:${indice + 1}`;
    for (const [nombre, patron] of CLAVES) {
      if (patron.test(linea)) encontrados.push(`${donde} [E8] ${nombre}`);
    }
    if (enSrc && OTROS_SECRETOS_DE_SERVIDOR.test(linea)) {
      encontrados.push(`${donde} [E4] nombre de un secreto de servidor en el código de la app`);
    }
    if (!enFunciones && CLAVE_DE_SERVICIO.test(linea)) {
      encontrados.push(`${donde} [E5] la clave de servicio fuera de supabase/functions/`);
    }
    const esLineaDeContacto =
      ruta === 'src/config/plantilla.ts' && /^\s*contactoEmail\s*:/.test(linea);
    if (!esLineaDeContacto) {
      for (const [correo, dominio] of linea.matchAll(CORREO)) {
        if (esExencionDeLockfile(ruta, linea, correo)) continue;
        if (!DOMINIO_DE_EJEMPLO.test(dominio.toLowerCase())) {
          encontrados.push(`${donde} [E9] correo con un dominio que no es de ejemplo`);
        }
      }
    }
    for (const [nombre, patron] of OTROS_DATOS) {
      if (patron.test(linea)) encontrados.push(`${donde} [E9] ${nombre}`);
    }
  });
  return encontrados;
}

/** Revisa todo lo que se publica. Devuelve cuántos archivos de texto se leyeron y la lista de hallazgos. */
export function revisarPublicacion(raiz) {
  const encontrados = [];
  let revisados = 0;
  for (const ruta of archivosPublicables(raiz)) {
    const nombre = ruta.split('/').pop();
    if (/^\.env(\..+)?$/.test(nombre) && nombre !== '.env.example') {
      encontrados.push(`${ruta} [E8] archivo .env versionado (solo se publica .env.example)`);
      continue;
    }
    const texto = textoDe(raiz, ruta);
    if (texto === null) continue;
    revisados += 1;
    encontrados.push(...hallazgos(ruta, texto));
  }
  return { revisados, encontrados };
}

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

function main() {
  const { revisados, encontrados } = revisarPublicacion(RAIZ);
  if (encontrados.length > 0) {
    console.error(
      `Barrido de secretos y datos personales: ${encontrados.length} hallazgos en ${revisados} archivos de texto.`,
    );
    for (const hallazgo of encontrados) console.error(`  - ${hallazgo}`);
    process.exit(1);
  }
  console.log(
    `Barrido de secretos y datos personales: sin hallazgos en ${revisados} archivos de texto.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
