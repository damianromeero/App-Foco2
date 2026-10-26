import { validarEvento } from '../_shared/eventos.ts';

/**
 * Manejador de la función `eventos` (medición anónima). Recibe sus dependencias por parámetro para poder probarlo sin
 * Deno, sin red y sin base: `index.ts` le pasa el entorno real y las pruebas le pasan un `fetch` falso.
 *
 * Orden de las respuestas:
 *  1. Medición apagada: 204, sin leer el cuerpo ni llamar a `fetch`. Lo decide el servidor, no el navegador.
 *  2. OPTIONS (la comprobación previa de CORS del navegador): 204 con las cabeceras CORS.
 *  3. Método distinto de POST: 405.
 *  4. Cuerpo de más de 2 KB o que no es JSON: 400.
 *  5. Evento que no pasa la validación (lista cerrada): 400 con un mensaje en español.
 *  6. Sin `supabaseUrl` o sin `anonKey`: 503.
 *  7. Más de 60 eventos por minuto desde la misma dirección en esta instancia: 429.
 *  8. Llamada a `registrar_evento_app` con la clave PÚBLICA (anon), nunca la de servicio. Si falla: 502.
 *     Si la base devuelve `false` (límite por dispositivo o total del minuto): 429. Si guardó: 204.
 *
 * La dirección del cliente solo se usa en memoria para el límite de la instancia: no se guarda ni se reenvía a la base.
 * La protección que cuenta es la de la base (30 por dispositivo y 600 en total por minuto): la de aquí solo frena ráfagas.
 */

/** Tamaño máximo del cuerpo: 2 KB. */
export const MAX_CUERPO_BYTES = 2048;
/** Eventos por minuto y por dirección que acepta una instancia. */
export const MAX_EVENTOS_POR_MINUTO = 60;

const VENTANA_MS = 60_000;
const LIMPIAR_A_PARTIR_DE = 5_000;
const TIEMPO_MAX_RPC_MS = 5_000;

export interface DependenciasEventos {
  /** Interruptor del servidor (`medicionAnonima` de `_shared/eventos.ts`). */
  medicionAnonima: boolean;
  /** SUPABASE_URL de la función. */
  supabaseUrl: string | undefined;
  /** Clave pública (anon) de la función. Nunca la clave de servicio. */
  anonKey: string | undefined;
  fetch: typeof fetch;
  /** Reloj en milisegundos, para probar el límite sin esperar. */
  ahora?: () => number;
  /** URL de la app (APP_URL). Solo ese origen recibe cabeceras CORS. */
  appUrl?: string;
}

/** Límite de ventana deslizante en memoria: una lista de instantes por clave. */
class LimiteVentana {
  private readonly registros = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs: number,
  ) {}

  private recientes(clave: string, ahora: number): number[] {
    return (this.registros.get(clave) ?? []).filter(
      (instante) => ahora - instante < this.ventanaMs,
    );
  }

  /** Registra un intento. Devuelve false si la clave ya agotó el máximo dentro de la ventana. */
  permitir(clave: string, ahora: number): boolean {
    const usos = this.recientes(clave, ahora);
    if (usos.length >= this.maximo) {
      this.registros.set(clave, usos);
      return false;
    }
    usos.push(ahora);
    this.registros.set(clave, usos);
    if (this.registros.size > LIMPIAR_A_PARTIR_DE) this.limpiar(ahora);
    return true;
  }

  private limpiar(ahora: number): void {
    for (const clave of [...this.registros.keys()]) {
      if (this.recientes(clave, ahora).length === 0) this.registros.delete(clave);
    }
  }
}

/** Dirección del cliente según la cabecera del proxy. Solo vive en memoria durante el minuto del límite. */
function direccionDelCliente(request: Request): string {
  const reenviada = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const direccion =
    reenviada ||
    request.headers.get('cf-connecting-ip')?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'desconocida';
  return direccion.slice(0, 64);
}

/** Cabeceras CORS: solo el origen de la app (APP_URL) puede llamar desde un navegador. */
function cabecerasCors(origen: string | null, appUrl: string | undefined): Record<string, string> {
  let permitido = '';
  try {
    permitido = appUrl ? new URL(appUrl).origin : '';
  } catch {
    permitido = '';
  }
  return {
    ...(permitido
      ? { 'Access-Control-Allow-Origin': origen === permitido ? origen : permitido }
      : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/**
 * Lee el cuerpo como texto sin pasar de `maximo` bytes: corta la lectura en cuanto lo supera, así un cuerpo enorme no se
 * carga entero en memoria. Devuelve null si pasa del máximo o si la lectura falla.
 */
async function leerTexto(request: Request, maximo: number): Promise<string | null> {
  const declarado = request.headers.get('content-length');
  if (declarado !== null && Number(declarado) > maximo) return null;
  if (!request.body) return '';

  const lector = request.body.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximo) {
        await lector.cancel();
        return null;
      }
      trozos.push(value);
    }
  } catch {
    return null;
  }

  const bytes = new Uint8Array(total);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    bytes.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Crea el manejador de peticiones de la función `eventos`. */
export function crearManejadorEventos(
  dependencias: DependenciasEventos,
): (request: Request) => Promise<Response> {
  const limite = new LimiteVentana(MAX_EVENTOS_POR_MINUTO, VENTANA_MS);
  const ahora = dependencias.ahora ?? (() => Date.now());

  return async (request) => {
    const cors = cabecerasCors(request.headers.get('origin'), dependencias.appUrl);
    const base = { ...cors, 'Cache-Control': 'no-store' };
    const sinCuerpo = (estado: number, extra: Record<string, string> = {}) =>
      new Response(null, { status: estado, headers: { ...base, ...extra } });
    const error = (estado: number, mensaje: string, extra: Record<string, string> = {}) =>
      new Response(JSON.stringify({ error: mensaje }), {
        status: estado,
        headers: { ...base, 'Content-Type': 'application/json', ...extra },
      });

    // 1. Apagada: no se lee el cuerpo ni se llama a nadie.
    if (!dependencias.medicionAnonima) return sinCuerpo(204);
    // 2. Comprobación previa de CORS.
    if (request.method === 'OPTIONS') return sinCuerpo(204);
    // 3. Solo POST.
    if (request.method !== 'POST') {
      return error(405, 'Método no permitido.', { Allow: 'POST, OPTIONS' });
    }

    // 4. Cuerpo pequeño y JSON.
    const texto = await leerTexto(request, MAX_CUERPO_BYTES);
    if (texto === null) return error(400, 'El cuerpo del evento es demasiado grande.');
    let cuerpo: unknown;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      return error(400, 'El cuerpo del evento no es un JSON válido.');
    }

    // 5. Lista cerrada.
    const resultado = validarEvento(cuerpo);
    if (!resultado.ok) return error(400, resultado.error);

    // 6. Sin base no hay dónde guardar.
    const { supabaseUrl, anonKey, fetch: llamar } = dependencias;
    if (!supabaseUrl || !anonKey) return error(503, 'La medición no está conectada.');

    // 7. Límite de esta instancia.
    if (!limite.permitir(direccionDelCliente(request), ahora())) {
      return error(429, 'Demasiados eventos seguidos.');
    }

    // 8. Guardar con la función de la base y la clave pública.
    const { tipo, dispositivo, valor } = resultado.evento;
    let guardado: unknown = true;
    try {
      // Se llama como función suelta (no como método del objeto): `fetch` del navegador exige su propio `this`.
      const respuesta = await llamar(
        `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/registrar_evento_app`,
        {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            p_tipo: tipo,
            p_dispositivo: dispositivo,
            p_valor: valor ?? null,
          }),
          signal: AbortSignal.timeout(TIEMPO_MAX_RPC_MS),
        },
      );
      if (!respuesta.ok) return error(502, 'No se pudo guardar el evento.');
      guardado = await respuesta.json().catch(() => true);
    } catch {
      return error(502, 'No se pudo guardar el evento.');
    }

    // La base devuelve false (sin error) cuando se agotó el límite por dispositivo o el total del minuto.
    if (guardado === false) return error(429, 'Demasiados eventos seguidos.');
    return sinCuerpo(204);
  };
}
