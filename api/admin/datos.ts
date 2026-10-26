/**
 * Ruta de Vercel /api/admin/datos. Lecturas del panel con el token de la administradora; RLS decide qué filas se ven.
 * La lógica y la lista blanca de tablas están en servidor/admin-datos.ts.
 */
import { manejarDatos } from '../../servidor/admin-datos';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return manejarDatos(request, {
    env: process.env,
    fetch: (entrada, init) => fetch(entrada, init),
  });
}
