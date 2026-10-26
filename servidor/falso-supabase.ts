/**
 * Supabase falso para las pruebas de api/. Sin red. Simula los endpoints que usa el servidor y la parte de RLS que
 * importa aquí: cada token solo ve y cambia sus propias filas, y las tablas del panel solo se leen con una administradora
 * con segundo factor (claim aal2). Lo importan las pruebas; producción no lo usa.
 */
import type { FetchServidor } from './http';

export const URL_PRUEBA = 'https://proyecto-de-prueba.supabase.co';
export const ANON_PRUEBA = 'anon-de-prueba';
/** Código TOTP que acepta el falso. Cualquier otro se rechaza como lo haría Supabase. */
export const CODIGO_PRUEBA = '123456';

export interface UsuarioFalso {
  id: string;
  email: string;
}

export interface PeticionFalsa {
  ruta: string;
  metodo: string;
  apikey: string | null;
  autorizacion: string | null;
  cuerpo: string | null;
  prefer: string | null;
}

export interface FactorFalso {
  id: string;
  factor_type: 'totp';
  status: 'verified' | 'unverified';
  friendly_name: string;
  created_at: string;
  secreto: string;
}

export interface SupabaseFalso {
  fetch: FetchServidor;
  /** Todas las llamadas recibidas, en orden. */
  peticiones: PeticionFalsa[];
  /** Token de acceso → usuario. */
  accesos: Map<string, UsuarioFalso>;
  /** Token de renovación → tokens nuevos y usuario. Al usarse, el token de acceso nuevo pasa a ser válido. */
  renovaciones: Map<string, { accessToken: string; refreshToken: string; usuario: UsuarioFalso }>;
  /** Correo → estados de sus filas en accesos_vigentes. */
  accesosPorCorreo: Map<string, string[]>;
  /** Id de usuario → sus sesiones guardadas (filas de daily_sessions). */
  sesiones: Map<string, Record<string, unknown>[]>;
  /** Ids de usuario cuya cuenta se ha borrado con la función de base. */
  cuentasBorradas: string[];
  /** Si true, la función de borrado responde con error. */
  rpcFalla: boolean;
  /** Si true, toda petición responde 500. */
  caida: boolean;
  /** Ids de usuario que están en la lista de administradoras (tabla administradores). */
  administradoras: Set<string>;
  /** Id de usuario → sus factores de segundo paso. */
  factores: Map<string, FactorFalso[]>;
  /** Id de reto → id del factor al que pertenece. */
  retos: Map<string, string>;
  /** Filas de las tablas del panel, por nombre de tabla. */
  tablas: Map<string, Record<string, unknown>[]>;
}

/** Columna de fecha de cada tabla del panel: la usa el filtro de rango de PostgREST. */
const TABLAS_PANEL_FALSAS = new Set(['compras', 'eventos_app', 'eventos_pago']);

function json(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** JWT con forma real (tres partes base64url) y el claim `aal` indicado. La firma no se comprueba: es un falso. */
export function crearJwt(sub: string, aal: 'aal1' | 'aal2', serie: string): string {
  const cabecera = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const carga = Buffer.from(
    JSON.stringify({ sub, aal, role: 'authenticated', jti: serie }),
  ).toString('base64url');
  return `${cabecera}.${carga}.firma-de-prueba-${serie}`;
}

function aalDelToken(token: string | null): string | null {
  const carga = token?.split('.')[1];
  if (carga === undefined) return null;
  try {
    const datos = JSON.parse(Buffer.from(carga, 'base64url').toString()) as { aal?: unknown };
    return typeof datos.aal === 'string' ? datos.aal : null;
  } catch {
    return null;
  }
}

export function crearSupabaseFalso(): SupabaseFalso {
  const accesos = new Map<string, UsuarioFalso>();
  const renovaciones = new Map<
    string,
    { accessToken: string; refreshToken: string; usuario: UsuarioFalso }
  >();
  const accesosPorCorreo = new Map<string, string[]>();
  const sesiones = new Map<string, Record<string, unknown>[]>();
  const cuentasBorradas: string[] = [];
  const peticiones: PeticionFalsa[] = [];
  const administradoras = new Set<string>();
  const factores = new Map<string, FactorFalso[]>();
  const retos = new Map<string, string>();
  const tablas = new Map<string, Record<string, unknown>[]>();
  let contador = 0;
  const estado: SupabaseFalso = {
    fetch: () => Promise.reject(new Error('no inicializado')),
    peticiones,
    accesos,
    renovaciones,
    accesosPorCorreo,
    sesiones,
    cuentasBorradas,
    rpcFalla: false,
    caida: false,
    administradoras,
    factores,
    retos,
    tablas,
  };

  estado.fetch = async (entrada, init) => {
    // Simula la latencia de red: la respuesta siempre llega de forma asíncrona.
    await Promise.resolve();
    const url = new URL(entrada);
    const cabeceras = new Headers(init?.headers);
    const metodo = (init?.method ?? 'GET').toUpperCase();
    const cuerpo = typeof init?.body === 'string' ? init.body : null;
    const autorizacion = cabeceras.get('authorization');
    const token = autorizacion === null ? null : autorizacion.replace(/^Bearer /, '');
    peticiones.push({
      ruta: `${url.pathname}${url.search}`,
      metodo,
      apikey: cabeceras.get('apikey'),
      autorizacion,
      cuerpo,
      prefer: cabeceras.get('prefer'),
    });

    if (estado.caida) return json(500, { message: 'caída simulada' });
    const usuario = token === null ? undefined : accesos.get(token);
    const nuevaSerie = (): string => {
      contador += 1;
      return String(contador);
    };

    if (url.pathname === '/auth/v1/user') {
      if (!usuario) return json(401, { msg: 'JWT expirado' });
      const lista = (factores.get(usuario.id) ?? []).map((factor) => ({
        id: factor.id,
        friendly_name: factor.friendly_name,
        factor_type: factor.factor_type,
        status: factor.status,
        created_at: factor.created_at,
      }));
      return json(200, {
        id: usuario.id,
        email: usuario.email,
        aud: 'authenticated',
        factors: lista,
      });
    }

    if (url.pathname === '/auth/v1/token') {
      const datos = JSON.parse(cuerpo ?? '{}') as { refresh_token?: string };
      const renovacion = datos.refresh_token ? renovaciones.get(datos.refresh_token) : undefined;
      if (!renovacion) return json(400, { error: 'invalid_grant' });
      accesos.set(renovacion.accessToken, renovacion.usuario);
      return json(200, {
        access_token: renovacion.accessToken,
        refresh_token: renovacion.refreshToken,
        token_type: 'bearer',
        user: { id: renovacion.usuario.id, email: renovacion.usuario.email },
      });
    }

    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });

    // MFA: alta, reto y verificación, como GoTrue.
    if (url.pathname === '/auth/v1/factors' && metodo === 'POST') {
      if (!usuario) return json(401, { msg: 'JWT expirado' });
      const datos = JSON.parse(cuerpo ?? '{}') as { friendly_name?: string; factor_type?: string };
      const serie = nuevaSerie();
      const factor: FactorFalso = {
        id: `00000000-0000-4000-8000-${serie.padStart(12, '0')}`,
        factor_type: 'totp',
        status: 'unverified',
        friendly_name: datos.friendly_name ?? 'Autenticador',
        created_at: '2026-10-24T10:00:00.000Z',
        secreto: `SECRETO${serie}`,
      };
      factores.set(usuario.id, [...(factores.get(usuario.id) ?? []), factor]);
      return json(200, {
        id: factor.id,
        type: 'totp',
        friendly_name: factor.friendly_name,
        totp: {
          qr_code: `<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>`,
          secret: factor.secreto,
          uri: `otpauth://totp/prueba?secret=${factor.secreto}`,
        },
      });
    }

    const coincideFactor = /^\/auth\/v1\/factors\/([^/]+)\/(challenge|verify)$/.exec(url.pathname);
    if (coincideFactor && metodo === 'POST') {
      const [, factorId = '', accion = ''] = coincideFactor;
      const factor = (factores.get(usuario?.id ?? '') ?? []).find((f) => f.id === factorId);
      if (!usuario) return json(401, { msg: 'JWT expirado' });
      if (!factor) return json(404, { msg: 'factor no encontrado' });
      if (accion === 'challenge') {
        const idReto = `10000000-0000-4000-8000-${nuevaSerie().padStart(12, '0')}`;
        retos.set(idReto, factor.id);
        return json(200, { id: idReto, type: 'totp', expires_at: 1_900_000_000 });
      }
      const datos = JSON.parse(cuerpo ?? '{}') as { challenge_id?: string; code?: string };
      if (datos.challenge_id === undefined || retos.get(datos.challenge_id) !== factor.id) {
        return json(400, { code: 'mfa_verification_failed', msg: 'reto no válido' });
      }
      if (datos.code !== CODIGO_PRUEBA) {
        return json(400, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' });
      }
      factor.status = 'verified';
      const serie = nuevaSerie();
      const accessToken = crearJwt(usuario.id, 'aal2', serie);
      const refreshToken = `renovacion-aal2-${serie}`;
      accesos.set(accessToken, usuario);
      renovaciones.set(refreshToken, { accessToken, refreshToken, usuario });
      return json(200, {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: refreshToken,
        user: { id: usuario.id, email: usuario.email },
      });
    }

    if (url.pathname === '/rest/v1/rpc/soy_administrador' && metodo === 'POST') {
      if (!usuario) return json(401, { message: 'JWT expirado' });
      return json(200, administradoras.has(usuario.id));
    }

    if (url.pathname === '/rest/v1/accesos_vigentes') {
      if (!usuario) return json(401, { message: 'JWT expirado' });
      const estados = accesosPorCorreo.get(usuario.email) ?? [];
      return json(
        200,
        estados.map((valor) => ({ estado: valor })),
      );
    }

    // Tablas del panel: RLS simulada. Solo la administradora con aal2 ve filas; el resto recibe una lista vacía.
    const tabla = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)?.[1];
    if (tabla !== undefined && TABLAS_PANEL_FALSAS.has(tabla) && metodo === 'GET') {
      if (!usuario) return json(401, { message: 'JWT expirado' });
      const puede = administradoras.has(usuario.id) && aalDelToken(token) === 'aal2';
      if (!puede) return json(200, []);
      return json(200, consultarTabla(tablas.get(tabla) ?? [], url.searchParams));
    }

    if (url.pathname === '/rest/v1/daily_sessions') {
      if (!usuario) return json(401, { message: 'JWT expirado' });
      if (metodo === 'GET') return json(200, sesiones.get(usuario.id) ?? []);
      if (metodo === 'POST') {
        const filas = JSON.parse(cuerpo ?? '[]') as Record<string, unknown>[];
        // RLS «with check»: una fila de otro usuario se rechaza entera.
        if (filas.some((fila) => fila.user_id !== usuario.id)) {
          return json(403, { message: 'new row violates row-level security policy' });
        }
        const actuales = sesiones.get(usuario.id) ?? [];
        for (const fila of filas) {
          const indice = actuales.findIndex((existente) => existente.date_key === fila.date_key);
          if (indice >= 0) actuales[indice] = fila;
          else actuales.push(fila);
        }
        sesiones.set(usuario.id, actuales);
        return new Response(null, { status: 201 });
      }
      if (metodo === 'DELETE') {
        // RLS: solo se borran las filas del propio usuario. Un filtro de otro usuario no borra nada.
        const filtro = url.searchParams.get('user_id');
        if (filtro === `eq.${usuario.id}`) sesiones.delete(usuario.id);
        return new Response(null, { status: 204 });
      }
    }

    if (url.pathname === '/rest/v1/rpc/borrar_mi_cuenta') {
      if (!usuario) return json(400, { code: '28000', message: 'Necesitas iniciar sesión.' });
      if (estado.rpcFalla) return json(500, { message: 'fallo simulado' });
      cuentasBorradas.push(usuario.id);
      accesos.delete(token ?? '');
      return new Response(null, { status: 204 });
    }

    return json(404, { message: 'no simulado' });
  };

  return estado;
}

/** Aplica a las filas los filtros de PostgREST que usa el panel: columna=gte.X, columna=lt.Y, select y limit. */
function consultarTabla(
  filas: Record<string, unknown>[],
  parametros: URLSearchParams,
): Record<string, unknown>[] {
  let resultado = filas;
  for (const [clave, valor] of parametros.entries()) {
    if (clave === 'select' || clave === 'limit') continue;
    const [operador, ...resto] = valor.split('.');
    const referencia = resto.join('.');
    resultado = resultado.filter((fila) => {
      const valorFila = fila[clave];
      const actual =
        typeof valorFila === 'string' || typeof valorFila === 'number' ? String(valorFila) : '';
      if (operador === 'gte') return actual >= referencia;
      if (operador === 'lt') return actual < referencia;
      return false;
    });
  }
  const columnas = parametros.get('select');
  if (columnas !== null) {
    const lista = columnas.split(',');
    resultado = resultado.map((fila) =>
      Object.fromEntries(
        lista.filter((columna) => columna in fila).map((columna) => [columna, fila[columna]]),
      ),
    );
  }
  const limite = parametros.get('limit');
  return limite === null ? resultado : resultado.slice(0, Number(limite));
}

/** Siembra un usuario con su token de acceso válido, su renovación y sus estados de acceso. */
export function sembrarUsuario(
  estado: SupabaseFalso,
  datos: {
    id: string;
    email: string;
    acceso?: string;
    renovacion?: string;
    accesoNuevo?: string;
    renovacionNueva?: string;
    estados?: string[];
  },
): UsuarioFalso {
  const usuario: UsuarioFalso = { id: datos.id, email: datos.email };
  if (datos.acceso !== undefined) estado.accesos.set(datos.acceso, usuario);
  if (
    datos.renovacion !== undefined &&
    datos.accesoNuevo !== undefined &&
    datos.renovacionNueva !== undefined
  ) {
    estado.renovaciones.set(datos.renovacion, {
      accessToken: datos.accesoNuevo,
      refreshToken: datos.renovacionNueva,
      usuario,
    });
  }
  if (datos.estados !== undefined) estado.accesosPorCorreo.set(datos.email, datos.estados);
  return usuario;
}

export interface OpcionesPeticion {
  metodo?: string;
  /** Valor de la cabecera Cookie completa, por ejemplo `foco_sesion=...`. */
  cookie?: string;
  /** Cuerpo JSON. */
  cuerpo?: unknown;
  /** Cuerpo en texto plano, tal cual (para probar JSON roto o demasiado grande). */
  cuerpoTexto?: string;
  /** Cabecera Origin. Sin ella, la petición se trata como de un cliente que no es un navegador. */
  origen?: string;
}

/** Petición web (Request) para las rutas. Sin cuerpo en GET. */
export function crearPeticion(url: string, opciones: OpcionesPeticion = {}): Request {
  const metodo = opciones.metodo ?? 'GET';
  const cabeceras = new Headers();
  if (opciones.cookie !== undefined) cabeceras.set('Cookie', opciones.cookie);
  if (opciones.origen !== undefined) cabeceras.set('Origin', opciones.origen);
  let cuerpo: string | undefined;
  if (opciones.cuerpoTexto !== undefined) cuerpo = opciones.cuerpoTexto;
  else if (opciones.cuerpo !== undefined) cuerpo = JSON.stringify(opciones.cuerpo);
  if (cuerpo !== undefined) cabeceras.set('Content-Type', 'application/json');
  return new Request(url, {
    method: metodo,
    headers: cabeceras,
    body: metodo === 'GET' ? undefined : cuerpo,
  });
}
