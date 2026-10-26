/**
 * Sesión de la persona compradora en una cookie httpOnly. PURO.
 *
 * Decisión: los tokens de Supabase (acceso y renovación) NO viajan al navegador. El servidor los guarda en la cookie
 * `foco_sesion` y los lee en cada petición de /api. Así el código de la app (que es público) no puede leerlos, ni un
 * script inyectado en la página. Atributos:
 *  - HttpOnly: JavaScript del navegador no la lee.
 *  - SameSite=Lax: no viaja en peticiones iniciadas desde otros sitios (salvo navegaciones de primer nivel).
 *  - Path=/ y Max-Age=2592000 (30 días).
 *  - Secure solo cuando la petición llega por https (producción). En localhost por http no, para las pruebas locales.
 *
 * El valor es JSON con accessToken y refreshToken en base64url. No lleva nada más: ni correo ni identificador de usuario.
 */

export const NOMBRE_COOKIE = 'foco_sesion';
/** Cookie de la sesión del panel de administración. Es distinta de la del comprador: no comparten tokens ni ruta. */
export const NOMBRE_COOKIE_ADMIN = 'foco_admin';
export const DURACION_COOKIE_S = 2_592_000;

const LIMITE_TOKEN = 4096;

export interface TokensSesion {
  accessToken: string;
  refreshToken: string;
}

/** Valida la forma de los tokens: dos cadenas no vacías y de tamaño razonable. */
export function tokensValidos(valor: unknown): TokensSesion | null {
  if (typeof valor !== 'object' || valor === null) return null;
  const { accessToken, refreshToken } = valor as Record<string, unknown>;
  if (!esTokenValido(accessToken) || !esTokenValido(refreshToken)) return null;
  return { accessToken, refreshToken };
}

function esTokenValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= LIMITE_TOKEN;
}

/** Codifica los tokens en base64url (sin relleno), apta para un valor de cookie. */
export function codificarTokens(tokens: TokensSesion): string {
  const json = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });
  const bytes = new TextEncoder().encode(json);
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decodifica el valor de la cookie. Null si no es base64url válido o no tiene la forma de los tokens. */
export function decodificarTokens(valor: string): TokensSesion | null {
  if (!/^[A-Za-z0-9_-]+$/.test(valor)) return null;
  try {
    const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
    const relleno = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binario = atob(relleno);
    const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
    const dato = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return tokensValidos(dato);
  } catch {
    return null;
  }
}

/** Tokens de la cookie `nombre` (por defecto `foco_sesion`) de la petición, o null si no hay cookie o no es válida. */
export function tokensDeLaPeticion(
  request: Request,
  nombre: string = NOMBRE_COOKIE,
): TokensSesion | null {
  const cabecera = request.headers.get('cookie');
  if (!cabecera) return null;
  for (const parte of cabecera.split(';')) {
    const igual = parte.indexOf('=');
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() !== nombre) continue;
    return decodificarTokens(parte.slice(igual + 1).trim());
  }
  return null;
}

/** Atributos comunes. `Secure` solo si la petición llegó por https. */
function atributos(request: Request, caducar: boolean): string {
  const partes = [
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    caducar ? 'Max-Age=0' : `Max-Age=${DURACION_COOKIE_S}`,
  ];
  if (new URL(request.url).protocol === 'https:') partes.push('Secure');
  return partes.join('; ');
}

/** Cabecera Set-Cookie que fija la sesión en la cookie `nombre` (por defecto `foco_sesion`). */
export function cookieDeSesion(
  tokens: TokensSesion,
  request: Request,
  nombre: string = NOMBRE_COOKIE,
): string {
  return `${nombre}=${codificarTokens(tokens)}; ${atributos(request, false)}`;
}

/** Cabecera Set-Cookie que borra la cookie `nombre` (Max-Age=0). */
export function cookieBorrada(request: Request, nombre: string = NOMBRE_COOKIE): string {
  return `${nombre}=; ${atributos(request, true)}`;
}
