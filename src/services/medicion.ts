import { env } from '../config/env';
import { EVENTOS_APP, VALORES, type TipoEvento } from '../config/medicion';
import { plantilla } from '../config/plantilla';
import { isCloudEnabled } from './supabase';

/**
 * Medición anónima de uso (navegador). Ver `plantilla.medicionAnonima` en src/config/plantilla.ts.
 *
 * Está APAGADA mientras `plantilla.medicionAnonima` sea false o no haya Supabase configurado: entonces no sale ninguna
 * petición y no se guarda nada en el navegador. Encendida, cada evento lleva solo su tipo (lista cerrada de
 * `src/config/medicion.ts`), un identificador aleatorio de dispositivo y, si el evento lo pide, un valor de la lista
 * permitida. Nunca lleva nombres, correos, textos ni datos de lo que la persona hace dentro de un juego.
 * La función `eventos` del servidor tiene su propio interruptor: este archivo no lo decide.
 *
 * No hay reintentos ni cola: si algo falla, el evento se pierde. Y la medición nunca interrumpe una pantalla.
 */

/** Clave de localStorage con el identificador anónimo y la fecha en que se creó. */
export const CLAVE_DISPOSITIVO = 'foco-dispositivo';
/** Cada cuántos días se renueva el identificador, para que no sirva de seguimiento a largo plazo. */
export const DIAS_RENOVACION = 30;

const DIA_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RegistroDispositivo {
  id: string;
  /** Milisegundos desde 1970 en que se creó el identificador. */
  creadoEn: number;
}

/** Si el almacenamiento falla (navegación privada, datos bloqueados), el identificador vive solo mientras dure la página. */
let enMemoria: RegistroDispositivo | null = null;

/** UUID v4. Usa `randomUUID` y, si el navegador no lo ofrece (por ejemplo, sin HTTPS), `getRandomValues`. */
function nuevoUuid(): string {
  // `randomUUID` solo existe en contextos seguros: se declara opcional para poder caer a `getRandomValues`.
  const cripto: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> =
    globalThis.crypto;
  if (cripto.randomUUID) return cripto.randomUUID();
  const bytes = cripto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40; // versión 4
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** ¿Sigue valiendo el identificador? No si pasaron 30 días o si su fecha está en el futuro (el reloj se movió). */
function vigente(registro: RegistroDispositivo, ahora: number): boolean {
  const edad = ahora - registro.creadoEn;
  return edad >= 0 && edad < DIAS_RENOVACION * DIA_MS;
}

function interpretar(bruto: string): RegistroDispositivo | null {
  try {
    const dato: unknown = JSON.parse(bruto);
    if (typeof dato !== 'object' || dato === null) return null;
    const { id, creadoEn } = dato as Record<string, unknown>;
    if (typeof id !== 'string' || !UUID.test(id)) return null;
    if (typeof creadoEn !== 'number' || !Number.isFinite(creadoEn)) return null;
    return { id, creadoEn };
  } catch {
    return null;
  }
}

/** Identificador guardado en localStorage, o uno nuevo guardado allí. Null si el almacenamiento no responde. */
function desdeAlmacenamiento(ahora: number): string | null {
  try {
    const bruto = localStorage.getItem(CLAVE_DISPOSITIVO);
    const guardado = bruto === null ? null : interpretar(bruto);
    if (guardado && vigente(guardado, ahora)) return guardado.id;
    const nuevo: RegistroDispositivo = { id: nuevoUuid(), creadoEn: ahora };
    localStorage.setItem(CLAVE_DISPOSITIVO, JSON.stringify(nuevo));
    return nuevo.id;
  } catch {
    return null;
  }
}

function desdeMemoria(ahora: number): string {
  if (!enMemoria || !vigente(enMemoria, ahora)) enMemoria = { id: nuevoUuid(), creadoEn: ahora };
  return enMemoria.id;
}

/**
 * Identificador anónimo de este dispositivo: un UUID aleatorio en localStorage que se renueva cada 30 días. No se
 * relaciona con ninguna cuenta. Si el almacenamiento falla, usa uno en memoria.
 */
export function identificadorDispositivo(ahora: number = Date.now()): string {
  return desdeAlmacenamiento(ahora) ?? desdeMemoria(ahora);
}

/** ¿El valor es el que pide el evento? Sin valor si no lo lleva; uno de su lista si lo lleva. */
function valorAdmitido(tipo: TipoEvento, valor: string | undefined): boolean {
  const evento = EVENTOS_APP.find((candidato) => candidato.tipo === tipo);
  if (!evento) return false;
  if (evento.valor === null) return valor === undefined;
  return valor !== undefined && (VALORES[evento.valor] as readonly string[]).includes(valor);
}

/**
 * Envía un evento de la lista cerrada. No hace nada si la medición está apagada, si no hay Supabase configurado o si el
 * valor no es el de la lista. No espera la respuesta y nunca lanza: un error se traga.
 */
export function registrarEvento(tipo: TipoEvento, valor?: string): void {
  try {
    if (!plantilla.medicionAnonima || !isCloudEnabled()) return;
    const { supabaseUrl, supabaseAnonKey } = env;
    if (!supabaseUrl || !supabaseAnonKey || !valorAdmitido(tipo, valor)) return;

    const cuerpo = {
      tipo,
      dispositivo: identificadorDispositivo(),
      ...(valor === undefined ? {} : { valor }),
    };
    fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/eventos`, {
      method: 'POST',
      headers: { apikey: supabaseAnonKey, 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // La medición nunca rompe una pantalla.
  }
}
