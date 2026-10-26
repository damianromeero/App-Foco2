/**
 * Medición anónima: lista cerrada de eventos y su validación. Módulo PURO: sin Deno, sin `npm:` y sin red, para que lo
 * importen la función `eventos`, las pruebas y la comprobación de deriva.
 *
 * Qué viaja en un evento: un tipo de EVENTOS_APP, un identificador de dispositivo (UUID aleatorio) y, si el tipo lo
 * pide, un valor de una lista cerrada (VALORES). Nunca nombres, correos, textos libres ni direcciones.
 *
 * La misma lista vive en tres sitios y la prueba `supabase/tests/contrato.test.ts` los compara:
 *  1. este archivo (la fuente para el servidor),
 *  2. `src/config/medicion.ts` (el espejo que importan la app y el panel),
 *  3. `registrar_evento_app` en `supabase/migrations/20261024100001_limite_eventos.sql` (la base).
 * Si añades un evento o un valor, cámbialo en los tres.
 */

/**
 * Interruptor de la medición, del lado del SERVIDOR. El navegador no lo decide: con `false`, la función `eventos` responde
 * 204 sin leer el cuerpo ni tocar la base, aunque alguien le envíe algo. Debe coincidir con `plantilla.medicionAnonima`
 * (src/config/plantilla.ts). Enciéndelo solo cuando Supabase esté configurado y tu política de privacidad lo explique.
 */
export const medicionAnonima = false;

/** Tipos de valor que puede acompañar a un evento. */
export type TipoValor = 'pantalla' | 'juego' | 'paso';

/**
 * Listas cerradas de valores.
 *  - pantalla: la pantalla de la sesión diaria en la que la persona salió (respiración, juego, reflexión o lección).
 *  - juego: los ids de GAME_IDS (src/domain/model.ts). La prueba de deriva avisa si se añade un juego y falta aquí.
 *  - paso: los pasos del inicio guiado (/empezar).
 */
export const VALORES = {
  pantalla: ['respiracion', 'juego', 'reflexion', 'leccion'],
  juego: [
    'vigilancia',
    'semaforo',
    'secuencia',
    'busqueda',
    'stroop',
    'cambio',
    'reflejo',
    'espera-la-senal',
    'casilla-iluminada',
    'diferencia-cuadricula',
    'cual-no-encaja',
    'siguiente-figura',
    'espejo-o-giro',
    'simetria',
    'mismo-tono',
    'contar-pitidos',
    'agudo-o-grave',
    'seguir-puntos',
    'busqueda-formas',
  ],
  paso: ['objetivo', 'ajustes', 'base', 'listo'],
} as const satisfies Record<TipoValor, readonly string[]>;

export interface EventoApp {
  tipo: string;
  /** Texto en español que ve la persona que administra, en el panel. */
  etiqueta: string;
  /** Qué lista de VALORES acompaña al evento, o null si no lleva valor. */
  valor: TipoValor | null;
}

/**
 * LISTA CERRADA de eventos que existen de verdad en la app. Cada uno se dispara desde una pantalla concreta:
 *  - portada_vista: Landing (/)
 *  - precios_vista: Pricing (/precios)
 *  - compra_clic: el botón de compra (sin valor: un solo enlace de compra)
 *  - acceso_enlace_pedido, acceso_confirmado, sin_compra_visto: pantallas de /entrar
 *  - onboarding_paso, onboarding_completado: Onboarding (/empezar)
 *  - sesion_iniciada, juego_terminado, sesion_completada, sesion_abandonada: Session (/sesion)
 *  - enfoque_iniciado: Focus (/enfoque)
 */
export const EVENTOS_APP = [
  { tipo: 'portada_vista', etiqueta: 'Vio la portada', valor: null },
  { tipo: 'precios_vista', etiqueta: 'Vio los precios', valor: null },
  { tipo: 'compra_clic', etiqueta: 'Pulsó comprar', valor: null },
  { tipo: 'acceso_enlace_pedido', etiqueta: 'Pidió el enlace de acceso', valor: null },
  { tipo: 'acceso_confirmado', etiqueta: 'Confirmó su acceso', valor: null },
  { tipo: 'sin_compra_visto', etiqueta: 'Vio el aviso de que no hay compra', valor: null },
  { tipo: 'onboarding_paso', etiqueta: 'Llegó a un paso del inicio', valor: 'paso' },
  { tipo: 'onboarding_completado', etiqueta: 'Terminó el inicio', valor: null },
  { tipo: 'sesion_iniciada', etiqueta: 'Empezó la sesión de hoy', valor: null },
  { tipo: 'juego_terminado', etiqueta: 'Terminó un juego de la sesión', valor: 'juego' },
  { tipo: 'sesion_completada', etiqueta: 'Terminó la sesión de hoy', valor: null },
  { tipo: 'sesion_abandonada', etiqueta: 'Salió de la sesión antes del final', valor: 'pantalla' },
  { tipo: 'enfoque_iniciado', etiqueta: 'Empezó un bloque de foco', valor: null },
] as const satisfies readonly EventoApp[];

export type TipoEvento = (typeof EVENTOS_APP)[number]['tipo'];

/** Evento ya validado, tal como se envía a la base. */
export interface EventoEntrada {
  tipo: TipoEvento;
  dispositivo: string;
  valor?: string;
}

export type ResultadoEvento = { ok: true; evento: EventoEntrada } | { ok: false; error: string };

const VALOR_DE_TIPO = new Map<string, TipoValor | null>(
  EVENTOS_APP.map((evento): [string, TipoValor | null] => [evento.tipo, evento.valor]),
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAVES_PERMITIDAS = new Set(['tipo', 'dispositivo', 'valor']);

/** ¿Es un identificador de dispositivo con forma de UUID? */
export function esDispositivo(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor);
}

/**
 * Valida el cuerpo de un evento. Acepta solo `tipo`, `dispositivo` y `valor`: cualquier otra clave, un texto libre o un
 * valor fuera de la lista del evento hace fallar la validación. Los mensajes son para quien programa, no para la persona.
 */
export function validarEvento(cuerpo: unknown): ResultadoEvento {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    return { ok: false, error: 'El evento no tiene el formato esperado.' };
  }
  const registro = cuerpo as Record<string, unknown>;
  if (Object.keys(registro).some((clave) => !CLAVES_PERMITIDAS.has(clave))) {
    return { ok: false, error: 'El evento trae datos que no se aceptan.' };
  }

  const { tipo, dispositivo, valor } = registro;
  if (typeof tipo !== 'string' || !VALOR_DE_TIPO.has(tipo)) {
    return { ok: false, error: 'Tipo de evento desconocido.' };
  }
  if (!esDispositivo(dispositivo)) {
    return { ok: false, error: 'Identificador de dispositivo no válido.' };
  }

  const tipoValor = VALOR_DE_TIPO.get(tipo) ?? null;
  const traeValor = valor !== undefined && valor !== null;
  if (tipoValor === null) {
    if (traeValor) return { ok: false, error: 'Este evento no lleva valor.' };
    return { ok: true, evento: { tipo: tipo as TipoEvento, dispositivo } };
  }
  if (!traeValor) return { ok: false, error: 'Falta el valor del evento.' };
  if (typeof valor !== 'string' || !(VALORES[tipoValor] as readonly string[]).includes(valor)) {
    return { ok: false, error: 'Valor de evento no válido.' };
  }
  return { ok: true, evento: { tipo: tipo as TipoEvento, dispositivo, valor } };
}
