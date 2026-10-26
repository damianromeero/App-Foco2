/**
 * Qué toca a continuación. Un único orden, pensado para que la pantalla de inicio tenga
 * siempre un botón claro: la sesión del día, después el reto de la semana, después una lección
 * que falte y, si no queda nada, la biblioteca.
 */

export interface NextInput {
  /** ¿Ya se ha completado la sesión de hoy? */
  sessionDone: boolean;
  /** Reto de la semana, o null si no hay ninguno que mostrar. */
  challenge: { id: string; title: string; done: boolean } | null;
  lessons: readonly { id: string; title: string; free: boolean }[];
  lessonsRead: readonly string[];
  premium: boolean;
}

export type NextAction =
  | { kind: 'sesion' }
  | { kind: 'reto'; title: string }
  | { kind: 'leccion'; id: string; title: string }
  | { kind: 'biblioteca' };

export function nextAction(input: NextInput): NextAction {
  if (!input.sessionDone) return { kind: 'sesion' };

  if (input.challenge && !input.challenge.done) {
    return { kind: 'reto', title: input.challenge.title };
  }

  const lesson = input.lessons.find(
    (candidate) => (input.premium || candidate.free) && !input.lessonsRead.includes(candidate.id),
  );
  if (lesson) return { kind: 'leccion', id: lesson.id, title: lesson.title };

  return { kind: 'biblioteca' };
}

/** Texto y ruta del botón principal para cada acción. */
export function nextPresentation(action: NextAction): {
  label: string;
  detail: string;
  to: string;
} {
  switch (action.kind) {
    case 'sesion':
      return { label: 'Empezar', detail: 'Tres juegos y una pausa para ti', to: '/sesion' };
    case 'reto':
      return { label: 'Siguiente reto', detail: action.title, to: '/retos' };
    case 'leccion':
      return { label: 'Siguiente lección', detail: action.title, to: `/lecciones/${action.id}` };
    case 'biblioteca':
      return { label: 'Practicar', detail: 'Elige un juego de la biblioteca', to: '/biblioteca' };
  }
}
