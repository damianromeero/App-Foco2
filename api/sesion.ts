/**
 * Ruta de Vercel /api/sesion. La lógica está en servidor/ruta-sesion.ts (pura y probada). Aquí solo se conectan las
 * variables del servidor y el fetch. Runtime edge: Request y Response web.
 */
import { manejarSesion } from '../servidor/ruta-sesion';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return manejarSesion(request, {
    env: process.env,
    fetch: (entrada, init) => fetch(entrada, init),
  });
}
