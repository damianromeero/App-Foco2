import type { Goal } from '../domain/model';
import { TRIAL_DAYS } from '../domain/pricing';
import { GARANTIA, plantilla } from '../config/plantilla';

/**
 * Voz de marca en un solo sitio. Reglas: tuteo, frases cortas, cero culpa, cero urgencia falsa,
 * cero superlativos sin prueba.
 */
export const COPY = {
  hero: {
    eyebrow: 'Entrena tu atención',
    title: 'Vuelve a tu tarea sin perder el hilo.',
    lead: 'Cinco minutos al día con juegos breves para notar cuándo el móvil te saca de lo que haces, y volver. Si un día no entrenas, no pasa nada.',
    primary: 'Arma tu plan gratis',
    secondary: 'Cómo funciona',
    trust: ['Sin anuncios', 'Sin cookies de terceros', GARANTIA, 'Tus datos, exportables'],
  },
  problem: {
    eyebrow: 'Te suena',
    title: 'Abres el móvil para una cosa y acabas en otra.',
    scenes: [
      {
        title: 'Mirar un mensaje',
        body: 'Abres el móvil para una sola cosa y, sin darte cuenta, pasas a otra.',
      },
      {
        title: 'Leer sin retener',
        body: 'Lees una página entera y, al final, no recuerdas qué decía.',
      },
      {
        title: 'Volver tarde',
        body: 'Cambias de tarea y tardas un rato en retomar el hilo de la anterior.',
      },
    ],
    worst:
      'Si no haces nada, el móvil seguirá decidiendo cuándo cambias de tarea. Cinco minutos al día te ayudan a notar antes cuándo te desvías.',
  },
  promises: [
    {
      title: 'Sin culpa',
      body: 'Si un día no entrenas, no pasa nada. Un día de descanso cada semana protege tu racha. Nunca te diremos que has fallado.',
    },
    {
      title: 'Sin trampas',
      body: `El precio se ve antes de pagar y el cobro lo gestiona Hotmart. ${GARANTIA}: si no te convence, pides el reembolso en ese plazo.`,
    },
    {
      title: 'Sin prisa',
      body: 'Cinco minutos al día. Y si lo necesitas, un modo sin límite de tiempo, sin cuenta atrás visible.',
    },
  ],
  howItWorks: [
    {
      step: '1',
      title: 'Respira',
      body: 'Treinta segundos de respiración lenta para empezar sin prisa.',
    },
    {
      step: '2',
      title: 'Entrena',
      body: 'Tres juegos breves de categorías distintas. La dificultad se ajusta a ti.',
    },
    {
      step: '3',
      title: 'Mira tu progreso',
      body: 'Tu rendimiento día a día, comparado con tu punto de partida. Solo lo que podemos medir.',
    },
  ],
  honesty: {
    title: 'Lo que medimos y lo que no prometemos',
    measure: [
      'Tu precisión y tu velocidad en cada juego, día a día.',
      'Cómo cambia tu rendimiento frente a tu test de inicio.',
      'Cuánto usas el móvil, según tu propia respuesta.',
    ],
    notPromise: [
      'Que los juegos te hagan más inteligente en general.',
      'Que mejores la memoria o prevengas el deterioro cognitivo.',
      'Que sustituyas un tratamiento o un diagnóstico.',
    ],
    link: 'Lee qué dice la ciencia',
  },
  trial: {
    title: `Prueba de ${TRIAL_DAYS} días. ${GARANTIA}.`,
    body: `Tienes ${TRIAL_DAYS} días de acceso completo antes del primer cobro. El precio está a la vista antes de pagar, y el cobro y el reembolso los gestiona Hotmart.`,
  },
  finalCta: {
    title: 'Tu primera sesión dura cinco minutos.',
    body: 'Cuatro pasos para armar tu plan y medir tu punto de partida. Decides después si sigues con Premium.',
    button: 'Arma tu plan gratis',
  },
  doneToday: 'Hecho por hoy. Mañana volvemos.',
  restDay: 'Hoy descansas. Mañana sigues.',
  streakProtected: 'Ayer no entrenaste, pero tu racha sigue gracias al día de descanso.',
  streakEmpty: 'Empieza hoy: una sesión y cinco minutos.',
  reminder: 'Tus cinco minutos de foco te esperan.',
  errorGeneric: 'Algo no ha salido bien. Tu progreso sigue a salvo en este dispositivo.',
  localMode: 'Tu progreso se guarda en este dispositivo. Puedes descargarlo cuando quieras.',
  pagosHotmart: 'Los cobros, las cancelaciones y los reembolsos se gestionan en Hotmart.',
} as const;

export const GOALS: { value: Goal; label: string; description: string }[] = [
  {
    value: 'concentrarme',
    label: 'Concentrarme más',
    description: 'Mantener el foco al trabajar o estudiar.',
  },
  {
    value: 'menos-movil',
    label: 'Usar menos el móvil sin darme cuenta',
    description: 'Notar antes cuándo te desvías y volver.',
  },
  {
    value: 'estudiar',
    label: 'Retener mejor lo que estudio',
    description: 'Entrenar la memoria de trabajo a diario.',
  },
  {
    value: 'trabajar-mejor',
    label: 'Cambiar de tarea con menos desgaste',
    description: 'Pasar de una cosa a otra sin perder el hilo.',
  },
  {
    value: 'mente-activa',
    label: 'Mantener la mente activa',
    description: 'Un rato diario de retos y curiosidad.',
  },
];

/**
 * Para qué entrena cada objetivo, en segunda persona: completa el titular del paywall («Ana, tu entrenamiento de 5
 * minutos para…»). Describe la intención de la persona, no un resultado prometido.
 */
export const GOAL_PARA: Record<Goal, string> = {
  concentrarme: 'concentrarte más',
  'menos-movil': 'notar antes cuándo te desvía el móvil',
  estudiar: 'retener mejor lo que estudias',
  'trabajar-mejor': 'cambiar de tarea sin perder el hilo',
  'mente-activa': 'mantener tu mente activa',
};

export const FAQ: { question: string; answer: string }[] = [
  {
    question: '¿Es neuroestimulación?',
    answer: `No. Una aplicación no puede estimular el cerebro; eso requiere dispositivos médicos. ${plantilla.nombre} es entrenamiento de la atención con juegos breves.`,
  },
  {
    question: '¿Mejora mi cerebro?',
    answer:
      'Mejora tu rendimiento en los juegos que entrenas, y eso lo medimos contigo. Lo que sabemos sobre su efecto en la vida diaria es limitado, y por eso lo decimos claro.',
  },
  {
    question: '¿Necesito cuenta?',
    answer:
      'No hace falta crearla: tu acceso nace con tu compra y entras con el correo de la compra, sin contraseña, con un enlace que te enviamos. El inicio guiado no pide cuenta. Tu progreso se guarda en tu dispositivo y, al entrar con tu correo, también se sincroniza entre tus dispositivos.',
  },
  {
    question: '¿Cuándo me cobran?',
    answer: `Al terminar la prueba de ${TRIAL_DAYS} días, si sigues. El cobro lo gestiona Hotmart según el plan que elijas, tal como aparece en su página de compra.`,
  },
  {
    question: '¿Cómo cancelo o pido el\u00a0reembolso?',
    answer: `Las cancelaciones y los reembolsos los gestiona Hotmart. ${GARANTIA}: pide el reembolso dentro de ese plazo.`,
  },
  {
    question: '¿Y si no me convence?',
    answer: `${GARANTIA}. Pide el reembolso dentro de ese plazo y lo gestiona Hotmart.`,
  },
  {
    question: '¿Sirve si no tengo conocimientos previos?',
    answer:
      'Sí. La dificultad se ajusta a tu nivel. No necesitas saber nada de neurociencia para empezar.',
  },
  {
    question: '¿Hay anuncios?',
    answer: 'No. Nunca.',
  },
  {
    question: '¿Qué pasa con mis datos?',
    answer:
      'Son tuyos. Puedes exportarlos o borrarlos cuando quieras, gratis. No los vendemos ni los usamos para publicidad.',
  },
  {
    question: '¿Sirve para el TDAH o para problemas de memoria?',
    answer:
      'No es un tratamiento ni un diagnóstico, y no sustituye la consulta médica. Si te preocupa tu atención o tu memoria, habla con un profesional de salud.',
  },
  {
    question: '¿Funciona sin conexión?',
    answer:
      'Abre la app con conexión para entrar. Después, la sesión diaria sigue funcionando aunque pierdas la señal y se sincroniza cuando vuelve la red.',
  },
];
