/**
 * Lógica de /api/admin/datos (api/admin/datos.ts la conecta a Vercel). PURO: el fetch llega inyectado.
 *
 * Lecturas del panel, con el token de la administradora (cookie `foco_admin`) y la clave anon. La base decide con
 * RLS: solo la administradora con segundo factor (es_administrador, claim aal2) recibe filas. Nunca la clave de servicio.
 *
 *  GET ?tabla=&select=&columnaFecha=&desde=&hasta=&limite=
 *      Devuelve un array JSON de filas. La forma de la consulta es la de src/admin/consultas.ts:
 *      `select` (columnas), un rango sobre la columna de fecha (gte desde, lt hasta) y un límite.
 *      - `tabla`: solo las de la lista blanca TABLAS_PANEL. Otra → 400.
 *      - `select`: solo columnas de esa tabla. `columnaFecha` debe ser la columna de fecha de la tabla.
 *      - `desde` y `hasta`: instantes ISO 8601 en UTC (con Z o desfase).
 *      - `limite`: entero de 1 a LIMITE_MAXIMO.
 *      Sin orden ni filtros libres: el panel no los usa, y cada parámetro extra se rechaza.
 *
 * Sin sesión → 401. Sin segundo factor (aal1) → 403, para no mostrar un panel vacío que parezca correcto.
 */
import { cookieBorrada, cookieDeSesion, NOMBRE_COOKIE_ADMIN, tokensDeLaPeticion } from './cookie';
import {
  configuracionSupabase,
  respuestaJson,
  respuestaNoPermitida,
  sinBackend,
  type DependenciasServidor,
} from './http';
import { aalDeToken } from './admin-sesion';
import { resolverSesion } from './sesion';
import { pedirRest } from './supabase';

/** Límite de filas que acepta la ruta. El panel pide un registro más que su límite para detectar el exceso. */
export const LIMITE_MAXIMO = 5001;

/** Tablas que lee el panel hoy (src/admin/consultas.ts) y sus columnas permitidas. */
export const TABLAS_PANEL = {
  compras: {
    columnas: ['id_hotmart', 'plan', 'monto_usd', 'estado', 'correo', 'creado_en'],
    columnaFecha: 'creado_en',
  },
  eventos_app: {
    columnas: ['tipo', 'dispositivo', 'creado_en'],
    columnaFecha: 'creado_en',
  },
  eventos_pago: {
    columnas: ['id_evento', 'estado', 'recibido_en'],
    columnaFecha: 'recibido_en',
  },
} as const satisfies Record<string, { columnas: readonly string[]; columnaFecha: string }>;

export type TablaPanel = keyof typeof TABLAS_PANEL;

const METODOS = ['GET'] as const;
const PARAMETROS = ['tabla', 'select', 'columnaFecha', 'desde', 'hasta', 'limite'] as const;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** Consulta validada: lo único que se envía a la base. */
export interface ConsultaPanel {
  tabla: TablaPanel;
  select: string;
  columnaFecha: string;
  desde: string;
  hasta: string;
  limite: number;
}

type Validacion = { ok: true; consulta: ConsultaPanel } | { ok: false };

function esTabla(valor: string): valor is TablaPanel {
  return Object.hasOwn(TABLAS_PANEL, valor);
}

/** Valida la consulta de la URL. Cualquier parámetro desconocido, repetido o fuera de la lista se rechaza. */
export function validarConsulta(url: URL): Validacion {
  const parametros = url.searchParams;
  for (const clave of new Set(parametros.keys())) {
    if (!(PARAMETROS as readonly string[]).includes(clave)) return { ok: false };
    if (parametros.getAll(clave).length !== 1) return { ok: false };
  }
  const tabla = parametros.get('tabla') ?? '';
  if (!esTabla(tabla)) return { ok: false };
  const configuracion = TABLAS_PANEL[tabla];

  const columnas = (parametros.get('select') ?? '').split(',').map((columna) => columna.trim());
  const todas = columnas.every((columna) =>
    (configuracion.columnas as readonly string[]).includes(columna),
  );
  if (columnas.length === 0 || !todas || new Set(columnas).size !== columnas.length) {
    return { ok: false };
  }
  if (parametros.get('columnaFecha') !== configuracion.columnaFecha) return { ok: false };

  const desde = parametros.get('desde') ?? '';
  const hasta = parametros.get('hasta') ?? '';
  if (!esInstante(desde) || !esInstante(hasta)) return { ok: false };

  const limiteTexto = parametros.get('limite') ?? '';
  if (!/^\d{1,5}$/.test(limiteTexto)) return { ok: false };
  const limite = Number(limiteTexto);
  if (limite < 1 || limite > LIMITE_MAXIMO) return { ok: false };

  return {
    ok: true,
    consulta: {
      tabla,
      select: columnas.join(','),
      columnaFecha: configuracion.columnaFecha,
      desde,
      hasta,
      limite,
    },
  };
}

function esInstante(valor: string): boolean {
  return ISO_UTC.test(valor) && !Number.isNaN(Date.parse(valor));
}

/** Ruta de PostgREST para la consulta validada (sin dominio ni prefijo). */
export function rutaPostgrest(consulta: ConsultaPanel): string {
  const parametros = new URLSearchParams();
  parametros.set('select', consulta.select);
  parametros.append(consulta.columnaFecha, `gte.${consulta.desde}`);
  parametros.append(consulta.columnaFecha, `lt.${consulta.hasta}`);
  parametros.set('limit', String(consulta.limite));
  return `/${consulta.tabla}?${parametros.toString()}`;
}

export async function manejarDatos(
  request: Request,
  deps: DependenciasServidor,
): Promise<Response> {
  if (!(METODOS as readonly string[]).includes(request.method))
    return respuestaNoPermitida(METODOS);
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const validacion = validarConsulta(new URL(request.url));
  if (!validacion.ok) return respuestaJson(400, { tipo: 'consulta-no-valida' });

  const tokens = tokensDeLaPeticion(request, NOMBRE_COOKIE_ADMIN);
  if (tokens === null) return respuestaJson(401, { tipo: 'sin-sesion' });

  const sesion = await resolverSesion(tokens, config, deps.fetch);
  if (sesion.tipo === 'sin-sesion') {
    return respuestaJson(
      401,
      { tipo: 'sin-sesion' },
      sesion.borrarCookie ? [cookieBorrada(request, NOMBRE_COOKIE_ADMIN)] : [],
    );
  }
  if (sesion.tipo === 'error') return respuestaJson(502, { tipo: 'error' });

  const cookies = sesion.renovada
    ? [cookieDeSesion(sesion.tokens, request, NOMBRE_COOKIE_ADMIN)]
    : [];
  if (aalDeToken(sesion.tokens.accessToken) !== 'aal2') {
    return respuestaJson(403, { tipo: 'sin-mfa' }, cookies);
  }

  try {
    const respuesta = await pedirRest(config, deps.fetch, sesion.tokens.accessToken, {
      metodo: 'GET',
      ruta: rutaPostgrest(validacion.consulta),
    });
    if (!respuesta.ok) return respuestaJson(502, { tipo: 'error' }, cookies);
    const filas: unknown = await respuesta.json();
    if (!Array.isArray(filas)) return respuestaJson(502, { tipo: 'error' }, cookies);
    return respuestaLista(filas, cookies);
  } catch {
    return respuestaJson(502, { tipo: 'error' }, cookies);
  }
}

/** Lista JSON sin caché. Las filas son las que devuelve la base con RLS; nunca se añaden campos. */
function respuestaLista(filas: unknown[], cookies: readonly string[]): Response {
  const cabeceras = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  for (const cookie of cookies) cabeceras.append('Set-Cookie', cookie);
  return new Response(JSON.stringify(filas), { status: 200, headers: cabeceras });
}
