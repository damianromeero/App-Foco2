// Segundo factor del panel. Lo hace el servidor (/api/admin/mfa) con la cookie httpOnly `foco_admin`: el navegador no
// recibe tokens. Métodos de Supabase MFA que reenvía el servidor (auth-js 2.118.0, comprobado en su código):
//   enroll     → POST /auth/v1/factors, con factor_type 'totp' y friendly_name. Devuelve id y totp.qr_code / totp.secret
//                (la librería cliente antepone «data:image/svg+xml;utf-8,» al QR; el servidor hace lo mismo).
//   challenge  → POST /auth/v1/factors/{id}/challenge. Devuelve el id del reto.
//   verify     → POST /auth/v1/factors/{id}/verify, con challenge_id y code. Devuelve sesión nueva con nivel aal2; el
//                servidor la guarda en la cookie y no la envía al navegador.
//   listFactors → la librería lee los factores del usuario (GET /auth/v1/user, campo factors). Lo mismo hace el servidor.
//   getAuthenticatorAssuranceLevel → el claim `aal` del token. Lo lee el servidor (/api/admin/sesion).
import { z } from 'zod';
import { llamarApi } from '../services/sesion';

export const RUTA_MFA_ADMIN = '/api/admin/mfa';

/** Factor de segundo paso tal como lo muestra la pantalla de seguridad. */
export interface FactorAdmin {
  id: string;
  nombre: string;
  tipo: string;
  verificado: boolean;
  creadoEn: string;
}

/** Datos para mostrar el código QR de un factor recién creado. */
export interface Enrolamiento {
  id: string;
  qr: string;
  secreto: string;
}

const factoresSchema = z.object({
  factores: z.array(
    z.object({
      id: z.string(),
      factor_type: z.string(),
      status: z.string(),
      friendly_name: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});
const enrolamientoSchema = z.object({ id: z.string(), qr: z.string(), secreto: z.string() });
const retoSchema = z.object({ challengeId: z.string() });

async function leerJsonDeRuta(
  metodo: 'GET' | 'POST',
  cuerpo?: unknown,
): Promise<{ ok: boolean; status: number; datos: unknown }> {
  const respuesta = await llamarApi(RUTA_MFA_ADMIN, metodo, cuerpo);
  if (respuesta === null) throw new Error('sin-red');
  return { ok: respuesta.ok, status: respuesta.status, datos: await cuerpoJson(respuesta) };
}

async function cuerpoJson(respuesta: Response): Promise<unknown> {
  try {
    return (await respuesta.json()) as unknown;
  } catch {
    return null;
  }
}

/** Factores de segundo paso de la persona. Lanza si no se pueden leer. */
export async function listarFactores(): Promise<FactorAdmin[]> {
  const { ok, datos } = await leerJsonDeRuta('GET');
  const resultado = factoresSchema.safeParse(datos);
  if (!ok || !resultado.success) throw new Error('listar');
  return resultado.data.factores.map((factor) => ({
    id: factor.id,
    nombre: factor.friendly_name ?? 'Autenticador',
    tipo: factor.factor_type,
    verificado: factor.status === 'verified',
    creadoEn: factor.created_at,
  }));
}

/** Crea un factor TOTP y devuelve su QR y su código. Lanza si falla. */
export async function darDeAltaFactor(nombre: string): Promise<Enrolamiento> {
  const { ok, datos } = await leerJsonDeRuta('POST', { accion: 'alta', nombre });
  const resultado = enrolamientoSchema.safeParse(datos);
  if (!ok || !resultado.success) throw new Error('alta');
  return resultado.data;
}

/** Pide un reto para un factor y devuelve su id. Lanza si falla. */
export async function pedirReto(factorId: string): Promise<string> {
  const { ok, datos } = await leerJsonDeRuta('POST', { accion: 'reto', factorId });
  const resultado = retoSchema.safeParse(datos);
  if (!ok || !resultado.success) throw new Error('reto');
  return resultado.data.challengeId;
}

/**
 * Comprueba el código de 6 dígitos. 'ok' si el servidor guardó la sesión con segundo factor; 'codigo-incorrecto' si el
 * código no vale. Lanza ante cualquier otro fallo.
 */
export async function verificarCodigo(
  factorId: string,
  challengeId: string,
  code: string,
): Promise<'ok' | 'codigo-incorrecto'> {
  const { ok, status, datos } = await leerJsonDeRuta('POST', {
    accion: 'verificar',
    factorId,
    challengeId,
    code,
  });
  if (ok) return 'ok';
  if (status === 400 && typeof datos === 'object' && datos !== null) {
    if ((datos as { tipo?: unknown }).tipo === 'codigo-incorrecto') return 'codigo-incorrecto';
  }
  throw new Error('verificar');
}
