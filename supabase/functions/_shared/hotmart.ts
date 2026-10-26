/**
 * Avisos de compra de Hotmart. PURO: sin red, sin base, sin reloj, sin entorno y sin API de Deno ni de Node, para que
 * Vitest lo importe igual que la función. Analiza el cuerpo del aviso, decide qué significa y compara el token. El handler
 * (hotmart-aviso/handler.ts) lo usa; allí se guarda el resultado.
 *
 * REGLA DE ACCESO (fuente única REGLAS-HOTMART.md): el estado de una compra sale de `data.purchase.status` si el aviso lo
 * trae; si no, del tipo de evento. Ver ESTADO_POR_STATUS y ESTADO_POR_EVENTO.
 *
 * ESTADO DE LAS FUENTES:
 *  - Los nombres de cabecera, de campo y de evento de la documentación de Hotmart (webhook 2.0.0) están marcados
 *    [VERIFICAR]. Comprueba con un envío de prueba de la pantalla de webhooks.
 *  - Un nombre o un campo distinto NO crea compras: el aviso se guarda como no-procesado, rechazado, sin-plan o sin-fecha
 *    y queda visible. Nunca se descarta en silencio.
 *  - Correo del comprador: [VERIFICAR: data.buyer.email]. Decide el acceso a la app. Una compra aprobada sin correo válido
 *    no crea compra ni acceso: queda como sin-correo. El correo se guarda en compras y accesos, nunca en eventos_pago.
 *  - Fecha del aviso: creation_date de primer nivel, en milisegundos [VERIFICAR: formato real]. Es OBLIGATORIA.
 *  - Identificador del aviso: `id` de primer nivel. Es OBLIGATORIO: sin él no hay clave de idempotencia y el aviso responde
 *    400 sin guardar nada.
 */

/**
 * Códigos de oferta de Hotmart. Cada plan se reconoce por el código de su oferta. Mientras valga el marcador, ninguna
 * compra se reconoce y los avisos quedan como sin-plan. [COMPLETAR: copiar los códigos desde la pantalla de ofertas de Hotmart]
 */
export const OFERTAS_HOTMART = {
  mensual: '[COMPLETAR: código de oferta mensual de Hotmart]',
  anual: '[COMPLETAR: código de oferta anual de Hotmart]',
} as const;

export type PlanCompra = 'mensual' | 'anual';
export type Ofertas = Readonly<Record<PlanCompra, string>>;
/**
 * Estado de una compra en la base (compras.estado). aprobada: acceso. mantenida: acceso que se conserva mientras Hotmart
 * reintenta el cobro. reembolsada y cancelada: finales, sin acceso.
 */
export type EstadoCompra = 'aprobada' | 'mantenida' | 'reembolsada' | 'cancelada';
/** Último estado de cobro de una suscripción, para decidir el motivo de una cancelación. null = sin información. */
export type UltimoCobro = 'aprobado' | 'impago' | 'otro';

/** Cabecera donde Hotmart manda el token. Es la única fuente del token. [VERIFICAR: nombre exacto en la pantalla de webhooks] */
export const CABECERA_TOKEN_HOTMART = 'x-hotmart-hottok';
/** Campo de primer nivel con la fecha de creación del aviso (milisegundos). [VERIFICAR: formato real] */
export const CAMPO_FECHA_AVISO = 'creation_date';

/** Estado de la compra según purchase.status (la fuente preferente). */
const ESTADO_POR_STATUS: Readonly<Record<string, EstadoCompra>> = {
  APPROVED: 'aprobada',
  COMPLETE: 'aprobada',
  OVERDUE: 'mantenida',
  DELAYED: 'mantenida',
  PURCHASE_PROTEST: 'mantenida',
  PARTIALLY_REFUNDED: 'mantenida',
  REFUNDED: 'reembolsada',
  CHARGEBACK: 'reembolsada',
  CANCELLED: 'cancelada',
  // [VERIFICAR: NO_FUNDS sin reintento pendiente. Hotmart no indica si queda reintento: se trata como final.]
  EXPIRED: 'cancelada',
  NO_FUNDS: 'cancelada',
};

/** Estado de la compra según el tipo de evento, cuando el aviso no trae purchase.status. */
const ESTADO_POR_EVENTO: Readonly<Record<string, EstadoCompra>> = {
  PURCHASE_APPROVED: 'aprobada',
  PURCHASE_COMPLETE: 'aprobada',
  PURCHASE_DELAYED: 'mantenida',
  PURCHASE_PROTEST: 'mantenida',
  PURCHASE_REFUNDED: 'reembolsada',
  PURCHASE_CHARGEBACK: 'reembolsada',
  PURCHASE_CANCELED: 'cancelada',
  PURCHASE_EXPIRED: 'cancelada',
};

/** Estados y eventos conocidos que no cambian el acceso: se registran y responden 200. */
const SIN_EFECTO: ReadonlySet<string> = new Set([
  'PRE_ORDER',
  'PRINTED_BILLET',
  'PROCESSING_TRANSACTION',
  'UNDER_ANALISYS',
  'WAITING_PAYMENT',
  'STARTED',
  'BLOCKED',
  'DISPUTE',
  'PURCHASE_BILLET_PRINTED',
]);

/** Cobro atrasado: si después se cancela la suscripción, la cancelación es por impago y no da acceso. */
const COBRO_IMPAGADO: ReadonlySet<string> = new Set([
  'OVERDUE',
  'DELAYED',
  'NO_FUNDS',
  'PURCHASE_DELAYED',
]);

/** Evento de cancelación de la suscripción. Trae data.date_next_charge (milisegundos). [VERIFICAR: nombre del evento] */
export const EVENTO_CANCELACION_SUSCRIPCION = 'SUBSCRIPTION_CANCELLATION';

/**
 * Estados con los que queda registrado un aviso en eventos_pago. La migración 20261024110000_compras_hotmart.sql repite
 * esta lista en su restricción de estado; la prueba migraciones-compras.test.ts comprueba que coinciden.
 *  - aplicado: cambió una compra, una suscripción o el acceso.
 *  - duplicado: compra aprobada que ya existía (aviso repetido o transacción repetida).
 *  - obsoleto: aviso más antiguo (o igual) que lo guardado; no cambió nada.
 *  - sin-compra / sin-suscripcion: estado de una compra o cancelación de algo que no existe.
 *  - sin-fecha: el aviso no trae una fecha válida (se responde 400).
 */
export const ESTADOS_EVENTO = [
  'aplicado',
  'duplicado',
  'obsoleto',
  'registrado',
  'no-procesado',
  'rechazado',
  'sin-plan',
  'divisa-no-usd',
  'sin-compra',
  'sin-suscripcion',
  'sin-correo',
  'sin-fecha',
  'formato-no-reconocido',
] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

export interface CompraAprobada {
  idTransaccion: string;
  plan: PlanCompra;
  montoUsd: number;
  /** Comisión del productor en USD, si el aviso la trae. Sin ella, la base guarda null. */
  comisionUsd?: number;
  /** Identificador de la suscripción, si la compra es parte de una. [VERIFICAR: data.subscription.subscriber.code] */
  suscriptor?: string;
  /** Correo del comprador, en minúsculas. Decide el acceso a la app. [VERIFICAR: data.buyer.email] */
  correo: string;
}

interface Base {
  id: string;
  evento: string;
}
/** Todo aviso con fecha válida lleva `fecha` en ISO (UTC): es la que se compara con la guardada. */
interface ConFecha extends Base {
  fecha: string;
}

/**
 * Resultado del análisis. Ningún aviso con identificador se descarta: cada uno queda registrado en eventos_pago.
 *  - sin-id: el aviso no trae `id`. Responde 400 y NO guarda nada.
 *  - sin-fecha: el aviso no trae una fecha válida. Se registra y responde 400; no cambia compras, suscripciones ni accesos.
 *  - formato-no-reconocido: no trae tipo de evento ni estado. Se guarda y responde 200.
 *  - no-procesado: tipo o estado que la plantilla no conoce. Se guarda y responde 200.
 *  - registrado: tipo o estado conocido sin efecto en el acceso. Se guarda y responde 200.
 *  - rechazado: compra con datos incompletos. Se guarda y responde 200.
 *  - sin-plan: la oferta no está en OFERTAS_HOTMART. Se guarda y responde 200.
 *  - divisa-no-usd: el precio no viene en dólares. Se guarda y responde 200.
 *  - sin-correo: compra aprobada válida pero sin correo del comprador. No crea compra ni acceso. Responde 200.
 *  - compra-aprobada: se guarda la compra (una renovación también, con su propia transacción).
 *  - compra-estado: mantenida, reembolsada o cancelada de una compra (solo hace falta su transacción).
 *  - cancelacion-suscripcion: la suscripción se cancela. Sin identificador de suscriptor, queda como sin-suscripcion.
 */
export type Clasificado =
  | (Base & { resultado: 'sin-id' })
  | (Base & { resultado: 'sin-fecha' })
  | (ConFecha & { resultado: 'formato-no-reconocido' })
  | (ConFecha & { resultado: 'no-procesado' })
  | (ConFecha & { resultado: 'registrado' })
  | (ConFecha & { resultado: 'rechazado' })
  | (ConFecha & { resultado: 'sin-plan' })
  | (ConFecha & { resultado: 'divisa-no-usd' })
  | (ConFecha & { resultado: 'sin-correo' })
  | (ConFecha & { resultado: 'compra-aprobada'; compra: CompraAprobada })
  | (ConFecha & {
      resultado: 'compra-estado';
      estado: 'mantenida' | 'reembolsada' | 'cancelada';
      idTransaccion: string;
      suscriptor: string | null;
      ultimoCobro: UltimoCobro;
    })
  | (ConFecha & {
      resultado: 'cancelacion-suscripcion';
      suscriptor: string | null;
      /** Hasta cuándo sigue el acceso si la cancelación es voluntaria (data.date_next_charge), en ISO. */
      fechaProximoCobro: string | null;
    });

/** Lo que el análisis necesita de fuera (el módulo no lee reloj ni entorno). */
export interface ContextoAnalisis {
  /** Hora actual en milisegundos. Una fecha de aviso en el futuro lejano se rechaza: bloquearía los avisos legítimos. */
  ahoraMs: number;
  /** Ofertas de Hotmart. Por defecto, OFERTAS_HOTMART. */
  ofertas?: Ofertas;
}

/** Forma razonable de un correo. Sin ella no hay acceso que dar. */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u;

/** Hotmart existe desde 2011: una fecha anterior a 2010 es un valor en segundos o un error, no una fecha de aviso. */
const FECHA_MINIMA_MS = Date.UTC(2010, 0, 1);
/** Margen para relojes desajustados. Más allá, la fecha del aviso se considera inválida. */
const MARGEN_FUTURO_MS = 24 * 60 * 60 * 1000;
/** numeric(10,2) admite hasta 99.999.999,99: se rechaza un importe absurdo en vez de provocar un error de la base. */
const IMPORTE_MAXIMO = 10_000_000;

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor);

/** Lee una ruta de claves sin lanzar: undefined si algún nivel no es un objeto. */
function leer(origen: unknown, ...claves: string[]): unknown {
  let actual: unknown = origen;
  for (const clave of claves) {
    if (!esObjeto(actual)) return undefined;
    actual = actual[clave];
  }
  return actual;
}

const textoCorto = (valor: unknown, maximo = 120): string | null =>
  typeof valor === 'string' && valor.trim() !== '' && valor.length <= maximo ? valor : null;

const importeValido = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= IMPORTE_MAXIMO;

const ISO_CON_ZONA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Fecha en ISO (UTC) a partir de milisegundos (número o texto de dígitos) o de un ISO con zona horaria. Null si no es
 * válida: sin valor, en segundos, sin zona (ambigua) o anterior a 2010. Sin límite de futuro: vale para fechas de
 * próximo cobro, que van hacia delante.
 */
function fechaEnIso(bruto: unknown): string | null {
  let ms: number;
  if (typeof bruto === 'number') {
    ms = bruto;
  } else if (typeof bruto === 'string') {
    const texto = bruto.trim();
    if (/^\d{10,16}$/.test(texto)) ms = Number(texto);
    else if (ISO_CON_ZONA.test(texto)) ms = Date.parse(texto);
    else return null;
  } else {
    return null;
  }
  if (!Number.isFinite(ms) || ms < FECHA_MINIMA_MS) return null;
  return new Date(ms).toISOString();
}

/**
 * Fecha de creación del aviso en ISO (UTC), o null si falta o no es válida. Además de las reglas de fechaEnIso, rechaza
 * más de un día en el futuro: un aviso con fecha lejana no debe ganar a los reales. [VERIFICAR: formato real]
 */
export function fechaDelAviso(cuerpo: unknown, ahoraMs: number): string | null {
  const iso = fechaEnIso(leer(cuerpo, CAMPO_FECHA_AVISO));
  if (iso === null) return null;
  return Date.parse(iso) > ahoraMs + MARGEN_FUTURO_MS ? null : iso;
}

/** Identificador del aviso (`id` de primer nivel), o null si falta. Es obligatorio: sin él no hay idempotencia. */
export function identificadorDelAviso(cuerpo: unknown): string | null {
  return textoCorto(leer(cuerpo, 'id'));
}

/** Correo del comprador en minúsculas, o null si falta o no tiene forma de correo. [VERIFICAR: data.buyer.email] */
export function correoDelComprador(cuerpo: unknown): string | null {
  const bruto = textoCorto(leer(cuerpo, 'data', 'buyer', 'email'), 254);
  if (bruto === null) return null;
  const correo = bruto.trim().toLowerCase();
  return CORREO.test(correo) ? correo : null;
}

/** Plan de la oferta, o null si el código no está en las ofertas (o si ese plan aún es un marcador). */
export function planDeOferta(
  codigo: string,
  ofertas: Ofertas = OFERTAS_HOTMART,
): PlanCompra | null {
  for (const plan of ['mensual', 'anual'] as const) {
    const configurado = ofertas[plan];
    if (!configurado.startsWith('[COMPLETAR') && configurado === codigo) return plan;
  }
  return null;
}

/** Comisión del productor, en USD, si el aviso la trae. [VERIFICAR: ruta data.commissions y campo commission_as] */
function comisionDelProductor(cuerpo: unknown): number | undefined {
  const comisiones = leer(cuerpo, 'data', 'commissions');
  if (!Array.isArray(comisiones)) return undefined;
  const propia: unknown = comisiones.find(
    (entrada) => esObjeto(entrada) && entrada.commission_as === 'PRODUCER',
  );
  const valor = leer(propia, 'value');
  return importeValido(valor) ? valor : undefined;
}

/** Identificador de la suscripción del comprador. [VERIFICAR: data.subscription.subscriber.code] */
const suscriptorDe = (cuerpo: unknown): string | null =>
  textoCorto(leer(cuerpo, 'data', 'subscription', 'subscriber', 'code'));

/** Clave con la que Hotmart nombra el estado o el evento (sirve para el último cobro). */
type Clave = { estado: EstadoCompra; clave: string } | 'sin-efecto' | 'desconocido';

/**
 * Estado de la compra: purchase.status si viene (fuente preferente); si no, el tipo de evento. Un estado que la plantilla
 * no conoce es 'desconocido' (se guarda como no-procesado). Un estado conocido sin efecto es 'sin-efecto'.
 */
function clasificarEstado(cuerpo: unknown, evento: string | null): Clave {
  const status = textoCorto(leer(cuerpo, 'data', 'purchase', 'status'));
  if (status !== null) {
    const estado = ESTADO_POR_STATUS[status];
    if (estado) return { estado, clave: status };
    return SIN_EFECTO.has(status) ? 'sin-efecto' : 'desconocido';
  }
  if (evento === null) return 'desconocido';
  const estado = ESTADO_POR_EVENTO[evento];
  if (estado) return { estado, clave: evento };
  return SIN_EFECTO.has(evento) ? 'sin-efecto' : 'desconocido';
}

/** Último cobro que se guarda en la suscripción: aprobado, impago (atrasado) u otro. */
const ultimoCobroDe = (clave: string, estado: EstadoCompra): UltimoCobro => {
  if (estado === 'aprobada') return 'aprobado';
  return COBRO_IMPAGADO.has(clave) ? 'impago' : 'otro';
};

/**
 * Analiza el cuerpo de un aviso y decide qué significa. No guarda ni llama a nada.
 * Orden: sin identificador → sin-id; sin fecha válida → sin-fecha; luego el tipo o el estado.
 */
export function analizarAviso(cuerpo: unknown, contexto: ContextoAnalisis): Clasificado {
  const { ahoraMs, ofertas = OFERTAS_HOTMART } = contexto;
  const objeto = esObjeto(cuerpo);
  const evento = objeto ? textoCorto(cuerpo.event, 80) : null;
  const id = identificadorDelAviso(cuerpo);
  if (id === null) return { resultado: 'sin-id', id: '', evento: evento ?? 'desconocido' };

  const fecha = fechaDelAviso(cuerpo, ahoraMs);
  if (fecha === null) return { resultado: 'sin-fecha', id, evento: evento ?? 'desconocido' };

  if (evento === EVENTO_CANCELACION_SUSCRIPCION) {
    const proximo = fechaEnIso(leer(cuerpo, 'data', 'date_next_charge'));
    return {
      resultado: 'cancelacion-suscripcion',
      id,
      evento,
      fecha,
      suscriptor: suscriptorDe(cuerpo),
      fechaProximoCobro: proximo,
    };
  }

  const clave = clasificarEstado(cuerpo, evento);
  const etiqueta = evento ?? 'desconocido';
  if (clave === 'desconocido') {
    if (evento === null && leer(cuerpo, 'data', 'purchase', 'status') === undefined)
      return { resultado: 'formato-no-reconocido', id, evento: etiqueta, fecha };
    return { resultado: 'no-procesado', id, evento: etiqueta, fecha };
  }
  if (clave === 'sin-efecto') return { resultado: 'registrado', id, evento: etiqueta, fecha };

  const idTransaccion = textoCorto(leer(cuerpo, 'data', 'purchase', 'transaction')); // [VERIFICAR: data.purchase.transaction]
  if (!idTransaccion) return { resultado: 'rechazado', id, evento: etiqueta, fecha };

  if (clave.estado !== 'aprobada') {
    return {
      resultado: 'compra-estado',
      id,
      evento: etiqueta,
      fecha,
      estado: clave.estado,
      idTransaccion,
      suscriptor: suscriptorDe(cuerpo),
      ultimoCobro: ultimoCobroDe(clave.clave, clave.estado),
    };
  }

  const codigoOferta = textoCorto(leer(cuerpo, 'data', 'purchase', 'offer', 'code')); // [VERIFICAR: data.purchase.offer.code]
  const monto = leer(cuerpo, 'data', 'purchase', 'price', 'value'); // [VERIFICAR: data.purchase.price.value]
  const divisa = leer(cuerpo, 'data', 'purchase', 'price', 'currency_code'); // [VERIFICAR: data.purchase.price.currency_code]
  if (!codigoOferta || !importeValido(monto) || typeof divisa !== 'string') {
    return { resultado: 'rechazado', id, evento: etiqueta, fecha };
  }
  if (divisa !== 'USD') return { resultado: 'divisa-no-usd', id, evento: etiqueta, fecha };

  const plan = planDeOferta(codigoOferta, ofertas);
  if (!plan) return { resultado: 'sin-plan', id, evento: etiqueta, fecha };

  // Sin correo no hay a quién dar acceso: la compra no se guarda y el aviso queda visible como sin-correo.
  const correo = correoDelComprador(cuerpo);
  if (correo === null) return { resultado: 'sin-correo', id, evento: etiqueta, fecha };

  const comisionUsd = comisionDelProductor(cuerpo);
  const suscriptor = suscriptorDe(cuerpo);
  return {
    resultado: 'compra-aprobada',
    id,
    evento: etiqueta,
    fecha,
    compra: {
      idTransaccion,
      plan,
      montoUsd: monto,
      correo,
      ...(comisionUsd !== undefined ? { comisionUsd } : {}),
      ...(suscriptor !== null ? { suscriptor } : {}),
    },
  };
}

/**
 * Token que trae el aviso: SOLO la cabecera x-hotmart-hottok. Sin cabecera, o vacía, no hay token (401). El campo del
 * cuerpo no cuenta: un hottok en el cuerpo no sustituye a la cabecera.
 */
export function tokenDelAviso(cabecera: string | null): string | null {
  if (cabecera === null) return null;
  const limpio = cabecera.trim();
  return limpio === '' ? null : limpio;
}

/** Resumen SHA-256 de un texto (32 bytes). Usa Web Crypto, disponible en Deno y en Node sin importar nada. */
async function resumenSha256(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

/** Compara dos arrays de bytes sin salir antes de tiempo: recorre siempre todo, sin importar dónde difieran. */
function bytesIguales(a: Uint8Array, b: Uint8Array): boolean {
  let diferencia = a.length ^ b.length;
  const largo = Math.max(a.length, b.length);
  for (let i = 0; i < largo; i++) diferencia |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferencia === 0;
}

/**
 * Compara el token recibido con el de HOTMART_HOTTOK en tiempo constante. Se comparan los resúmenes SHA-256 (siempre
 * 32 bytes), así el tiempo no depende de la longitud del token ni de cuántos caracteres coinciden. Sin token recibido o
 * sin esperado, no es válido.
 */
export async function tokenHotmartValido(
  recibido: string | null | undefined,
  esperado: string,
): Promise<boolean> {
  if (!recibido || !esperado) return false;
  const [a, b] = await Promise.all([resumenSha256(recibido), resumenSha256(esperado)]);
  return bytesIguales(a, b);
}
