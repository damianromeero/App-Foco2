/**
 * Avisos de compra de Hotmart (función de Supabase, solo servidor). Esta es la parte testable: no usa API de Deno. Recibe
 * `env` y `fetch` inyectados; index.ts los conecta con Deno.env y el fetch real. Escribe con la CLAVE DE SERVICIO, que salta
 * RLS, por eso el token se comprueba ANTES de leer el cuerpo o escribir nada. Nada más en la app usa esa clave.
 *
 * Orden de respuestas:
 *  405  no es POST.
 *  503  falta HOTMART_HOTTOK, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. Es un error de configuración, no del aviso.
 *  401  falta la cabecera x-hotmart-hottok o no coincide. No se lee el cuerpo ni se guarda nada.
 *  413  el aviso pesa más de 200 KB.
 *  400  el cuerpo no es JSON.
 *  400  aviso-sin-id: falta `id`. No hay clave de idempotencia: no se guarda nada.
 *  400  aviso-sin-fecha: falta creation_date o no es válida. Se registra en eventos_pago como sin-fecha y NO cambia
 *       compras, suscripciones ni accesos.
 *  500  la base no guardó. Hotmart reintentará; todo se puede repetir sin efecto doble.
 *  200  guardado, incluidos los avisos no reconocidos (tipo o estado desconocido: se guardan como no-procesado).
 *
 * Reglas (REGLAS-HOTMART.md):
 *  - Cada escritura de estado va en UNA sentencia de base con la condición de fecha: PATCH con fecha_aviso=lt.<fecha>, o
 *    INSERT con on_conflict ignore-duplicates y, si ya existía, el PATCH condicionado. Nunca se lee un estado para luego
 *    escribirlo. Un aviso con fecha igual o anterior no cambia nada, y un aviso repetido (mismo id) tampoco.
 *  - El acceso de un correo se calcula desde su compras y suscripciones (acceso.ts) y se escribe con la guarda de fecha.
 *    Lo único que se lee antes de escribir es ese cálculo derivado.
 *  - La cuenta de Auth del comprador nace con su primera compra aprobada. Ningún aviso borra cuentas, compras ni datos.
 *  - Ningún correo ni token en respuestas o registros. El correo vive en compras y accesos, nunca en eventos_pago.
 */
import {
  calcularAcceso,
  type CompraDeAcceso,
  type SuscripcionDeAcceso,
  type UltimoCobroAcceso,
} from '../_shared/acceso.ts';
import {
  analizarAviso,
  CABECERA_TOKEN_HOTMART,
  tokenDelAviso,
  tokenHotmartValido,
  type Clasificado,
  type EstadoEvento,
  type Ofertas,
  type PlanCompra,
  type UltimoCobro,
} from '../_shared/hotmart.ts';
import {
  crearRest,
  crearUsuarioAuth,
  ErrorAviso,
  type ConfigSupabase,
  type Fetch,
  type OpcionesRest,
  type Rest,
  type RespuestaRest,
} from '../_shared/rest.ts';

const TAMANO_MAXIMO = 200_000;

/** Variables del servidor. En Supabase, las dos últimas las inyecta la propia función; HOTMART_HOTTOK es un secreto tuyo. */
export interface EntornoAviso {
  HOTMART_HOTTOK?: string | undefined;
  SUPABASE_URL?: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
}

export interface DependenciasAviso {
  env: EntornoAviso;
  fetch: Fetch;
  /** Reloj en milisegundos. Por defecto Date.now. Las pruebas lo fijan. */
  ahora?: () => number;
  /** Ofertas de Hotmart. Por defecto OFERTAS_HOTMART (_shared/hotmart.ts). Las pruebas pasan unas inventadas. */
  ofertas?: Ofertas;
}

function responder(
  status: number,
  cuerpo: Record<string, unknown>,
  cabeceras: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cabeceras },
  });
}

const fallo = (
  status: number,
  error: string,
  mensaje: string,
  cabeceras: Record<string, string> = {},
): Response => responder(status, { ok: false, error, mensaje }, cabeceras);

const codificar = (valor: string): string => encodeURIComponent(valor);

/** Valores distintos de una lista, sin nulos ni vacíos. */
function distintos(valores: readonly (string | null | undefined)[]): string[] {
  return [...new Set(valores.filter((v): v is string => typeof v === 'string' && v !== ''))];
}

interface Contexto {
  rest: Rest;
  config: ConfigSupabase;
  /** Momento del guardado, en ISO. */
  ahoraIso: string;
  /** Momento del guardado, en milisegundos (para saber si un acceso con fin ya venció). */
  ahoraMs: number;
}

/** Hace una petición a PostgREST y lanza ErrorAviso (sin datos personales) si la base no la acepta. */
async function pedir<T = unknown>(
  rest: Rest,
  ruta: string,
  opciones: OpcionesRest,
  codigo: string,
): Promise<RespuestaRest<T>> {
  const respuesta = await rest<T>(ruta, opciones);
  if (!respuesta.ok) throw new ErrorAviso(`${codigo}-${respuesta.status}`);
  return respuesta;
}

/** Lee una lista de filas. Lanza si la lectura falla o la respuesta no es una lista. */
async function leerFilas<T>(rest: Rest, ruta: string, codigo: string): Promise<T[]> {
  const respuesta = await rest<T[]>(ruta);
  if (!respuesta.ok || !Array.isArray(respuesta.datos))
    throw new ErrorAviso(`${codigo}-${respuesta.status}`);
  return respuesta.datos;
}

/** Filas devueltas por una escritura con return=representation. */
function filasEscritas<T>(respuesta: RespuestaRest<T[]>, codigo: string): T[] {
  if (!Array.isArray(respuesta.datos)) throw new ErrorAviso(`${codigo}-${respuesta.status}`);
  return respuesta.datos;
}

/** Registra el aviso en eventos_pago. Idempotente: el mismo identificador no crea otra fila. Nunca lleva correo. */
async function registrarEvento(
  contexto: Contexto,
  aviso: Clasificado,
  estado: EstadoEvento,
): Promise<void> {
  // Un aviso sin fecha usa otro identificador: si Hotmart lo reenvía ya con fecha, el reenvío no queda tapado por este registro.
  const sinFecha = aviso.resultado === 'sin-fecha';
  await pedir(
    contexto.rest,
    '/eventos_pago?on_conflict=id_evento',
    {
      metodo: 'POST',
      cuerpo: {
        id_evento: sinFecha ? `sin-fecha-${aviso.id}`.slice(0, 120) : aviso.id,
        tipo: aviso.evento,
        estado,
        fecha_aviso: sinFecha ? null : fechaDeAviso(aviso),
      },
      prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    'evento-no-guardado',
  );
}

/** Fecha del aviso en ISO, para los avisos que la tienen. */
function fechaDeAviso(aviso: Clasificado): string | null {
  return 'fecha' in aviso ? aviso.fecha : null;
}

/**
 * Último cobro y reactivación de una suscripción. Crea la fila si no existe (con la fecha del aviso). Después:
 *  - el último cobro solo cambia si el aviso es más reciente que el guardado (fecha_cobro);
 *  - un cobro APROBADO posterior a la última cancelación (fecha_aviso) reactiva la suscripción y quita la
 *    fecha de fin. Una cancelación más reciente que el cobro no se toca.
 * Cada escritura es una sentencia con su condición de fecha; se repiten sin efecto doble.
 */
async function registrarCobro(
  { rest, ahoraIso }: Contexto,
  suscriptor: string,
  plan: PlanCompra | null,
  fecha: string,
  ultimo: UltimoCobro,
): Promise<void> {
  const alta = await pedir<{ suscriptor: string }[]>(
    rest,
    '/suscripciones_hotmart?on_conflict=suscriptor&select=suscriptor',
    {
      metodo: 'POST',
      cuerpo: {
        suscriptor,
        ...(plan !== null ? { plan } : {}),
        estado: 'activa',
        fecha_aviso: fecha,
        fecha_cobro: fecha,
        ultimo_cobro: ultimo,
        actualizada_en: ahoraIso,
      },
      prefer: 'resolution=ignore-duplicates,return=representation',
    },
    'suscripcion-no-guardada',
  );
  if (filasEscritas(alta, 'suscripcion-no-guardada').length > 0) return;

  await pedir(
    rest,
    `/suscripciones_hotmart?suscriptor=eq.${codificar(suscriptor)}&fecha_cobro=lt.${codificar(fecha)}`,
    {
      metodo: 'PATCH',
      cuerpo: { ultimo_cobro: ultimo, fecha_cobro: fecha, actualizada_en: ahoraIso },
      prefer: 'return=minimal',
    },
    'suscripcion-no-guardada',
  );
  if (ultimo !== 'aprobado') return;
  await pedir(
    rest,
    `/suscripciones_hotmart?suscriptor=eq.${codificar(suscriptor)}&fecha_aviso=lt.${codificar(fecha)}`,
    {
      metodo: 'PATCH',
      cuerpo: {
        estado: 'activa',
        acceso_hasta: null,
        fecha_aviso: fecha,
        actualizada_en: ahoraIso,
      },
      prefer: 'return=minimal',
    },
    'suscripcion-no-guardada',
  );
}

/**
 * Recalcula el acceso de un correo desde sus compras y sus suscripciones (acceso.ts) y lo escribe con la guarda de fecha:
 * solo cambia la fila si el aviso que lo provoca (`fecha`) es MÁS RECIENTE que el que fijó el estado guardado. Sin fila
 * y sin acceso no se crea nada. Lo leído (compras y suscripciones) es el cálculo derivado; la escritura es una sentencia
 * condicionada y se repite sin efecto doble. Un reintento completa lo que faltó.
 */
async function recalcularAcceso(
  contexto: Contexto,
  correo: string,
  origen: string,
  fecha: string,
): Promise<void> {
  const { rest, ahoraIso } = contexto;
  const compras = await leerFilas<CompraDeAcceso>(
    rest,
    `/compras?correo=eq.${codificar(correo)}&select=estado,suscriptor`,
    'compras-no-leidas',
  );
  const suscriptores = distintos(compras.map((compra) => compra.suscriptor));
  const suscripciones = new Map<string, SuscripcionDeAcceso>();
  for (const suscriptor of suscriptores) {
    // El motivo de una cancelación no se guarda: se deriva de ultimo_cobro de la misma fila (calcularAcceso).
    const filas = await leerFilas<{
      estado: 'activa' | 'cancelada';
      ultimo_cobro: UltimoCobroAcceso;
      acceso_hasta: string | null;
    }>(
      rest,
      `/suscripciones_hotmart?suscriptor=eq.${codificar(suscriptor)}&select=estado,ultimo_cobro,acceso_hasta`,
      'suscripcion-no-leida',
    );
    const fila = filas[0];
    if (fila !== undefined) {
      suscripciones.set(suscriptor, {
        estado: fila.estado,
        ultimoCobro: fila.ultimo_cobro,
        accesoHasta: fila.acceso_hasta,
      });
    }
  }

  const calculo = calcularAcceso(compras, suscripciones);
  // Un acceso con fin (cancelación voluntaria) que ya venció queda inactivo también en la fila; la vista lo oculta igual.
  const vigente =
    calculo.estado === 'activo' &&
    (calculo.accesoHasta === null || Date.parse(calculo.accesoHasta) > contexto.ahoraMs);
  const cuerpo = {
    estado: vigente ? 'activo' : 'inactivo',
    acceso_hasta: calculo.accesoHasta,
    origen,
    cambiado_en: ahoraIso,
    fecha_aviso: fecha,
  };
  // 1. Fila existente: solo si el aviso es más reciente que el que fijó su estado.
  const cambio = await pedir<{ correo: string }[]>(
    rest,
    `/accesos?correo=eq.${codificar(correo)}&fecha_aviso=lt.${codificar(fecha)}&select=correo`,
    { metodo: 'PATCH', cuerpo, prefer: 'return=representation' },
    'acceso-no-guardado',
  );
  if (filasEscritas(cambio, 'acceso-no-guardado').length > 0) return;
  // Sin acceso y sin fila no hay nada que quitar ni dar: no se crean filas para correos sin acceso.
  if (!vigente) return;
  // 2. Sin fila: la alta, con ignore-duplicates por si otro aviso la acaba de crear.
  const alta = await pedir<{ correo: string }[]>(
    rest,
    '/accesos?on_conflict=correo&select=correo',
    {
      metodo: 'POST',
      cuerpo: { correo, ...cuerpo },
      prefer: 'resolution=ignore-duplicates,return=representation',
    },
    'acceso-no-guardado',
  );
  if (filasEscritas(alta, 'acceso-no-guardado').length > 0) return;
  // 3. La fila apareció a la vez: se aplica la misma guarda de fecha.
  await pedir(
    rest,
    `/accesos?correo=eq.${codificar(correo)}&fecha_aviso=lt.${codificar(fecha)}`,
    { metodo: 'PATCH', cuerpo, prefer: 'return=minimal' },
    'acceso-no-guardado',
  );
}

/**
 * Guarda el reembolso o la cancelación de una compra que todavía no existe, para aplicarlos cuando llegue la compra. Solo
 * cambia con un aviso MÁS RECIENTE que el guardado: primero la escritura condicionada, después el alta y, si otro aviso
 * la creó a la vez, la condicionada otra vez. Devuelve false si lo guardado es igual o más reciente.
 */
async function guardarFinalPrevio(
  { rest }: Contexto,
  idTransaccion: string,
  estado: 'reembolsada' | 'cancelada',
  fecha: string,
  origen: string,
): Promise<boolean> {
  const condicion = `id_hotmart=eq.${codificar(idTransaccion)}&fecha_aviso=lt.${codificar(fecha)}`;
  const datos = { estado, fecha_aviso: fecha, origen };
  const cambiar = () =>
    pedir<{ id_hotmart: string }[]>(
      rest,
      `/compras_finales_previas?${condicion}&select=id_hotmart`,
      { metodo: 'PATCH', cuerpo: datos, prefer: 'return=representation' },
      'final-previo-no-guardado',
    );
  if (filasEscritas(await cambiar(), 'final-previo-no-guardado').length > 0) return true;
  const alta = await pedir<{ id_hotmart: string }[]>(
    rest,
    '/compras_finales_previas?on_conflict=id_hotmart&select=id_hotmart',
    {
      metodo: 'POST',
      cuerpo: { id_hotmart: idTransaccion, ...datos },
      prefer: 'resolution=ignore-duplicates,return=representation',
    },
    'final-previo-no-guardado',
  );
  if (filasEscritas(alta, 'final-previo-no-guardado').length > 0) return true;
  return filasEscritas(await cambiar(), 'final-previo-no-guardado').length > 0;
}

/**
 * Si un reembolso o una cancelación de esta compra llegó antes que ella, la compra nace con ese estado final. Solo cambia
 * una compra todavía aprobada: un estado final nunca se vuelve a pisar.
 */
async function aplicarFinalPrevio({ rest }: Contexto, idTransaccion: string): Promise<void> {
  const previos = await leerFilas<{ estado: 'reembolsada' | 'cancelada'; fecha_aviso: string }>(
    rest,
    `/compras_finales_previas?id_hotmart=eq.${codificar(idTransaccion)}&select=estado,fecha_aviso`,
    'final-previo-no-leido',
  );
  const previo = previos[0];
  if (previo === undefined) return;
  await pedir(
    rest,
    `/compras?id_hotmart=eq.${codificar(idTransaccion)}&estado=eq.aprobada`,
    {
      metodo: 'PATCH',
      cuerpo: { estado: previo.estado, fecha_aviso: previo.fecha_aviso },
      prefer: 'return=minimal',
    },
    'estado-no-guardado',
  );
}

/** Aplica una compra aprobada (alta, o reactivación de una compra mantenida) y su cobro de suscripción. */
async function aplicarCompraAprobada(
  contexto: Contexto,
  aviso: Extract<Clasificado, { resultado: 'compra-aprobada' }>,
): Promise<EstadoEvento> {
  const { rest, config } = contexto;
  const { compra } = aviso;
  // La cuenta nace con la primera compra. Si ya existía, Auth responde conflicto y se da por buena.
  await crearUsuarioAuth(config, compra.correo);
  // Alta. Un aviso repetido no crea otra compra, y una compra con estado final nunca vuelve a «aprobada».
  const insercion = await pedir<{ id_hotmart: string }[]>(
    rest,
    '/compras?on_conflict=id_hotmart&select=id_hotmart',
    {
      metodo: 'POST',
      cuerpo: {
        id_hotmart: compra.idTransaccion,
        plan: compra.plan,
        monto_usd: compra.montoUsd,
        ...(compra.comisionUsd !== undefined ? { comision_usd: compra.comisionUsd } : {}),
        ...(compra.suscriptor !== undefined ? { suscriptor: compra.suscriptor } : {}),
        correo: compra.correo,
        estado: 'aprobada',
        fecha_aviso: aviso.fecha,
      },
      prefer: 'resolution=ignore-duplicates,return=representation',
    },
    'compra-no-guardada',
  );
  const nueva = filasEscritas(insercion, 'compra-no-guardada').length > 0;
  // Reactivación: una compra mantenida (Hotmart reintentaba el cobro) pasa a aprobada solo con un aviso más reciente.
  const reactivada =
    filasEscritas(
      await pedir<{ id_hotmart: string }[]>(
        rest,
        `/compras?id_hotmart=eq.${codificar(compra.idTransaccion)}&fecha_aviso=lt.${codificar(aviso.fecha)}&estado=in.(aprobada,mantenida)&select=id_hotmart`,
        {
          metodo: 'PATCH',
          cuerpo: { estado: 'aprobada', fecha_aviso: aviso.fecha },
          prefer: 'return=representation',
        },
        'estado-no-guardado',
      ),
      'estado-no-guardado',
    ).length > 0;
  // Un reembolso o una cancelación que llegó ANTES que esta compra manda: la compra nace con ese estado final.
  await aplicarFinalPrevio(contexto, compra.idTransaccion);
  if (compra.suscriptor !== undefined)
    await registrarCobro(contexto, compra.suscriptor, compra.plan, aviso.fecha, 'aprobado');
  await recalcularAcceso(contexto, compra.correo, aviso.evento, aviso.fecha);
  return nueva || reactivada ? 'aplicado' : 'duplicado';
}

/**
 * Mantenida, reembolsada o cancelada de una compra. Solo cambia una compra existente con un aviso más reciente. Una
 * mantenida no pisa un estado final. Si la compra no existe: un estado final se guarda para la compra que llegue; una
 * mantenida solo queda como sin-compra (la compra llegará aprobada y un aviso posterior la corrige) [VERIFICAR].
 */
async function aplicarCompraEstado(
  contexto: Contexto,
  aviso: Extract<Clasificado, { resultado: 'compra-estado' }>,
): Promise<EstadoEvento> {
  const { rest } = contexto;
  const final = aviso.estado !== 'mantenida';
  const restriccion = final ? '' : '&estado=in.(aprobada,mantenida)';
  const cambio = await pedir<{ correo: string | null; suscriptor: string | null }[]>(
    rest,
    `/compras?id_hotmart=eq.${codificar(aviso.idTransaccion)}&fecha_aviso=lt.${codificar(aviso.fecha)}${restriccion}&select=correo,suscriptor`,
    {
      metodo: 'PATCH',
      cuerpo: { estado: aviso.estado, fecha_aviso: aviso.fecha },
      prefer: 'return=representation',
    },
    'estado-no-guardado',
  );
  const cambiadas = filasEscritas(cambio, 'estado-no-guardado');
  if (cambiadas.length > 0) {
    await cobrosDe(contexto, aviso, cambiadas);
    return 'aplicado';
  }
  // Nada cambió: o la compra no existe, o el aviso es más antiguo (o igual) que lo guardado.
  const existentes = await leerFilas<{ correo: string | null }>(
    rest,
    `/compras?id_hotmart=eq.${codificar(aviso.idTransaccion)}&select=correo`,
    'compras-no-leidas',
  );
  if (existentes.length > 0) {
    for (const correo of distintos(existentes.map((fila) => fila.correo)))
      await recalcularAcceso(contexto, correo, aviso.evento, aviso.fecha);
    return 'obsoleto';
  }
  if (aviso.estado === 'mantenida') return 'sin-compra';
  // La compra todavía no llegó: el estado final se guarda y se aplica cuando llegue la compra (aplicarFinalPrevio).
  const guardado = await guardarFinalPrevio(
    contexto,
    aviso.idTransaccion,
    aviso.estado,
    aviso.fecha,
    aviso.evento,
  );
  // Si la compra llegó mientras tanto (otro aviso a la vez), el estado final se aplica ya: el resultado no depende del
  // orden de los dos avisos.
  const tardias = filasEscritas(
    await pedir<{ correo: string | null; suscriptor: string | null }[]>(
      rest,
      `/compras?id_hotmart=eq.${codificar(aviso.idTransaccion)}&estado=eq.aprobada&select=correo,suscriptor`,
      {
        metodo: 'PATCH',
        cuerpo: { estado: aviso.estado, fecha_aviso: aviso.fecha },
        prefer: 'return=representation',
      },
      'estado-no-guardado',
    ),
    'estado-no-guardado',
  );
  if (tardias.length > 0) {
    await cobrosDe(contexto, aviso, tardias);
    return 'aplicado';
  }
  // Guardado: queda para la compra que llegue («sin-compra»). No guardado: el aviso era más antiguo que lo guardado.
  return guardado ? 'sin-compra' : 'obsoleto';
}

/** Tras cambiar compras: último cobro de su suscripción y acceso de cada correo. */
async function cobrosDe(
  contexto: Contexto,
  aviso: Extract<Clasificado, { resultado: 'compra-estado' }>,
  filas: readonly { correo: string | null; suscriptor: string | null }[],
): Promise<void> {
  for (const suscriptor of distintos([aviso.suscriptor, ...filas.map((f) => f.suscriptor)])) {
    await registrarCobro(contexto, suscriptor, null, aviso.fecha, aviso.ultimoCobro);
  }
  for (const correo of distintos(filas.map((fila) => fila.correo)))
    await recalcularAcceso(contexto, correo, aviso.evento, aviso.fecha);
}

/**
 * Cancelación de la suscripción: UNA escritura condicionada por fecha_aviso, con acceso_hasta (date_next_charge, o la fecha
 * del aviso si falta) y sin motivo. El motivo se deriva después de ultimo_cobro de la misma fila (calcularAcceso): impago
 * no da acceso; cualquier otro último cobro, voluntaria, con acceso hasta acceso_hasta [VERIFICAR: sin información = voluntaria].
 */
async function aplicarCancelacion(
  contexto: Contexto,
  aviso: Extract<Clasificado, { resultado: 'cancelacion-suscripcion' }>,
  suscriptor: string,
): Promise<EstadoEvento> {
  const { rest, ahoraIso } = contexto;
  // Una sola escritura condicionada por fecha_aviso. Sin motivo: el motivo sale de ultimo_cobro al recalcular el acceso.
  // [VERIFICAR: si Hotmart no trae date_next_charge, el acceso termina con la propia cancelación, sin dejarlo abierto.]
  const cuerpo = {
    estado: 'cancelada',
    acceso_hasta: aviso.fechaProximoCobro ?? aviso.fecha,
    fecha_aviso: aviso.fecha,
    actualizada_en: ahoraIso,
  };
  const cambio = await pedir<{ suscriptor: string }[]>(
    rest,
    `/suscripciones_hotmart?suscriptor=eq.${codificar(suscriptor)}&fecha_aviso=lt.${codificar(aviso.fecha)}&select=suscriptor`,
    { metodo: 'PATCH', cuerpo, prefer: 'return=representation' },
    'cancelacion-no-guardada',
  );
  let cancelada = filasEscritas(cambio, 'cancelacion-no-guardada').length > 0;
  if (!cancelada) {
    // Sin fila (la cancelación llega antes que el primer cobro): se crea con la cancelación como estado.
    const alta = await pedir<{ suscriptor: string }[]>(
      rest,
      '/suscripciones_hotmart?on_conflict=suscriptor&select=suscriptor',
      {
        metodo: 'POST',
        cuerpo: { suscriptor, ...cuerpo },
        prefer: 'resolution=ignore-duplicates,return=representation',
      },
      'cancelacion-no-guardada',
    );
    cancelada = filasEscritas(alta, 'cancelacion-no-guardada').length > 0;
    if (!cancelada) {
      // La fila apareció a la vez: se aplica la misma condición de fecha.
      cancelada =
        filasEscritas(
          await pedir<{ suscriptor: string }[]>(
            rest,
            `/suscripciones_hotmart?suscriptor=eq.${codificar(suscriptor)}&fecha_aviso=lt.${codificar(aviso.fecha)}&select=suscriptor`,
            { metodo: 'PATCH', cuerpo, prefer: 'return=representation' },
            'cancelacion-no-guardada',
          ),
          'cancelacion-no-guardada',
        ).length > 0;
    }
  }
  // Las compras de esa suscripción cambian de acceso (o no, si el aviso era antiguo): se recalcula cada correo.
  const compras = await leerFilas<{ correo: string | null }>(
    rest,
    `/compras?suscriptor=eq.${codificar(suscriptor)}&select=correo`,
    'compras-no-leidas',
  );
  for (const correo of distintos(compras.map((fila) => fila.correo)))
    await recalcularAcceso(contexto, correo, aviso.evento, aviso.fecha);
  return cancelada ? 'aplicado' : 'obsoleto';
}

/**
 * Aplica un aviso con fecha válida y devuelve el estado con el que queda registrado. Lanza ErrorAviso si la base o Auth
 * no aceptan un paso: el handler responde 500. Cada paso es idempotente, así que un reintento completa lo que faltó.
 */
async function aplicarAviso(
  contexto: Contexto,
  aviso: Exclude<Clasificado, { resultado: 'sin-id' | 'sin-fecha' }>,
): Promise<EstadoEvento> {
  switch (aviso.resultado) {
    case 'compra-aprobada':
      return aplicarCompraAprobada(contexto, aviso);
    case 'compra-estado':
      return aplicarCompraEstado(contexto, aviso);
    case 'cancelacion-suscripcion':
      if (aviso.suscriptor === null) return 'sin-suscripcion';
      return aplicarCancelacion(contexto, aviso, aviso.suscriptor);
    default:
      // Sin efecto en compras, suscripciones ni accesos: el aviso solo queda registrado con su propio resultado.
      return aviso.resultado;
  }
}

/** Atiende un aviso de Hotmart. Ver la cabecera de este archivo para el orden de respuestas. */
export async function manejarAviso(
  peticion: Request,
  dependencias: DependenciasAviso,
): Promise<Response> {
  if (peticion.method !== 'POST') {
    return fallo(405, 'metodo-no-permitido', 'Este punto de entrada solo recibe avisos por POST.', {
      Allow: 'POST',
    });
  }

  const esperado = dependencias.env.HOTMART_HOTTOK?.trim() ?? '';
  const url = dependencias.env.SUPABASE_URL?.trim() ?? '';
  const clave = dependencias.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!esperado || !url || !clave) {
    return fallo(
      503,
      'sin-configuracion',
      'El cobro con Hotmart no está configurado en el servidor (HOTMART_HOTTOK, SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  // El token va en la cabecera. Sin él, o incorrecto, no se lee el cuerpo ni se guarda nada.
  const token = tokenDelAviso(peticion.headers.get(CABECERA_TOKEN_HOTMART));
  if (!(await tokenHotmartValido(token, esperado))) {
    return fallo(401, 'token-no-valido', 'El token del aviso no es válido.');
  }

  if (Number(peticion.headers.get('content-length') ?? 0) > TAMANO_MAXIMO) {
    return fallo(413, 'aviso-demasiado-grande', 'El aviso es demasiado grande.');
  }
  let texto: string;
  try {
    texto = await peticion.text();
  } catch {
    texto = '';
  }
  if (texto.length > TAMANO_MAXIMO)
    return fallo(413, 'aviso-demasiado-grande', 'El aviso es demasiado grande.');

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return fallo(400, 'cuerpo-no-json', 'El cuerpo del aviso no es un JSON válido.');
  }

  const ahoraMs = (dependencias.ahora ?? Date.now)();
  const aviso = analizarAviso(cuerpo, { ahoraMs, ofertas: dependencias.ofertas });
  if (aviso.resultado === 'sin-id') {
    // Sin identificador no hay clave de idempotencia: no se guarda nada.
    return fallo(
      400,
      'aviso-sin-id',
      'El aviso no trae identificador (campo id). No se guardó ningún cambio.',
    );
  }

  const config: ConfigSupabase = { url, claveServicio: clave, fetch: dependencias.fetch };
  const contexto: Contexto = {
    rest: crearRest(config),
    config,
    ahoraIso: new Date(ahoraMs).toISOString(),
    ahoraMs,
  };

  try {
    const estado: EstadoEvento =
      aviso.resultado === 'sin-fecha' ? 'sin-fecha' : await aplicarAviso(contexto, aviso);
    await registrarEvento(contexto, aviso, estado);
    if (aviso.resultado === 'sin-fecha') {
      return fallo(
        400,
        'aviso-sin-fecha',
        'El aviso no trae una fecha de creación válida (campo creation_date). No se aplicó ningún cambio.',
      );
    }
    return responder(200, { ok: true, estado });
  } catch (error) {
    // Solo el código del paso que falló: nunca el correo, el token ni la respuesta de la base.
    const codigo = error instanceof ErrorAviso ? error.codigo : 'error-inesperado';
    console.error(
      `hotmart-aviso: no se pudo guardar un aviso (${codigo}). Hotmart lo reintentará.`,
    );
    return fallo(500, 'no-guardado', 'No se pudo guardar el aviso. Hotmart lo reintentará.');
  }
}
