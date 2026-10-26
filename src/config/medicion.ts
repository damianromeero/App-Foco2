/**
 * Medición anónima, lado del navegador y del panel: espejo de `supabase/functions/_shared/eventos.ts`.
 *
 * Existe para que la app y el panel importen la lista sin cruzar a `supabase/functions` (esa carpeta se despliega
 * aparte y no entra en el paquete del navegador). Los valores son los mismos que los del servidor y los de la función
 * `registrar_evento_app` de la base: `supabase/tests/contrato.test.ts` falla si alguno se queda atrás.
 * Si añades un evento o un valor, cámbialo en los tres sitios.
 */

/** Tipos de valor que puede acompañar a un evento. */
export type TipoValor = 'pantalla' | 'juego' | 'paso';

/**
 * Listas cerradas de valores.
 *  - pantalla: la pantalla de la sesión diaria en la que la persona salió (respiración, juego, reflexión o lección).
 *  - juego: los ids de GAME_IDS (src/domain/model.ts).
 *  - paso: los pasos del inicio guiado (/onboarding).
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
 *  - precios_vista: Pricing (/precios) y Paywall (/paywall)
 *  - compra_clic: el botón de compra (sin valor: un solo enlace de compra)
 *  - acceso_enlace_pedido, acceso_confirmado, sin_compra_visto: pantallas de /entrar
 *  - onboarding_paso, onboarding_completado: Onboarding (/onboarding)
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
