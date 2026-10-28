/**
 * Envío de correos transaccionales con Resend. Si no hay RESEND_API_KEY configurada,
 * el correo no se envía y se deja constancia en los registros del servidor (nunca se pierde en silencio).
 * Las funciones de Stripe (opción avanzada) lo usan solo con texto; el aviso de Hotmart pasa también el HTML.
 */
export interface MensajeCorreo {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendEmail(message: MensajeCorreo): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!apiKey || !from) {
    console.error('Correo no enviado: falta RESEND_API_KEY o EMAIL_FROM', message.subject);
    return false;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
  });
  if (!response.ok) {
    console.error('Resend devolvió un error', response.status);
    return false;
  }
  return true;
}
