/**
 * Configuración del panel de administración. Nada de aquí es un dato de compradores: son nombres, listas cerradas,
 * límites y colores. Textos de campaña, marcas, precios y ofertas no van en el panel.
 */
import { EVENTOS_APP } from '../config/medicion';
import { plantilla } from '../config/plantilla';

/** Periodos del panel: se definen en periodo.ts (con sus fechas) y se reexportan aquí como parte de la configuración. */
export { PERIODOS, PERIODO_INICIAL, type Periodo } from './periodo';

export const ADMIN_APP = {
  nombre: plantilla.nombre,
  etiqueta: 'Administración',
  /**
   * Zona horaria (nombre IANA) de los periodos, las gráficas, los días de retención y los formatos del panel. Por defecto
   * America/Bogota. Cámbiala por tu zona (por ejemplo Europe/Madrid): src/admin/zona.ts la aplica en todo el cálculo.
   */
  zonaHoraria: 'America/Bogota',
} as const;

/**
 * Colores de la marca. Son los tokens de src/index.css, así que el panel cambia con el tema igual que la app.
 */
export const PALETA = {
  marca: 'var(--c-brand)',
  acento: 'var(--c-accent-text)',
  aviso: 'var(--c-accent-text)',
  peligro: 'var(--c-danger-text)',
  tinta: 'var(--c-ink)',
  tintaSuave: 'var(--c-ink-soft)',
  linea: 'var(--c-line)',
} as const;

/** Filas máximas que se leen por consulta. Si hay más, el panel muestra un error: nunca cifras parciales. */
export const LIMITE_FILAS = 5000;

/**
 * Etapas del embudo de compra, en orden. Las de origen «evento» son tipos de `EVENTOS_APP` (src/config/medicion.ts);
 * la de origen «compras» cuenta las compras aprobadas de la tabla `compras`. Debe ir la última.
 */
export const ETAPAS_EMBUDO = [
  { id: 'portada_vista', origen: 'evento', etiqueta: 'Vio la portada' },
  { id: 'precios_vista', origen: 'evento', etiqueta: 'Vio los precios' },
  { id: 'compra_clic', origen: 'evento', etiqueta: 'Pulsó comprar' },
  { id: 'compra_aprobada', origen: 'compras', etiqueta: 'Compra aprobada' },
] as const;

export type EtapaEmbudo = (typeof ETAPAS_EMBUDO)[number];

/** Avisos de Hotmart que necesitan revisión. Cualquier otro estado se considera procesado. */
export const ESTADOS_AVISO_REVISION = [
  'sin-correo',
  'sin-fecha',
  'formato-no-reconocido',
  'rechazado',
  'no-procesado',
  'sin-plan',
  'divisa-no-usd',
] as const;

export type EstadoAvisoRevision = (typeof ESTADOS_AVISO_REVISION)[number];

export const ETIQUETA_AVISO: Record<EstadoAvisoRevision, string> = {
  'sin-correo': 'Falta el correo del comprador',
  'sin-fecha': 'Falta la fecha del aviso',
  'formato-no-reconocido': 'Formato del aviso no reconocido',
  rechazado: 'Aviso rechazado por datos incompletos',
  'no-procesado': 'Aviso recibido sin procesar',
  'sin-plan': 'La oferta no tiene plan asignado',
  'divisa-no-usd': 'El precio no está en dólares',
};

export const ETIQUETA_COMPRA = {
  aprobada: 'Aprobada',
  reembolsada: 'Reembolsada',
  cancelada: 'Cancelada',
} as const;

export const ETIQUETA_PLAN = {
  mensual: 'Mensual',
  anual: 'Anual',
} as const;

/** Texto de un tipo de evento para el panel. Si el tipo no está en la lista cerrada, se muestra tal cual. */
export function etiquetaEvento(tipo: string): string {
  return EVENTOS_APP.find((evento) => evento.tipo === tipo)?.etiqueta ?? tipo;
}
