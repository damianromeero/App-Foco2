/**
 * Lecturas del panel. Van a /api/admin/datos con la cookie httpOnly de la administradora: el servidor reenvía a la base
 * con su token, y RLS decide qué filas devuelve.
 *
 * - Sin nube devuelven null sin llamar a nada.
 * - Cada fila se valida: si una no encaja, o hay más de LIMITE_FILAS, se lanza un error. Nunca se devuelven datos
 *   parciales que parezcan completos.
 * - Correo e identificadores se enmascaran aquí: la interfaz no recibe nunca los valores completos.
 */
import { z } from 'zod';
import { llamarApi } from '../services/sesion';
import { isCloudEnabled } from '../services/supabase';
import { LIMITE_FILAS } from './config';
import { enmascararCorreo, ultimosSeis } from './enmascarar';
import type { AvisoFila, CompraFila, EventoFila } from './metricas';
import { type Periodo, rangoPeriodo, type RangoPeriodo } from './periodo';

const MENSAJE_ERROR =
  'No pudimos leer los datos del panel. Revisa tu conexión y vuelve a intentarlo.';
const MENSAJE_LIMITE = `Hay más de ${LIMITE_FILAS} registros en este periodo. Elige un periodo más corto para verlos completos.`;

const filaCompra = z.object({
  id_hotmart: z.string(),
  plan: z.enum(['mensual', 'anual']),
  monto_usd: z.number(),
  estado: z.enum(['aprobada', 'reembolsada', 'cancelada']),
  correo: z.string().nullable(),
  creado_en: z.string(),
});

const filaEvento = z.object({
  tipo: z.string(),
  dispositivo: z.string(),
  creado_en: z.string(),
});

const filaAviso = z.object({
  id_evento: z.string(),
  estado: z.string(),
  recibido_en: z.string(),
});

export interface ResumenPanel {
  compras: CompraFila[];
  eventos: EventoFila[];
  avisos: AvisoFila[];
}

interface Contexto {
  rango: RangoPeriodo;
}

/** Ruta del servidor que lee las tablas del panel (lista blanca y RLS en servidor/admin-datos.ts). */
export const RUTA_DATOS_ADMIN = '/api/admin/datos';

function contextoDe(periodo: Periodo, ahora: number): Contexto | null {
  if (!isCloudEnabled()) return null;
  return { rango: rangoPeriodo(periodo, ahora) };
}

/** Lee una tabla acotada al periodo. Si hay más filas que el límite, error: nunca un recorte silencioso. */
async function leerTabla<S extends z.ZodType>(
  contexto: Contexto,
  tabla: string,
  columnas: string,
  columnaFecha: string,
  esquema: S,
): Promise<z.output<S>[]> {
  const parametros = new URLSearchParams({
    tabla,
    select: columnas,
    columnaFecha,
    desde: contexto.rango.desde,
    hasta: contexto.rango.hasta,
    limite: String(LIMITE_FILAS + 1),
  });
  const respuesta = await llamarApi(`${RUTA_DATOS_ADMIN}?${parametros.toString()}`, 'GET');
  if (!respuesta?.ok) throw new Error(MENSAJE_ERROR);
  let datos: unknown;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(MENSAJE_ERROR);
  }
  if (!Array.isArray(datos)) throw new Error(MENSAJE_ERROR);
  if (datos.length > LIMITE_FILAS) throw new Error(MENSAJE_LIMITE);
  const resultado = z.array(esquema).safeParse(datos);
  if (!resultado.success) throw new Error(MENSAJE_ERROR);
  return resultado.data;
}

async function comprasDe(contexto: Contexto): Promise<CompraFila[]> {
  const filas = await leerTabla(
    contexto,
    'compras',
    'id_hotmart, plan, monto_usd, estado, correo, creado_en',
    'creado_en',
    filaCompra,
  );
  return filas.map((fila) => ({
    referencia: ultimosSeis(fila.id_hotmart),
    correoEnmascarado: enmascararCorreo(fila.correo ?? ''),
    plan: fila.plan,
    montoUsd: fila.monto_usd,
    estado: fila.estado,
    creadoEn: fila.creado_en,
  }));
}

async function eventosDe(contexto: Contexto): Promise<EventoFila[]> {
  const filas = await leerTabla(
    contexto,
    'eventos_app',
    'tipo, dispositivo, creado_en',
    'creado_en',
    filaEvento,
  );
  return filas.map((fila) => ({
    tipo: fila.tipo,
    dispositivo: fila.dispositivo,
    creadoEn: fila.creado_en,
  }));
}

async function avisosDe(contexto: Contexto): Promise<AvisoFila[]> {
  const filas = await leerTabla(
    contexto,
    'eventos_pago',
    'id_evento, estado, recibido_en',
    'recibido_en',
    filaAviso,
  );
  return filas.map((fila) => ({
    referencia: ultimosSeis(fila.id_evento),
    estado: fila.estado,
    recibidoEn: fila.recibido_en,
  }));
}

/** Eventos de uso del periodo, con su rango y el instante de la consulta (solo tipo, dispositivo anónimo y momento). */
export interface UsoPeriodo {
  eventos: EventoFila[];
  rango: RangoPeriodo;
  ahora: number;
}

/** Compras del periodo, enmascaradas. */
export async function leerCompras(periodo: Periodo): Promise<CompraFila[] | null> {
  const contexto = contextoDe(periodo, Date.now());
  return contexto ? comprasDe(contexto) : null;
}

export async function leerUso(periodo: Periodo): Promise<UsoPeriodo | null> {
  const ahora = Date.now();
  const contexto = contextoDe(periodo, ahora);
  if (!contexto) return null;
  return { eventos: await eventosDe(contexto), rango: contexto.rango, ahora };
}

/** Avisos de Hotmart recibidos en el periodo. */
export async function leerAvisos(periodo: Periodo): Promise<AvisoFila[] | null> {
  const contexto = contextoDe(periodo, Date.now());
  return contexto ? avisosDe(contexto) : null;
}

/** Compras, eventos y avisos del periodo, leídos a la vez. Si una lectura falla, falla todo. */
export async function leerResumen(periodo: Periodo): Promise<ResumenPanel | null> {
  const contexto = contextoDe(periodo, Date.now());
  if (!contexto) return null;
  const [compras, eventos, avisos] = await Promise.all([
    comprasDe(contexto),
    eventosDe(contexto),
    avisosDe(contexto),
  ]);
  return { compras, eventos, avisos };
}
