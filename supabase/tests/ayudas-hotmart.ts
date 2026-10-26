// Ayudas compartidas por las pruebas de Hotmart (hotmart-*.test.ts y acceso-*.test.ts). No es una prueba: Vitest solo ejecuta
// los archivos *.test.ts. Contiene un Supabase FALSO en memoria que imita lo que usa la función: PostgREST (filtros eq. y lt.,
// on_conflict, Prefer resolution=ignore-duplicates / merge-duplicates, return=representation / minimal, select=) y la API de
// administración de Auth. Valida columnas, obligatorias y listas cerradas como las migraciones, así que una columna mal
// escrita o un estado fuera de lista falla igual que en la base real. Todos los datos son inventados (dominio .test).
import { ESTADOS_EVENTO, type Ofertas } from '../functions/_shared/hotmart.ts';
import { manejarAviso, type EntornoAviso } from '../functions/hotmart-aviso/handler.ts';
import { NOMBRE_CLAVE_SERVICIO } from '../functions/_shared/rest.ts';

export const URL_PRUEBA = 'https://proyecto-de-prueba.supabase.co';
export const CLAVE_SERVICIO = 'clave-de-servicio-de-prueba-456';
export const TOKEN = 'token-de-prueba-hotmart-123';
export const CORREO = 'comprador@ejemplo.test';
export const OFERTAS_PRUEBA: Ofertas = {
  mensual: 'oferta-mensual-de-prueba',
  anual: 'oferta-anual-de-prueba',
};

/** Medianoche (UTC) del día de las pruebas. Las fechas de los avisos se expresan en minutos desde ella. */
const BASE = Date.UTC(2026, 9, 24, 0, 0, 0);
export const minuto = (n: number): number => BASE + n * 60_000;
/** «Ahora» de las pruebas: las fechas de los avisos son siempre anteriores. */
export const AHORA = minuto(12 * 60);

export type Fila = Record<string, unknown>;
export type Tabla =
  'compras' | 'suscripciones_hotmart' | 'eventos_pago' | 'accesos' | 'compras_finales_previas';

const CLAVE_PRIMARIA: Record<Tabla, string> = {
  compras: 'id_hotmart',
  suscripciones_hotmart: 'suscriptor',
  eventos_pago: 'id_evento',
  accesos: 'correo',
  compras_finales_previas: 'id_hotmart',
};

/** Columnas de cada tabla, según las migraciones. Escribir otra devuelve 400, como PostgREST. */
const COLUMNAS: Record<Tabla, readonly string[]> = {
  compras: [
    'id_hotmart',
    'plan',
    'monto_usd',
    'comision_usd',
    'suscriptor',
    'correo',
    'estado',
    'fecha_aviso',
    'creado_en',
  ],
  suscripciones_hotmart: [
    'suscriptor',
    'plan',
    'estado',
    'motivo',
    'acceso_hasta',
    'ultimo_cobro',
    'fecha_cobro',
    'fecha_aviso',
    'actualizada_en',
  ],
  eventos_pago: ['id_evento', 'tipo', 'estado', 'fecha_aviso', 'recibido_en'],
  accesos: ['correo', 'estado', 'origen', 'cambiado_en', 'fecha_aviso', 'acceso_hasta'],
  compras_finales_previas: ['id_hotmart', 'estado', 'fecha_aviso', 'origen', 'recibido_en'],
};

const OBLIGATORIAS: Record<Tabla, readonly string[]> = {
  compras: ['id_hotmart', 'plan', 'monto_usd', 'correo', 'estado', 'fecha_aviso'],
  suscripciones_hotmart: ['suscriptor', 'estado', 'fecha_aviso'],
  eventos_pago: ['id_evento', 'tipo', 'estado'],
  accesos: ['correo', 'estado', 'origen'],
  compras_finales_previas: ['id_hotmart', 'estado', 'fecha_aviso', 'origen'],
};

const LISTAS: Record<Tabla, Record<string, readonly string[]>> = {
  compras: {
    plan: ['mensual', 'anual'],
    estado: ['aprobada', 'mantenida', 'reembolsada', 'cancelada'],
  },
  suscripciones_hotmart: {
    plan: ['mensual', 'anual'],
    estado: ['activa', 'cancelada'],
    motivo: ['voluntaria', 'impago'],
    ultimo_cobro: ['aprobado', 'impago', 'otro'],
  },
  eventos_pago: { estado: ESTADOS_EVENTO },
  accesos: { estado: ['activo', 'inactivo'] },
  compras_finales_previas: { estado: ['reembolsada', 'cancelada'] },
};

const TABLAS: readonly string[] = Object.keys(CLAVE_PRIMARIA);

export interface Llamada {
  metodo: string;
  ruta: string;
  busqueda: URLSearchParams;
  cabeceras: Record<string, string>;
  cuerpo: Fila;
}

const json = (cuerpo: unknown, status = 200): Response =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

const vacia = (status: number): Response => new Response(null, { status });

const error400 = (mensaje: string): Response => json({ code: '23514', message: mensaje }, 400);

/** Aplica los filtros de la URL (eq. y lt.) a las filas. */
function filtrar(filas: Fila[], busqueda: URLSearchParams): Fila[] {
  const reservados = new Set(['select', 'on_conflict', 'order', 'limit']);
  const filtros = [...busqueda.entries()].filter(([columna]) => !reservados.has(columna));
  return filas.filter((fila) =>
    filtros.every(([columna, expresion]) => {
      const punto = expresion.indexOf('.');
      const operador = expresion.slice(0, punto);
      const valor = expresion.slice(punto + 1);
      const actual = fila[columna];
      if (actual === null || actual === undefined) return false;
      if (operador === 'eq') return String(actual) === valor;
      if (operador === 'in') {
        const lista = valor.replace(/^\(|\)$/g, '').split(',');
        return lista.includes(String(actual));
      }
      if (operador === 'lt') {
        // Las columnas de fecha se comparan como instantes; el resto, como texto.
        const instante = Date.parse(String(actual));
        return Number.isNaN(instante) ? String(actual) < valor : instante < Date.parse(valor);
      }
      throw new Error(`operador de prueba no soportado: ${operador}`);
    }),
  );
}

/** Aplica select=a,b. Sin select, devuelve la fila completa. */
function proyectar(fila: Fila, busqueda: URLSearchParams): Fila {
  const seleccion = busqueda.get('select');
  if (!seleccion || seleccion === '*') return { ...fila };
  return Object.fromEntries(
    seleccion.split(',').map((columna) => [columna, fila[columna] ?? null]),
  );
}

/** Comprueba columnas, obligatorias, listas cerradas y la forma del correo, como las restricciones de las migraciones. */
function validar(tabla: Tabla, cuerpo: Fila, completo: boolean): string | null {
  for (const columna of Object.keys(cuerpo)) {
    if (!COLUMNAS[tabla].includes(columna)) return `columna desconocida: ${columna}`;
  }
  if (completo) {
    for (const columna of OBLIGATORIAS[tabla]) {
      if (cuerpo[columna] === undefined || cuerpo[columna] === null) return `falta ${columna}`;
    }
  }
  for (const [columna, permitidos] of Object.entries(LISTAS[tabla])) {
    const valor = cuerpo[columna];
    if (valor !== undefined && valor !== null && !permitidos.includes(String(valor)))
      return `${columna} fuera de la lista: ${String(valor)}`;
  }
  const correo = cuerpo.correo;
  if (typeof correo === 'string' && correo !== correo.toLowerCase())
    return 'el correo debe ir en minúsculas';
  return null;
}

/** Supabase falso. `fetch` es lo que se inyecta en el handler. */
export function crearSupabaseFalso() {
  const tablas: Record<Tabla, Map<string, Fila>> = {
    compras: new Map(),
    suscripciones_hotmart: new Map(),
    eventos_pago: new Map(),
    accesos: new Map(),
    compras_finales_previas: new Map(),
  };
  const usuarios = new Set<string>();
  const correosRechazados = new Set<string>();
  const llamadas: Llamada[] = [];
  const fallos = new Map<string, number>();

  async function fetchFalso(entrada: string, init?: RequestInit): Promise<Response> {
    const url = new URL(entrada);
    const metodo = init?.method ?? 'GET';
    const cabeceras = { ...(init?.headers as Record<string, string>) };
    const cuerpo = init?.body ? (JSON.parse(String(init.body)) as Fila) : {};
    llamadas.push({ metodo, ruta: url.pathname, busqueda: url.searchParams, cabeceras, cuerpo });

    if (
      cabeceras.apikey !== CLAVE_SERVICIO ||
      cabeceras.Authorization !== `Bearer ${CLAVE_SERVICIO}`
    ) {
      return json({ message: 'clave no válida' }, 401);
    }

    if (url.pathname === '/auth/v1/admin/users') {
      const fallo = fallos.get('POST auth');
      if (fallo !== undefined) return json({ msg: 'error de prueba' }, fallo);
      if (metodo !== 'POST' || cuerpo.email_confirm !== true || typeof cuerpo.email !== 'string') {
        return json({ error_code: 'validation_failed', msg: 'cuerpo no válido' }, 400);
      }
      if (correosRechazados.has(cuerpo.email)) {
        return json(
          { code: 422, error_code: 'email_address_invalid', msg: 'Email address is invalid' },
          422,
        );
      }
      if (usuarios.has(cuerpo.email)) {
        return json(
          {
            code: 422,
            error_code: 'email_exists',
            msg: 'A user with this email address has already been registered',
          },
          422,
        );
      }
      usuarios.add(cuerpo.email);
      return json({ id: 'id-de-prueba', email: cuerpo.email }, 200);
    }

    const coincidencia = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname);
    const nombre = coincidencia?.[1];
    if (!nombre || !TABLAS.includes(nombre))
      return new Response('ruta inesperada', { status: 599 });
    const tabla = nombre as Tabla;
    const fallo = fallos.get(`${metodo} ${tabla}`);
    if (fallo !== undefined) return json({ message: 'error de prueba' }, fallo);

    const prefer = (cabeceras.Prefer ?? '').split(',').map((parte) => parte.trim());
    const representacion = prefer.includes('return=representation');
    const filas = tablas[tabla];
    const clave = CLAVE_PRIMARIA[tabla];

    if (metodo === 'GET') {
      return json(
        filtrar([...filas.values()], url.searchParams).map((fila) =>
          proyectar(fila, url.searchParams),
        ),
      );
    }

    if (metodo === 'POST') {
      if (url.searchParams.get('on_conflict') !== clave)
        return error400('on_conflict debe ser la clave primaria');
      const problema = validar(tabla, cuerpo, true);
      if (problema) return error400(problema);
      const id = String(cuerpo[clave]);
      const existente = filas.get(id);
      let escritas: Fila[] = [];
      if (existente === undefined) {
        const nueva: Fila = { ...cuerpo };
        filas.set(id, nueva);
        escritas = [nueva];
      } else if (prefer.includes('resolution=merge-duplicates')) {
        Object.assign(existente, cuerpo);
        escritas = [existente];
      } else if (!prefer.includes('resolution=ignore-duplicates')) {
        return json({ code: '23505', message: 'clave duplicada' }, 409);
      }
      return representacion
        ? json(
            escritas.map((fila) => proyectar(fila, url.searchParams)),
            201,
          )
        : vacia(201);
    }

    if (metodo === 'PATCH') {
      const problema = validar(tabla, cuerpo, false);
      if (problema) return error400(problema);
      const coinciden = filtrar([...filas.values()], url.searchParams);
      for (const fila of coinciden) Object.assign(fila, cuerpo);
      return representacion
        ? json(
            coinciden.map((fila) => proyectar(fila, url.searchParams)),
            200,
          )
        : vacia(204);
    }

    return new Response('método inesperado', { status: 599 });
  }

  return {
    fetch: fetchFalso,
    tablas,
    usuarios,
    llamadas,
    /** Filas de una tabla como lista. */
    filas: (tabla: Tabla): Fila[] => [...tablas[tabla].values()],
    /** Hace fallar con `status` las llamadas de un método a una tabla (o 'POST auth' para la creación de usuarios). */
    fallar(clave: string, status = 500): void {
      fallos.set(clave, status);
    },
    /** Quita todos los fallos provocados: la base vuelve a responder bien (para probar el reintento de Hotmart). */
    repararFallos(): void {
      fallos.clear();
    },
    /** Auth rechazará este correo con un 422 que NO es «ya existe». */
    rechazarCorreo(correo: string): void {
      correosRechazados.add(correo);
    },
    /** Escrituras (POST, PATCH) hechas, de cualquier tabla o de Auth. */
    escrituras: (): Llamada[] => llamadas.filter((llamada) => llamada.metodo !== 'GET'),
    /** Escrituras a una tabla de la base (no cuenta Auth). */
    escriturasA: (tabla: Tabla): Llamada[] =>
      llamadas.filter(
        (llamada) => llamada.metodo !== 'GET' && llamada.ruta === `/rest/v1/${tabla}`,
      ),
  };
}

export type SupabaseFalso = ReturnType<typeof crearSupabaseFalso>;

export const entornoCompleto = (): EntornoAviso => ({
  HOTMART_HOTTOK: TOKEN,
  SUPABASE_URL: URL_PRUEBA,
  [NOMBRE_CLAVE_SERVICIO]: CLAVE_SERVICIO,
});

export interface OpcionesEnvio {
  metodo?: string;
  cabeceras?: Record<string, string>;
  env?: EntornoAviso;
  /** Texto crudo del cuerpo, en lugar de serializar `cuerpo` (para JSON roto). */
  texto?: string;
}

/** Un banco de pruebas: Supabase falso y una función `enviar` que manda un aviso al handler. */
export function crearBanco() {
  const falso = crearSupabaseFalso();
  async function enviar(cuerpo: unknown, opciones: OpcionesEnvio = {}): Promise<Response> {
    const {
      metodo = 'POST',
      cabeceras = { 'x-hotmart-hottok': TOKEN },
      env = entornoCompleto(),
      texto,
    } = opciones;
    const peticion = new Request('https://funcion.ejemplo.test/hotmart-aviso', {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...cabeceras },
      body: metodo === 'GET' || metodo === 'HEAD' ? undefined : (texto ?? JSON.stringify(cuerpo)),
    });
    return manejarAviso(peticion, {
      env,
      fetch: falso.fetch,
      ahora: () => AHORA,
      ofertas: OFERTAS_PRUEBA,
    });
  }
  return { falso, enviar };
}

// --- Avisos de ejemplo (formas inventadas con los campos que lee _shared/hotmart.ts) ---------------------------------------

interface OpcionesCompra {
  transaccion?: string;
  id?: string;
  /** Minutos desde la medianoche del día de las pruebas. */
  minutos?: number;
  suscriptor?: string;
  /** null = el aviso no trae correo. */
  correo?: string | null;
  oferta?: string;
  monto?: number;
  divisa?: string;
}

/** Compra aprobada con su comprador y su fecha de creación (creation_date, en milisegundos). */
export function compraAprobada({
  transaccion = 'TRX-DE-PRUEBA-1',
  id = `aviso-${transaccion}-aprobada`,
  minutos = 60,
  suscriptor,
  correo = CORREO,
  oferta = OFERTAS_PRUEBA.mensual,
  monto = 5.99,
  divisa = 'USD',
}: OpcionesCompra = {}) {
  return {
    id,
    creation_date: minuto(minutos),
    event: 'PURCHASE_APPROVED',
    data: {
      purchase: {
        transaction: transaccion,
        offer: { code: oferta },
        price: { value: monto, currency_code: divisa },
      },
      commissions: [{ value: 0.3, currency_code: 'USD', commission_as: 'PRODUCER' }],
      ...(correo !== null ? { buyer: { email: correo } } : {}),
      ...(suscriptor ? { subscription: { subscriber: { code: suscriptor } } } : {}),
    },
  };
}

export const reembolso = (
  transaccion = 'TRX-DE-PRUEBA-1',
  minutos = 120,
  id = `aviso-${transaccion}-reembolso-${minutos}`,
) => ({
  id,
  creation_date: minuto(minutos),
  event: 'PURCHASE_REFUNDED',
  data: { purchase: { transaction: transaccion } },
});

export const cancelacionDeCompra = (
  transaccion = 'TRX-DE-PRUEBA-1',
  minutos = 120,
  id = `aviso-${transaccion}-cancelada-${minutos}`,
) => ({
  id,
  creation_date: minuto(minutos),
  event: 'PURCHASE_CANCELED',
  data: { purchase: { transaction: transaccion } },
});

export const cancelacionDeSuscripcion = (
  suscriptor: string | null,
  minutos = 120,
  id = `aviso-${suscriptor ?? 'sin'}-cancelacion-${minutos}`,
) => ({
  id,
  creation_date: minuto(minutos),
  event: 'SUBSCRIPTION_CANCELLATION',
  data: suscriptor ? { subscription: { subscriber: { code: suscriptor } } } : {},
});
