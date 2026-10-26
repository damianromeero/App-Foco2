/**
 * Regla de acceso de las personas compradoras. PURA: sin red, sin variables de entorno y sin navegador. La usan el
 * servidor (api/sesion.ts) y el navegador (src/services/acceso.ts), así hay una sola regla.
 *
 * La decisión la toma la base de datos con la sesión de la propia persona: la vista `accesos_vigentes` solo devuelve
 * sus filas activas y no vencidas (RLS). Aquí solo se interpreta el resultado.
 */

/** Resultado de comprobar el acceso de un correo. Ante un error nunca se concede acceso. */
export type ResultadoAcceso =
  | { tipo: 'con-acceso'; correo: string }
  | { tipo: 'sin-acceso'; correo: string }
  | { tipo: 'error' };

/** Filas leídas de `accesos_vigentes` para un correo. Null si la consulta falló. */
export type FilasAcceso = readonly { estado?: unknown }[] | null;

/** Correo en minúsculas y sin espacios: la forma que se compara con `accesos`. */
export function normalizarCorreo(valor: string): string {
  return valor.trim().toLowerCase();
}

/**
 * Decide a partir de las filas del correo. Solo una fila «activo» da acceso. Si la consulta falló (null), no se concede
 * nada y se devuelve error.
 */
export function decidirAcceso(correo: string, filas: FilasAcceso): ResultadoAcceso {
  if (filas === null) return { tipo: 'error' };
  return filas.some((fila) => fila.estado === 'activo')
    ? { tipo: 'con-acceso', correo }
    : { tipo: 'sin-acceso', correo };
}
