/**
 * Plantillas de los correos de la app (Resend). Funciones puras: no leen reloj ni entorno, así que las pruebas las
 * ejecutan tal cual. Cada correo sale en dos versiones (HTML y texto) con el mismo contenido.
 *
 * Reglas de redacción (docs/INFRAESTRUCTURA.md, «Qué hace hoy y qué no»):
 *  - Nada que la app no cumpla. Pedir un reembolso no quita el acceso: lo retira la confirmación del reembolso.
 *  - Sin culpa ni presión. Un pago atrasado no cambia el acceso mientras Hotmart reintenta el cobro.
 *  - Sin datos de pago, sin token y sin el correo del comprador dentro del texto.
 */

/** Debe coincidir con `garantiaDias` de src/config/plantilla.ts. supabase/tests/correos.test.ts lo comprueba. */
export const GARANTIA_DIAS = 15;

/** Nombre visible de la marca. Debe coincidir con `nombre` de src/config/plantilla.ts. */
export const MARCA = 'Atenzo';

export type TipoCorreo = 'bienvenida' | 'pago-atrasado' | 'reembolso' | 'cancelacion';

export interface DatosCorreo {
  tipo: TipoCorreo;
  /** Plan de la compra, si lo hay. */
  plan?: 'mensual' | 'anual';
  /** Hasta cuándo sigue el acceso tras una cancelación, en ISO. Sin fecha, el correo no promete ninguna. */
  accesoHasta?: string | null;
}

export interface OpcionesCorreo {
  /** Dirección pública de la app, sin barra final. Se usa en los botones. */
  appUrl: string;
  /** Correo de soporte, si lo hay. Sin él, el correo no lo muestra. */
  soporte?: string | undefined;
}

export interface CorreoListo {
  asunto: string;
  html: string;
  texto: string;
  /** Respuestas a este correo llegan al soporte, si lo hay. */
  responderA?: string;
}

const escapar = (valor: string): string =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const NOMBRE_PLAN: Record<'mensual' | 'anual', string> = {
  mensual: 'Plan mensual',
  anual: 'Plan anual',
};

function fechaLarga(iso: string): string | null {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Madrid',
  }).format(fecha);
}

interface Contenido {
  asunto: string;
  /** Etiqueta pequeña sobre el título: el contexto del correo (acceso, pago, reembolso o suscripción). */
  etiqueta: string;
  preencabezado: string;
  titulo: string;
  parrafos: string[];
  boton?: { texto: string; ruta: string };
  nota?: string;
}

/** Texto de cada correo. Todas las cifras salen de constantes o de la fecha del aviso, nunca de texto libre. */
function contenidoDe(datos: DatosCorreo, opciones: OpcionesCorreo): Contenido {
  switch (datos.tipo) {
    case 'bienvenida':
      return {
        asunto: `Tu acceso a ${MARCA} ya está listo`,
        etiqueta: datos.plan ? `Acceso · ${NOMBRE_PLAN[datos.plan]}` : 'Acceso',
        preencabezado: 'Tu compra está confirmada. Entra con el correo de tu compra.',
        titulo: 'Hola, tu acceso ya está listo',
        parrafos: [
          `Gracias por tu compra. Tu acceso a ${MARCA} está activo.`,
          'Para entrar, pide el enlace con el correo de tu compra. Te llegará un enlace de un solo uso, sin contraseña.',
        ],
        boton: { texto: `Entrar a ${MARCA}`, ruta: '/entrar' },
        nota: `Tienes ${GARANTIA_DIAS} días de garantía desde tu compra. Pedir un reembolso no te quita el acceso de inmediato: el acceso se retira cuando el reembolso queda confirmado.`,
      };
    case 'pago-atrasado':
      return {
        asunto: 'Tu pago no se completó todavía',
        etiqueta: 'Pago',
        preencabezado:
          'No pasa nada: tu acceso se mantiene mientras Hotmart vuelve a intentar el cobro.',
        titulo: 'Tu pago no se completó',
        parrafos: [
          'Hotmart no pudo cobrar tu última renovación.',
          'Tu acceso se mantiene mientras Hotmart vuelve a intentar el cobro. Si quieres adelantarte, revisa tu método de pago en tu cuenta de Hotmart.',
        ],
        boton: { texto: `Ir a mi cuenta de ${MARCA}`, ruta: '/cuenta' },
      };
    case 'reembolso':
      return {
        asunto: 'Tu reembolso está confirmado',
        etiqueta: 'Reembolso',
        preencabezado: 'Hemos recibido la confirmación de tu reembolso.',
        titulo: 'Tu reembolso está confirmado',
        parrafos: [
          'Hemos recibido la confirmación de tu reembolso. Tu acceso a la app se retira con este cambio.',
          'Gracias por haberlo probado. Si algún día quieres volver, puedes hacerlo desde la página de precios.',
        ],
        boton: { texto: 'Ver precios', ruta: '/precios' },
      };
    case 'cancelacion': {
      const fecha = datos.accesoHasta ? fechaLarga(datos.accesoHasta) : null;
      return {
        asunto: 'Tu suscripción está cancelada',
        etiqueta: 'Suscripción',
        preencabezado: 'Hemos registrado la cancelación de tu suscripción.',
        titulo: 'Tu suscripción está cancelada',
        parrafos: [
          'Hemos registrado la cancelación de tu suscripción.',
          fecha
            ? `Tu acceso sigue activo hasta el ${fecha}. Después de esa fecha no se hará ningún cobro nuevo.`
            : 'Consulta en tu cuenta de Hotmart hasta cuándo sigue tu acceso. No se hará ningún cobro nuevo.',
          'Si cambias de idea, puedes volver a suscribirte cuando quieras desde la página de precios.',
        ],
        boton: { texto: 'Ver precios', ruta: '/precios' },
      };
    }
  }
}

/** Tipo de letra del sistema: el correo se ve como en el teléfono de quien lo lee, sin cargar fuentes externas. */
const FUENTE =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const COLOR = {
  fondo: '#000000',
  tarjeta: '#0a0a0a',
  linea: '#262626',
  texto: '#ffffff',
  suave: '#a1a1aa',
  acento: '#fcd9a0',
  boton: '#ffffff',
  botonTexto: '#000000',
} as const;

function htmlDe(contenido: Contenido, opciones: OpcionesCorreo): string {
  const url = (ruta: string) => `${escapar(opciones.appUrl)}${ruta}`;
  const parrafos = contenido.parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COLOR.suave};">${escapar(p)}</p>`,
    )
    .join('');
  const boton = contenido.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:${COLOR.boton};">
        <a href="${url(contenido.boton.ruta)}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 28px;font-size:16px;font-weight:600;color:${COLOR.botonTexto};text-decoration:none;border-radius:999px;">${escapar(contenido.boton.texto)}</a>
      </td></tr></table>`
    : '';
  const nota = contenido.nota
    ? `<p style="margin:0;padding-top:16px;border-top:1px solid ${COLOR.linea};font-size:14px;line-height:1.6;color:${COLOR.suave};">${escapar(contenido.nota)}</p>`
    : '';
  const soporte = opciones.soporte
    ? `<p style="margin:0 0 6px;">¿Tienes dudas? Responde a este correo o escribe a <a href="mailto:${escapar(opciones.soporte)}" style="color:${COLOR.acento};text-decoration:none;">${escapar(opciones.soporte)}</a>.</p>`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapar(contenido.asunto)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.fondo};font-family:${FUENTE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(contenido.preencabezado)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.fondo};font-family:${FUENTE};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td align="center" style="padding:8px 0 28px;">
        <img src="${url('/correo/atenzo-logo-blanco.png')}" width="200" alt="${MARCA}" style="display:block;border:0;outline:none;width:200px;height:auto;">
      </td></tr>
      <tr><td style="background:${COLOR.tarjeta};border:1px solid ${COLOR.linea};border-radius:28px;padding:40px 32px;">
        <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.acento};">${escapar(contenido.etiqueta)}</p>
        <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;font-weight:700;color:${COLOR.texto};">${escapar(contenido.titulo)}</h1>
        ${parrafos}
        ${boton}
        ${nota}
      </td></tr>
      <tr><td style="padding:24px 8px 0;font-size:13px;line-height:1.6;color:${COLOR.suave};">
        ${soporte}
        <p style="margin:0;">${MARCA} · Recibes este correo por tu compra o suscripción.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function textoDe(contenido: Contenido, opciones: OpcionesCorreo): string {
  const partes = [contenido.titulo, '', ...contenido.parrafos];
  if (contenido.boton)
    partes.push('', `${contenido.boton.texto}: ${opciones.appUrl}${contenido.boton.ruta}`);
  if (contenido.nota) partes.push('', contenido.nota);
  if (opciones.soporte) partes.push('', `¿Tienes dudas? Escribe a ${opciones.soporte}.`);
  partes.push('', `${MARCA} · Recibes este correo por tu compra o suscripción.`);
  return partes.join('\n');
}

/** Construye el correo completo: asunto, HTML, texto y destinatario de las respuestas. */
export function construirCorreo(datos: DatosCorreo, opciones: OpcionesCorreo): CorreoListo {
  const contenido = contenidoDe(datos, opciones);
  return {
    asunto: contenido.asunto,
    html: htmlDe(contenido, opciones),
    texto: textoDe(contenido, opciones),
    ...(opciones.soporte ? { responderA: opciones.soporte } : {}),
  };
}
