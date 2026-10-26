/**
 * Ruta de Vercel /api/sincronizacion. La lógica está en servidor/ruta-sincronizacion.ts (pura y probada). Usa el token
 * de la propia persona: RLS decide. Nunca la clave de servicio.
 */
import { manejarSincronizacion } from '../servidor/ruta-sincronizacion';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return manejarSincronizacion(request, {
    env: process.env,
    fetch: (entrada, init) => fetch(entrada, init),
  });
}
