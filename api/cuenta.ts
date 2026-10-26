/**
 * Ruta de Vercel /api/cuenta. Borra la cuenta con la función de base borrar_mi_cuenta. No llama a ningún proveedor de
 * cobros. La lógica está en servidor/ruta-cuenta.ts.
 */
import { manejarCuenta } from '../servidor/ruta-cuenta';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  return manejarCuenta(request, {
    env: process.env,
    fetch: (entrada, init) => fetch(entrada, init),
  });
}
