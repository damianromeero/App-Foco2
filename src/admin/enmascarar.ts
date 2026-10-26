/**
 * Enmascaramiento de datos de compradores. Son puros: lo que sale de aquí es lo único que ve la interfaz.
 */

/** Correo con la primera letra y el dominio: «cliente@example.com» → «c***@example.com». Sin arroba válida: «***». */
export function enmascararCorreo(correo: string): string {
  const arroba = correo.lastIndexOf('@');
  if (arroba <= 0 || arroba === correo.length - 1) return '***';
  return `${correo.charAt(0)}***${correo.slice(arroba)}`;
}

/** Identificador de transacción: solo los últimos 6 caracteres. Un identificador corto no se muestra. */
export function ultimosSeis(identificador: string): string {
  return identificador.length > 6 ? `…${identificador.slice(-6)}` : '…';
}
