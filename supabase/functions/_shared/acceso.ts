/**
 * Acceso de compradores a la app. PURO: sin red, sin reloj y sin API de Deno, para probarlo con Vitest.
 *
 * Regla (REGLAS-HOTMART.md), decidida por correo: la app vende un solo producto con dos planes, así que la clave es el
 * correo. Si aparecen varios productos, la clave pasa a correo + producto [VERIFICAR].
 *  - Compra aprobada o mantenida (Hotmart reintentando el cobro) cuenta. Reembolsada o cancelada no cuenta.
 *  - Compra de suscripción con suscripción activa: cuenta sin límite.
 *  - Suscripción cancelada: el motivo no se guarda en la cancelación; se deriva del último cobro de la misma fila. Último
 *    cobro «impago» → cancelación por impago: no cuenta. Cualquier otro → voluntaria: cuenta hasta `acceso_hasta`
 *    (date_next_charge, o la fecha del aviso si faltaba).
 *  Basta UNA compra que cuente. El resultado no depende del orden de los avisos.
 *
 * La vista public.accesos_vigentes deja de mostrar el acceso cuando `acceso_hasta` ya pasó: la decisión se comprueba al
 * leer, en la base.
 */

export type EstadoCompraAcceso = 'aprobada' | 'mantenida' | 'reembolsada' | 'cancelada';
export type MotivoCancelacion = 'voluntaria' | 'impago';
/** Último cobro guardado en la suscripción (suscripciones_hotmart.ultimo_cobro). null = sin información. */
export type UltimoCobroAcceso = 'aprobado' | 'impago' | 'otro' | null;

/** Lo que hace falta de una compra para decidir el acceso. */
export interface CompraDeAcceso {
  estado: string;
  /** Suscriptor de Hotmart si la compra es parte de una suscripción; null si es un cobro único. */
  suscriptor: string | null;
}

/** Lo que hace falta de una suscripción para decidir el acceso. */
export interface SuscripcionDeAcceso {
  estado: 'activa' | 'cancelada';
  /** Último cobro guardado en la misma fila: de él sale el motivo de la cancelación. */
  ultimoCobro: UltimoCobroAcceso;
  /** Hasta cuándo cuenta el acceso de una cancelación voluntaria, en ISO. null si no aplica. */
  accesoHasta: string | null;
}

/** Motivo de una cancelación, derivado del último cobro: impago solo si el último cobro fue impagado. */
export function motivoDeCancelacion(ultimoCobro: UltimoCobroAcceso): MotivoCancelacion {
  return ultimoCobro === 'impago' ? 'impago' : 'voluntaria';
}

export interface ResultadoAcceso {
  estado: 'activo' | 'inactivo';
  /** null = sin fecha de fin (mientras la compra cuente). ISO si el acceso termina en una fecha. */
  accesoHasta: string | null;
}

/** Un correo en minúsculas y sin espacios: la forma que se guarda en compras y en accesos. */
export const normalizarCorreo = (valor: string): string => valor.trim().toLowerCase();

const CUENTAN: ReadonlySet<string> = new Set(['aprobada', 'mantenida']);

/**
 * Calcula el acceso de un correo. `suscripciones` se indexa por suscriptor; una suscripción sin fila se trata como activa
 * (la fila la crea la primera compra aprobada; si falta, no se quita nada sin motivo).
 */
export function calcularAcceso(
  compras: readonly CompraDeAcceso[],
  suscripciones: ReadonlyMap<string, SuscripcionDeAcceso>,
): ResultadoAcceso {
  let sinFin = false;
  const fines: string[] = [];
  for (const compra of compras) {
    if (!CUENTAN.has(compra.estado)) continue;
    if (compra.suscriptor === null) {
      sinFin = true;
      continue;
    }
    const suscripcion = suscripciones.get(compra.suscriptor);
    if (suscripcion === undefined || suscripcion.estado === 'activa') {
      sinFin = true;
    } else if (
      motivoDeCancelacion(suscripcion.ultimoCobro) === 'voluntaria' &&
      suscripcion.accesoHasta !== null
    ) {
      fines.push(suscripcion.accesoHasta);
    }
    // Cancelada por impago: esta compra no cuenta.
  }
  if (sinFin) return { estado: 'activo', accesoHasta: null };
  if (fines.length > 0) {
    const mayor = fines.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
    return { estado: 'activo', accesoHasta: mayor };
  }
  return { estado: 'inactivo', accesoHasta: null };
}
