import { createRng } from './rng';

/**
 * Desafíos de hábito: acciones cotidianas que la persona marca a mano. Son autorreportados:
 * no entran en los retos semanales ni en la racha, y no prometen efectos sobre la salud.
 */
export interface HabitDef {
  id: string;
  title: string;
  detail: string;
}

export const HABITS: readonly HabitDef[] = [
  {
    id: 'mirar-lejos',
    title: 'Mira algo lejano durante 20 segundos',
    detail: 'Aparta la vista de la pantalla y fíjala en un punto a varios metros.',
  },
  {
    id: 'movil-fuera',
    title: 'Aleja el móvil mientras trabajas',
    detail: 'Déjalo boca abajo, fuera de la mesa, durante una tarea concreta.',
  },
  {
    id: 'respirar-antes-de-abrir',
    title: 'Respira tres veces antes de abrir una red social',
    detail: 'Tres respiraciones lentas. Después decides si la abres o no.',
  },
  {
    id: 'cerrar-pestana',
    title: 'Cierra una pestaña que no necesitas',
    detail: 'Repasa las pestañas abiertas y cierra la que ya no usas.',
  },
  {
    id: 'anotar-siguiente',
    title: 'Anota la siguiente tarea antes de cambiar de app',
    detail: 'Una línea con lo que harás al volver, para retomarlo sin rodeos.',
  },
  {
    id: 'cerrar-pensamiento',
    title: 'Termina el pensamiento antes de mirar el móvil',
    detail: 'Acaba la frase o la idea que tienes entre manos antes de coger el teléfono.',
  },
];

const HABIT_IDS: ReadonlySet<string> = new Set(HABITS.map((habit) => habit.id));

export function isHabitId(id: string): boolean {
  return HABIT_IDS.has(id);
}

/** Cuántos desafíos se proponen cada día. */
export const HABITS_PER_DAY = 3;

/** Los mismos tres hábitos para un día dado; cambian de un día a otro. */
export function habitsForDay(dateKey: string): HabitDef[] {
  return createRng(`${dateKey}|habitos`).shuffle(HABITS).slice(0, HABITS_PER_DAY);
}
