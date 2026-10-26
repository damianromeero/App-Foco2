/**
 * Ruta de Vercel /api/admin/mfa. Reenvía a GoTrue solo las acciones de segundo factor (alta, reto, verificar) con el
 * token de la administradora. La lógica está en servidor/admin-mfa.ts.
 */
import { manejarMfa } from '../../servidor/admin-mfa';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return manejarMfa(request, {
    env: process.env,
    fetch: (entrada, init) => fetch(entrada, init),
  });
}
