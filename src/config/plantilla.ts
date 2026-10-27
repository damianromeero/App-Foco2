/**
 * PUNTO ÚNICO DE PERSONALIZACIÓN DE LA PLANTILLA.
 *
 * Todo lo que la persona cambia al adaptar su copia vive aquí: nombre, eslogan, promesas, minutos de sesión,
 * correo de contacto y qué servicios reales están conectados (bloque `conexiones`).
 * Las pantallas leen estos valores: no escribas el nombre ni el correo a mano en ninguna pantalla.
 *
 * Mientras un servicio no esté conectado, la interfaz es honesta: no promete cobros, cuentas ni avisos que la
 * plantilla todavía no hace. Cómo conectar cada servicio: docs/CONECTAR.md. Antes de publicar: `npm run verificar`.
 */

/** Servicios reales conectados. Pon `true` solo cuando la conexión esté implementada, probada y configurada. */
export interface Conexiones {
  supabase: boolean;
  pagos: boolean;
  correo: boolean;
  ia: boolean;
}

export const plantilla = {
  nombre: 'Atenzo',
  eslogan: 'Tu entrenamiento diario de atención.',
  promesas: ['Sin culpa', 'Sin trampas', 'Sin prisa'] as const,
  minutosSesion: 5,
  /**
   * Garantía de reembolso, en días. Cada mención de la garantía en la app dice «Garantía de N días».
   * El cobro y el reembolso los gestiona Hotmart: pon aquí la misma duración que tu producto de Hotmart.
   */
  garantiaDias: 15,
  /**
   * Correo de contacto que ven las personas. «correo@example.com» es solo un ejemplo: cámbialo por un correo tuyo
   * que vayas a usar con la app. El gate (`npm run verificar`) no lo bloquea.
   */
  contactoEmail: 'correo@example.com',
  /**
   * Correo de soporte que aparece en el diálogo «Eliminar tu cuenta». Es un ejemplo: [COMPLETAR] con el correo que
   * atenderás de verdad. Las personas que tienen una suscripción de Hotmart lo usan para pedir ayuda al cancelarla.
   */
  soporteEmail: 'correo@example.com', // [COMPLETAR: correo de soporte real]
  /**
   * Servicios reales conectados. Todo en `false` = modo local, sin cuentas ni cobros.
   * `npm run verificar` no deja publicar mientras `supabase` o `pagos` estén en `false`.
   */
  conexiones: { supabase: false, pagos: false, correo: false, ia: false } as Conexiones,
  /**
   * Medición anónima de uso (qué pantallas se ven, cuántas sesiones se terminan). APAGADA por defecto: con `false` la
   * app no envía nada y no guarda nada en el navegador. Enciéndela solo cuando Supabase esté configurado y hayas revisado
   * tu política de privacidad (`src/content/legal.ts`) para que cuente esta medición. Cada evento lleva un tipo de la lista
   * cerrada de `src/config/medicion.ts`, un identificador aleatorio de dispositivo (se renueva cada 30 días) y, a veces, un
   * valor de lista: nunca nombres, correos ni textos. El SERVIDOR tiene su propio interruptor
   * (`medicionAnonima` en `supabase/functions/_shared/eventos.ts`): deben valer lo mismo y una prueba lo comprueba.
   */
  medicionAnonima: false as boolean,
} as const;

/** Texto de la garantía. Es el mismo en toda la app: cámbialo solo cambiando `garantiaDias`. */
export const GARANTIA = `Garantía de ${plantilla.garantiaDias} días`;

/** Nombre de la marca para archivos descargados, sin tildes ni espacios (p. ej. «atenzo»). */
export const MARCA_ARCHIVO = plantilla.nombre
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
