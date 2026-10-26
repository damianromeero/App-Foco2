/**
 * Lógica de /api/admin/mfa (api/admin/mfa.ts la conecta a Vercel). PURO: el fetch llega inyectado.
 *
 * Reenvía a GoTrue, con el token de la administradora (cookie `foco_admin`), solo estas acciones:
 *
 *  GET                                   factores de la persona: { factores: [{ id, factor_type, status, friendly_name,
 *                                        created_at }] }. Vienen del usuario (GET /auth/v1/user), como en la librería.
 *  POST { accion: 'alta', nombre }       crea un factor TOTP: { id, qr, secreto }. Nada se guarda en la app.
 *  POST { accion: 'reto', factorId }     pide un reto: { challengeId }.
 *  POST { accion: 'verificar', factorId, challengeId, code }
 *                                        comprueba el código. Si es correcto, GoTrue devuelve tokens nuevos con nivel aal2:
 *                                        el servidor los fija en la cookie `foco_admin` y responde { ok: true }. Los tokens
 *                                        nunca van en el cuerpo. Un código incorrecto responde 400 codigo-incorrecto.
 *
 * Cualquier otra acción se rechaza con 400. La clave de servicio no se usa.
 */
import { z } from 'zod';
import {
  cookieBorrada,
  cookieDeSesion,
  NOMBRE_COOKIE_ADMIN,
  tokensDeLaPeticion,
  tokensValidos,
} from './cookie';
import {
  configuracionSupabase,
  leerJson,
  leerJsonSeguro,
  origenPermitido,
  respuestaJson,
  respuestaNoPermitida,
  sinBackend,
  type ConfigSupabase,
  type DependenciasServidor,
  type FetchServidor,
} from './http';
import { resolverSesion } from './sesion';
import { leerFactores, pedirAuth } from './supabase';

const METODOS = ['GET', 'POST'] as const;
const LIMITE_CUERPO = 4_000;

const idSchema = z.uuid();
const cuerpoSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('alta'), nombre: z.string().trim().min(1).max(64) }),
  z.object({ accion: z.literal('reto'), factorId: idSchema }),
  z.object({
    accion: z.literal('verificar'),
    factorId: idSchema,
    challengeId: idSchema,
    code: z.string().regex(/^\d{6}$/),
  }),
]);
type Accion = z.infer<typeof cuerpoSchema>;

const altaRespuestaSchema = z.object({
  id: z.string().min(1),
  totp: z.object({ qr_code: z.string().min(1), secret: z.string().min(1) }),
});
const retoRespuestaSchema = z.object({ id: z.string().min(1) });
const verificarRespuestaSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
});

export async function manejarMfa(request: Request, deps: DependenciasServidor): Promise<Response> {
  if (!(METODOS as readonly string[]).includes(request.method))
    return respuestaNoPermitida(METODOS);
  if (request.method === 'POST' && !origenPermitido(request))
    return respuestaJson(403, { ok: false, tipo: 'origen-no-permitido' });
  const config = configuracionSupabase(deps.env);
  if (!config) return sinBackend();

  const tokens = tokensDeLaPeticion(request, NOMBRE_COOKIE_ADMIN);
  if (tokens === null) return respuestaJson(401, { ok: false, tipo: 'sin-sesion' });

  try {
    const sesion = await resolverSesion(tokens, config, deps.fetch);
    if (sesion.tipo === 'sin-sesion') {
      return respuestaJson(
        401,
        { ok: false, tipo: 'sin-sesion' },
        sesion.borrarCookie ? [cookieBorrada(request, NOMBRE_COOKIE_ADMIN)] : [],
      );
    }
    if (sesion.tipo === 'error') return respuestaJson(502, { ok: false, tipo: 'error' });

    const cookies = sesion.renovada
      ? [cookieDeSesion(sesion.tokens, request, NOMBRE_COOKIE_ADMIN)]
      : [];
    const token = sesion.tokens.accessToken;

    if (request.method === 'GET') return await listar(config, deps.fetch, token, cookies);

    const lectura = await leerJson(request, LIMITE_CUERPO);
    const cuerpo = lectura.ok ? cuerpoSchema.safeParse(lectura.valor) : null;
    if (!cuerpo?.success) {
      return respuestaJson(400, { ok: false, tipo: 'accion-no-valida' }, cookies);
    }
    return await accion(cuerpo.data, request, config, deps.fetch, token, cookies);
  } catch {
    return respuestaJson(502, { ok: false, tipo: 'error' });
  }
}

async function listar(
  config: ConfigSupabase,
  fetch: FetchServidor,
  token: string,
  cookies: string[],
): Promise<Response> {
  const resultado = await leerFactores(config, fetch, token);
  if (resultado.tipo === 'no-valido') return respuestaJson(401, { ok: false, tipo: 'sin-sesion' });
  if (resultado.tipo === 'error') return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
  const factores = resultado.factores.map((factor) => ({
    id: factor.id,
    factor_type: factor.factor_type,
    status: factor.status,
    friendly_name: factor.friendly_name,
    created_at: factor.created_at,
  }));
  return respuestaJson(200, { factores }, cookies);
}

async function accion(
  cuerpo: Accion,
  request: Request,
  config: ConfigSupabase,
  fetch: FetchServidor,
  token: string,
  cookies: string[],
): Promise<Response> {
  switch (cuerpo.accion) {
    case 'alta': {
      const respuesta = await pedirAuth(config, fetch, token, {
        metodo: 'POST',
        ruta: '/factors',
        cuerpo: { factor_type: 'totp', friendly_name: cuerpo.nombre },
      });
      if (!respuesta.ok) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
      const datos = altaRespuestaSchema.safeParse(await leerJsonSeguro(respuesta));
      if (!datos.success) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
      // Mismo formato que la librería cliente: el QR llega como imagen SVG en una URL de datos.
      return respuestaJson(
        200,
        {
          id: datos.data.id,
          qr: `data:image/svg+xml;utf-8,${datos.data.totp.qr_code}`,
          secreto: datos.data.totp.secret,
        },
        cookies,
      );
    }
    case 'reto': {
      const respuesta = await pedirAuth(config, fetch, token, {
        metodo: 'POST',
        ruta: `/factors/${cuerpo.factorId}/challenge`,
        cuerpo: {},
      });
      if (!respuesta.ok) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
      const datos = retoRespuestaSchema.safeParse(await leerJsonSeguro(respuesta));
      if (!datos.success) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
      return respuestaJson(200, { challengeId: datos.data.id }, cookies);
    }
    case 'verificar': {
      const respuesta = await pedirAuth(config, fetch, token, {
        metodo: 'POST',
        ruta: `/factors/${cuerpo.factorId}/verify`,
        cuerpo: { challenge_id: cuerpo.challengeId, code: cuerpo.code },
      });
      if (respuesta.status >= 500) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
      if (!respuesta.ok) {
        return respuestaJson(400, { ok: false, tipo: 'codigo-incorrecto' }, cookies);
      }
      const datos = verificarRespuestaSchema.safeParse(await leerJsonSeguro(respuesta));
      const nuevos = datos.success
        ? tokensValidos({
            accessToken: datos.data.access_token,
            refreshToken: datos.data.refresh_token,
          })
        : null;
      if (nuevos === null) return respuestaJson(502, { ok: false, tipo: 'error' }, cookies);
      // Los tokens nuevos llevan el nivel aal2: sustituyen a los de la cookie. No se devuelven.
      return respuestaJson(200, { ok: true }, [
        cookieDeSesion(nuevos, request, NOMBRE_COOKIE_ADMIN),
      ]);
    }
  }
}
