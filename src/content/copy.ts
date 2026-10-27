import type { Goal } from '../domain/model';
import { TRIAL_DAYS } from '../domain/pricing';
import { GARANTIA, plantilla } from '../config/plantilla';

/**
 * Voz de marca en un solo sitio. Reglas: tuteo, frases cortas, cero culpa, cero urgencia falsa,
 * cero superlativos sin prueba.
 */
/** Acción principal de las páginas públicas: lleva al inicio guiado, que termina en los planes y la prueba. */
export const CTA_PRUEBA = `Empieza tu prueba de ${TRIAL_DAYS} días`;

export const COPY = {
  hero: {
    eyebrow: 'Tu entrenamiento diario de atención',
    title: 'Vuelve a tu tarea sin perder el hilo.',
    lead: 'Tres juegos breves al día que se ajustan a tu nivel. Mides tu punto de partida y ves, día a día, cómo cambian tu precisión y tu velocidad.',
    primary: CTA_PRUEBA,
    secondary: 'Cómo funciona',
    trust: [`Prueba de ${TRIAL_DAYS} días`, GARANTIA, 'Cancelas cuando quieras', 'Sin anuncios'],
  },
  problem: {
    eyebrow: '¿Te pasa?',
    title: 'Abres el celular para una cosa y acabas en otra.',
    scenes: [
      {
        title: 'Mirar un mensaje',
        body: 'Abres el celular para una sola cosa y, sin darte cuenta, pasas a otra.',
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
      'Si no haces nada, el celular seguirá decidiendo cuándo cambias de tarea. Cinco minutos al día para practicar algo concreto: darte cuenta de que te desviaste y volver.',
  },
  promises: [
    {
      title: 'Sin culpa',
      body: 'Si un día no entrenas, no pasa nada. Tu racha cuenta semanas, no días: con 3 días a la semana sigue viva. Nunca te diremos que fallaste.',
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
      'Cuánto usas el celular, según tu propia respuesta.',
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
    body: `En cuatro pasos eliges tu objetivo, ajustas los juegos y mides tu punto de partida. Luego eliges tu plan y empiezas tu prueba de ${TRIAL_DAYS} días.`,
    button: CTA_PRUEBA,
  },
  doneToday: 'Hecho por hoy. Mañana volvemos.',
  restDay: 'Hoy descansas. Mañana sigues.',
  streakEmpty: 'Empieza hoy: una sesión y cinco minutos.',
  reminder: 'Tus cinco minutos de foco te esperan.',
  errorGeneric: 'Algo salió mal. Tu progreso sigue a salvo en este dispositivo.',
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
    label: 'Usar menos el celular sin darme cuenta',
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
  concentrarme: 'practicar tu concentración',
  'menos-movil': 'notar antes cuándo te desvía el celular',
  estudiar: 'entrenar tu memoria de trabajo',
  'trabajar-mejor': 'cambiar de tarea sin perder el hilo',
  'mente-activa': 'mantener tu mente activa',
};

export const FAQ: { question: string; answer: string }[] = [
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
    question: '¿Necesito cuenta?',
    answer:
      'No hace falta crearla: tu acceso nace con tu compra y entras con el correo de la compra, sin contraseña, con un enlace que te enviamos. El inicio guiado no pide cuenta. Tu progreso se guarda en tu dispositivo y, al entrar con tu correo, también se sincroniza entre tus dispositivos.',
  },
  {
    question: '¿En qué dispositivos funciona?',
    answer:
      'En el navegador de tu celular, tableta o computadora, sin instalar nada. Si quieres, la agregas a tu pantalla de inicio y se abre como una app.',
  },
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
    question: '¿Sirve si no tengo conocimientos previos?',
    answer:
      'Sí. La dificultad se ajusta a tu nivel. No necesitas saber nada de neurociencia para empezar.',
  },
  {
    question: '¿Sirve para el TDAH o para problemas de memoria?',
    answer:
      'No es un tratamiento ni un diagnóstico, y no sustituye la consulta médica. Si te preocupa tu atención o tu memoria, habla con un profesional de salud.',
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
    question: '¿Funciona sin conexión?',
    answer:
      'Abre la app con conexión para entrar. Después, la sesión diaria sigue funcionando aunque pierdas la señal y se sincroniza cuando vuelve la red.',
  },
];
