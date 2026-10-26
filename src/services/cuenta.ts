import { plantilla } from '../config/plantilla';
import { llamarApi, RUTA_CUENTA } from './sesion';
import { isCloudEnabled } from './supabase';

/**
 * Eliminar la cuenta. La ruta /api/cuenta llama a la función de base `borrar_mi_cuenta` (migración 20261025110000) con el
 * token de la propia persona, que guarda el servidor: borra solo su cuenta. Este módulo NO llama a Hotmart, a Stripe ni a
 * ningún proveedor de cobros: la suscripción la cancela la persona compradora en Hotmart.
 */

/** Función de base que borra la cuenta de quien llama. */
export const FUNCION_BORRAR_CUENTA = 'borrar_mi_cuenta';

/** Palabra que la persona debe escribir para confirmar el borrado. */
export const PALABRA_CONFIRMAR_BORRADO = 'ELIMINAR';

/** ¿El texto escrito confirma el borrado? Ignora solo los espacios de los extremos. */
export function confirmacionDeBorradoValida(texto: string): boolean {
  return texto.trim() === PALABRA_CONFIRMAR_BORRADO;
}

/**
 * Texto exacto que se muestra antes de confirmar. Explica que borrar la cuenta no cancela la suscripción de Hotmart y
 * dónde cancelarla. El correo de soporte sale de la configuración (plantilla.soporteEmail).
 */
export function avisoDeBorradoHotmart(correoSoporte: string = plantilla.soporteEmail): string {
  return (
    'Eliminar tu cuenta NO cancela tu suscripción en Hotmart. Si tienes una suscripción activa, ' +
    'cancélala primero en consumer.hotmart.com (Minhas compras → tu producto → Configurar pagamento → ' +
    `Cancelar sua assinatura → Sim). Para ayuda, escribe a ${correoSoporte}.`
  );
}

/** Borra la cuenta con la sesión de la persona. Lanza un error con texto para mostrar si el servidor o la base lo rechazan. */
export async function borrarMiCuenta(): Promise<void> {
  if (!isCloudEnabled()) throw new Error('Las cuentas no están disponibles.');
  const respuesta = await llamarApi(RUTA_CUENTA, 'DELETE');
  if (!respuesta?.ok) {
    throw new Error('No se pudo eliminar la cuenta. Inténtalo de nuevo.');
  }
}
