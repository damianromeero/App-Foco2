import { describe, expect, it } from 'vitest';
import { nextAction, nextPresentation, type NextInput } from './next';

const lessons = [
  { id: 'cambiar-cuesta', title: 'Cambiar de tarea tiene un coste', free: true },
  { id: 'por-que-variar', title: 'Entrenar mejora sobre todo lo que entrenas', free: true },
  { id: 'multitarea', title: 'Multitarea: lo que de verdad pasa', free: false },
];

const base: NextInput = {
  sessionDone: false,
  challenge: { id: 'variedad', title: 'Variedad', done: false },
  lessons,
  lessonsRead: [],
  premium: false,
};

describe('nextAction', () => {
  it('pide la sesión mientras no esté hecha hoy', () => {
    expect(nextAction(base)).toEqual({ kind: 'sesion' });
  });

  it('después de la sesión, propone el reto de la semana si no está cumplido', () => {
    expect(nextAction({ ...base, sessionDone: true })).toEqual({
      kind: 'reto',
      title: 'Variedad',
    });
  });

  it('si el reto ya está cumplido, propone la primera lección gratuita no leída', () => {
    const input = {
      ...base,
      sessionDone: true,
      challenge: { id: 'variedad', title: 'Variedad', done: true },
    };
    expect(nextAction(input)).toEqual({
      kind: 'leccion',
      id: 'cambiar-cuesta',
      title: 'Cambiar de tarea tiene un coste',
    });
  });

  it('salta las lecciones ya leídas', () => {
    const input = {
      ...base,
      sessionDone: true,
      challenge: null,
      lessonsRead: ['cambiar-cuesta'],
    };
    expect(nextAction(input)).toMatchObject({ kind: 'leccion', id: 'por-que-variar' });
  });

  it('en el plan gratuito no propone lecciones premium', () => {
    const input = {
      ...base,
      sessionDone: true,
      challenge: null,
      lessonsRead: ['cambiar-cuesta', 'por-que-variar'],
    };
    expect(nextAction(input)).toEqual({ kind: 'biblioteca' });
  });

  it('con plan premium, sí propone lecciones premium', () => {
    const input = {
      ...base,
      premium: true,
      sessionDone: true,
      challenge: null,
      lessonsRead: ['cambiar-cuesta', 'por-que-variar'],
    };
    expect(nextAction(input)).toMatchObject({ kind: 'leccion', id: 'multitarea' });
  });

  it('sin reto y sin lecciones pendientes, lleva a la biblioteca', () => {
    const input = {
      ...base,
      sessionDone: true,
      challenge: null,
      lessonsRead: lessons.map((l) => l.id),
      premium: true,
    };
    expect(nextAction(input)).toEqual({ kind: 'biblioteca' });
  });
});

describe('nextPresentation', () => {
  it('da una etiqueta y una ruta para cada acción', () => {
    expect(nextPresentation({ kind: 'sesion' }).to).toBe('/sesion');
    expect(nextPresentation({ kind: 'reto', title: 'Variedad' })).toMatchObject({
      label: 'Siguiente reto',
      to: '/retos',
    });
    expect(nextPresentation({ kind: 'leccion', id: 'por-que-variar', title: 'x' }).to).toBe(
      '/lecciones/por-que-variar',
    );
    expect(nextPresentation({ kind: 'biblioteca' }).to).toBe('/biblioteca');
  });
});
