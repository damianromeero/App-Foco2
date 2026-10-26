import { GARANTIA } from '../config/plantilla';

/**
 * El Pacto Sin Trampas: promesas públicas que se pueden comprobar en la propia app.
 * Cada una describe cómo verificarla. Si una promesa deja de cumplirse, este texto debe cambiar primero.
 */
export interface PactItem {
  promise: string;
  howToCheck: string;
}

export const PACT: PactItem[] = [
  {
    promise: 'Sin anuncios, nunca.',
    howToCheck:
      'El código no carga ningún script publicitario. Puedes revisarlo en el repositorio.',
  },
  {
    promise: 'Sin cookies de terceros ni analítica externa.',
    howToCheck:
      'La app solo habla con su propio dominio y, si tienes cuenta, con el servicio de cuentas. Las herramientas de desarrollo muestran la lista de peticiones.',
  },
  {
    promise: 'La sesión diaria completa es gratis, siempre.',
    howToCheck:
      'El plan gratuito incluye la sesión de 5 minutos con tres juegos, sin fecha de caducidad.',
  },
  {
    promise: 'Ni culpa ni racha perdida.',
    howToCheck:
      'Un día de descanso cada siete días protege la racha de forma automática. Los mensajes nunca te dicen que has fallado.',
  },
  {
    promise: 'La app no te envía avisos al móvil.',
    howToCheck:
      'No pide permiso de notificaciones ni envía avisos. Lo verás en los permisos de tu navegador.',
  },
  {
    promise: 'El precio se ve antes de pagar.',
    howToCheck:
      'Precios muestra el plan mensual y el anual antes de cualquier compra. El cobro lo gestiona Hotmart.',
  },
  {
    promise: `${GARANTIA}: si no te convence, pides el reembolso.`,
    howToCheck:
      'El reembolso dentro de ese plazo lo gestiona Hotmart. La app no añade llamadas ni formularios propios. Lo verás en Legal → Reembolso.',
  },
  {
    promise: 'Empiezas sin contraseñas.',
    howToCheck:
      'La versión gratuita funciona en tu dispositivo sin registrarte. La cuenta es opcional.',
  },
  {
    promise: 'Tus datos son tuyos: exporta o borra todo cuando quieras, gratis.',
    howToCheck:
      'Ajustes → Mis datos. El archivo de exportación es legible: es un JSON sin códigos ocultos.',
  },
  {
    promise: 'No prometemos curar ni prevenir nada.',
    howToCheck: 'La pestaña Ciencia dice qué está demostrado, qué no y con qué fuentes.',
  },
];
