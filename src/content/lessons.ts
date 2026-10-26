export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  free: boolean;
  paragraphs: string[];
  refs: string[];
}

/** Micro-lecciones de un minuto. Cada afirmación remite a una referencia de la pestaña Ciencia. */
export const LESSONS: Lesson[] = [
  {
    id: 'cambiar-cuesta',
    title: 'Cambiar de tarea tiene un coste',
    summary: 'Por qué saltar entre tareas te agota más de lo que parece.',
    minutes: 1,
    free: true,
    paragraphs: [
      'Cada vez que pasas de una tarea a otra, tu cerebro tiene que cambiar de reglas. Ese cambio lleva un poco de tiempo, y ese tiempo se nota.',
      'En un estudio clásico de 2001, el coste del cambio era mayor cuanto más complicadas eran las reglas y cuanto menos familiar era la nueva tarea.',
      'Lo práctico: si puedes, termina una cosa antes de empezar la siguiente.',
    ],
    refs: ['rubinstein-2001'],
  },
  {
    id: 'por-que-variar',
    title: 'Entrenar mejora sobre todo lo que entrenas',
    summary: 'Por qué Foco Mente cambia de juego cada día y no te promete milagros.',
    minutes: 1,
    free: true,
    paragraphs: [
      'La evidencia más sólida sobre los juegos de entrenamiento dice que mejoran sobre todo las tareas que se practican.',
      'Lo que cuesta más es que esa mejora llegue a tu día a día. Por eso mezclamos juegos de atención, de control de impulsos y de memoria, y medimos tu progreso dentro de la app sin inventar más de lo que sabemos.',
      'Si notas que mejoras en un juego, es real. Si quieres que se note fuera, cuéntalo tú: la pestaña Progreso te enseña lo que sí podemos medir.',
    ],
    refs: ['simons-2016', 'meta-2021'],
  },
  {
    id: 'residuo-de-atencion',
    title: 'Lo que dejas a medias sigue ocupando sitio',
    summary: 'El residuo de atención: por qué piensas en lo anterior mientras haces lo nuevo.',
    minutes: 1,
    free: false,
    paragraphs: [
      'Cuando cambias de tarea, parte de tu atención se queda con la anterior. Se le llama residuo de atención.',
      'Sophie Leroy lo estudió en 2009 con tareas de trabajo.',
      'Práctica: antes de cambiar, escribe en una nota la siguiente acción pendiente. Puede ayudarte a soltar la tarea anterior.',
    ],
    refs: ['leroy-2009'],
  },
  {
    id: 'multitarea',
    title: 'Multitarea: lo que de verdad pasa',
    summary: 'Qué dice la ciencia sobre hacer varias cosas a la vez, y qué no.',
    minutes: 1,
    free: false,
    paragraphs: [
      'No se puede atender bien a dos cosas a la vez: se alterna. Lo que varía es el coste de alternar.',
      'Un estudio de 2009 encontró que quienes usaban muchos medios a la vez filtraban peor las distracciones. Otros estudios no encontraron lo mismo, así que el resultado es discutido.',
      'Práctica: si tienes que concentrarte, cierra las pestañas que no uses ahora. No necesitas esperar a que la ciencia lo confirme para que te sirva.',
    ],
    refs: ['ophir-2009'],
  },
  {
    id: 'interrupciones',
    title: 'Cada interrupción tiene un precio',
    summary: 'Por qué una notificación cuesta más que los segundos que te lleva leerla.',
    minutes: 1,
    free: false,
    paragraphs: [
      'Una interrupción no solo corta lo que hacías. También te obliga a recuperar el hilo después.',
      'Un estudio de 2008 vio que la gente terminaba las tareas interrumpidas más deprisa, pero con más estrés, frustración y esfuerzo.',
      'Práctica: silencia las notificaciones que no sean personas o citas. Revísalas en bloques, no cada vez que suenan.',
    ],
    refs: ['mark-2008'],
  },
  {
    id: 'recompensa-impredecible',
    title: 'Por qué cuesta tanto dejar de deslizar',
    summary: 'Las recompensas impredecibles enganchan más que las previsibles.',
    minutes: 1,
    free: false,
    paragraphs: [
      'En psicología del aprendizaje se sabe desde hace décadas que las recompensas impredecibles mantienen una conducta durante más tiempo que las previsibles.',
      'El deslizamiento infinito funciona así: nunca sabes cuándo aparecerá algo interesante. Ese mecanismo no es una falta de fuerza de voluntad; es cómo está hecho el sistema.',
      'Práctica: elige antes qué quieres ver y cierra la aplicación cuando lo hayas visto. Decidir antes te quita parte del trabajo a la recompensa impredecible.',
    ],
    refs: [],
  },
];

export function lessonById(id: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.id === id);
}
