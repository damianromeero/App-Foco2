/**
 * Ruta de Vercel /api/admin/sesion. La lógica está en servidor/admin-sesion.ts (pura y probada). Cookie httpOnly
 * `foco_admin`, separada de la del comprador. Runtime edge: Request y Response web.
 */
import { manejarSesionAdmin } from '../../servidor/admin-sesion';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return manejarSesionAdmin(request, {
    env: process.env,
    fetch: (entrada, init) => fetch(entrada, init),
  });
}
