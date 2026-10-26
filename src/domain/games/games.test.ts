import { GAME_IDS } from '../model';
import { createRng } from '../rng';
import { CATEGORIES, GAMES, getGame } from './registry';
import {
  evaluateResponse,
  type CategoryId,
  type ChoiceTrial,
  type TapTrial,
  type Trial,
} from './types';

const build = (id: string, level = 3, calm = false, seed = 'prueba'): Trial[] =>
  getGame(id as never).build(createRng(seed), level, calm);

const choicesOf = (trials: Trial[]): ChoiceTrial[] =>
  trials.filter((trial): trial is ChoiceTrial => trial.mode === 'choice');

describe('catálogo de juegos', () => {
  it('tiene 19 juegos y al menos dos gratuitos en cada categoría', () => {
    expect(GAMES).toHaveLength(19);
    for (const category of Object.keys(CATEGORIES) as CategoryId[]) {
      const free = GAMES.filter((game) => game.category === category && game.free);
      expect(free.length, category).toBeGreaterThanOrEqual(2);
    }
  });

  it('cada juego tiene un id único y todos los ids están en GAME_IDS', () => {
    const ids = GAMES.map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...GAME_IDS].sort());
  });

  it.each(GAMES.map((game) => [game.id]))('%s genera el número de ensayos anunciado', (id) => {
    const game = getGame(id);
    for (const level of [1, 5, 10]) {
      expect(game.build(createRng('n'), level, false)).toHaveLength(game.trialCount);
    }
  });

  it.each(GAMES.map((game) => [game.id]))('%s es determinista con la misma semilla', (id) => {
    expect(build(id, 4, false, 'igual')).toEqual(build(id, 4, false, 'igual'));
  });

  it.each(GAMES.map((game) => [game.id]))('%s alcanza el 100 % con respuestas perfectas', (id) => {
    const trials = build(id, 5, false);
    const outcomes = trials.map((trial) =>
      trial.mode === 'tap'
        ? evaluateResponse(trial, {
            kind: 'tap',
            tapped: trial.target,
            rtMs: trial.target ? 400 : null,
          })
        : evaluateResponse(trial, { kind: 'choice', chosenId: trial.answerId, rtMs: 800 }),
    );
    const scorable = outcomes.filter((outcome) => outcome.scorable);
    expect(scorable.length).toBeGreaterThan(0);
    expect(scorable.every((outcome) => outcome.correct)).toBe(true);
  });

  it('el modo sin prisa quita los límites de tiempo y alarga los estímulos', () => {
    const fast = build('vigilancia', 3, false)[0] as TapTrial;
    const calm = build('vigilancia', 3, true)[0] as TapTrial;
    expect(calm.showMs).toBeGreaterThan(fast.showMs);

    const choiceCalm = build('stroop', 3, true)[0] as ChoiceTrial;
    expect(choiceCalm.limitMs).toBeUndefined();
  });
});

describe('contrato común de todos los juegos', () => {
  it.each(GAMES.map((game) => [game.id]))(
    '%s: las opciones tienen ids únicos y la respuesta correcta está entre ellas',
    (id) => {
      for (const trial of choicesOf(build(id, 6))) {
        const ids = trial.options.map((option) => option.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(trial.answerId);
      }
    },
  );

  it.each(GAMES.map((game) => [game.id]))(
    '%s: en modo sin prisa ninguna elección tiene límite',
    (id) => {
      for (const level of [1, 6, 10]) {
        for (const trial of choicesOf(build(id, level, true))) {
          expect(trial.limitMs).toBeUndefined();
        }
      }
    },
  );

  it.each(GAMES.map((game) => [game.id]))(
    '%s: sube de dificultad con el nivel (los ensayos cambian)',
    (id) => {
      expect(JSON.stringify(build(id, 1, false))).not.toBe(JSON.stringify(build(id, 10, false)));
    },
  );

  it.each(GAMES.map((game) => [game.id]))('%s: todo estímulo tiene nombre accesible', (id) => {
    for (const trial of build(id, 5)) {
      expect(trial.displayLabel.trim().length).toBeGreaterThan(0);
      if (trial.mode === 'choice') {
        for (const option of trial.options) {
          expect((option.ariaLabel ?? option.label).trim().length, option.id).toBeGreaterThan(0);
        }
        if (trial.preview) expect(trial.preview.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it.each(GAMES.map((game) => [game.id]))(
    '%s: requiresColor coincide con los ensayos que usan color',
    (id) => {
      const game = getGame(id);
      const usesColor = build(id, 6).some(
        (trial) => trial.mode === 'choice' && trial.displayColor !== undefined,
      );
      expect(usesColor).toBe(game.requiresColor);
    },
  );

  it.each(GAMES.filter((game) => game.id !== 'secuencia').map((game) => [game.id]))(
    '%s: todos los ensayos puntúan (no hay calentamiento)',
    (id) => {
      for (const trial of build(id, 5)) {
        expect(trial.scorable).toBe(true);
      }
    },
  );

  it('en modo sin color sigue habiendo juegos en todas las categorías', () => {
    const nonColor = GAMES.filter((game) => !game.requiresColor);
    for (const category of Object.keys(CATEGORIES) as CategoryId[]) {
      expect(
        nonColor.some((game) => game.category === category),
        category,
      ).toBe(true);
    }
  });
});

describe('robustez con muchas semillas', () => {
  it.each(GAMES.map((game) => [game.id]))(
    '%s: con 40 semillas y varios niveles, las respuestas están entre las opciones',
    (id) => {
      for (const seed of Array.from({ length: 40 }, (_, index) => `semilla-${index}`)) {
        for (const level of [1, 4, 7, 10]) {
          for (const trial of choicesOf(build(id, level, false, seed))) {
            expect(trial.options.map((option) => option.id)).toContain(trial.answerId);
          }
        }
      }
    },
  );
});

describe('vigilancia', () => {
  it('el objetivo es siempre la X y las letras de distracción nunca lo son', () => {
    const trials = build('vigilancia', 2) as TapTrial[];
    for (const trial of trials) {
      if (trial.target) expect(trial.display).toBe('X');
      else expect(trial.display).not.toBe('X');
    }
  });
});

describe('semáforo', () => {
  it('el círculo pide respuesta y el cuadrado la retiene', () => {
    const trials = build('semaforo', 6) as TapTrial[];
    for (const trial of trials) {
      expect(trial.shape === 'circle').toBe(trial.target);
    }
  });
});

describe('eco de letras (n-back)', () => {
  it('los primeros ensayos no puntúan y coinciden con la letra de hace n turnos cuando es objetivo', () => {
    const trials = build('secuencia', 1) as TapTrial[];
    expect(trials[0]?.scorable).toBe(false);
    for (let i = 1; i < trials.length; i += 1) {
      const trial = trials[i];
      if (trial?.scorable && trial.target) {
        expect(trial.display).toBe(trials[i - 1]?.display);
      }
      if (trial?.scorable && !trial.target) {
        expect(trial.display).not.toBe(trials[i - 1]?.display);
      }
    }
  });

  it('sube la dificultad: el nivel marca cuántos turnos atrás se compara', () => {
    const easy = build('secuencia', 1) as TapTrial[];
    expect(easy[0]?.prompt).toBe('¿Coincide con la anterior?');
    const medium = build('secuencia', 4) as TapTrial[];
    expect(medium[0]?.prompt).toBe('¿Coincide con la de hace 2?');
    const hard = build('secuencia', 8) as TapTrial[];
    expect(hard[0]?.prompt).toBe('¿Coincide con la de hace 3?');
  });
});

describe('buscar la O', () => {
  it('hay exactamente una O y la respuesta correcta apunta a ella', () => {
    const trials = build('busqueda', 6) as ChoiceTrial[];
    for (const trial of trials) {
      const os = trial.options.filter((option) => option.label === 'O');
      expect(os).toHaveLength(1);
      expect(os[0]?.id).toBe(trial.answerId);
      expect(trial.options.length).toBe((trial.columns ?? 0) ** 2);
    }
  });

  it('la cuadrícula crece con el nivel', () => {
    const low = build('busqueda', 1)[0] as ChoiceTrial;
    const high = build('busqueda', 10)[0] as ChoiceTrial;
    expect(high.options.length).toBeGreaterThan(low.options.length);
  });
});

describe('tinta y palabra (Stroop)', () => {
  it('la respuesta correcta es siempre el color de la tinta, no la palabra', () => {
    const trials = build('stroop', 5) as ChoiceTrial[];
    for (const trial of trials) {
      expect(trial.answerId).toBe(trial.displayColor);
    }
  });

  it('a nivel alto aparecen ensayos incongruentes', () => {
    const trials = build('stroop', 10, false, 'incongruentes') as ChoiceTrial[];
    const incongruent = trials.filter(
      (trial) => trial.display.toLowerCase() !== trial.displayColor,
    );
    expect(incongruent.length).toBeGreaterThan(0);
  });
});

describe('cambio de regla', () => {
  it('la respuesta respeta la regla que se muestra en cada ensayo', () => {
    const trials = build('cambio', 5) as ChoiceTrial[];
    for (const trial of trials) {
      const number = Number(trial.display);
      if (trial.prompt === 'Par o impar') {
        expect(trial.answerId).toBe(number % 2 === 0 ? 'par' : 'impar');
      } else {
        expect(trial.answerId).toBe(number > 5 ? 'mayor' : 'menor');
      }
    }
  });
});

describe('evaluateResponse', () => {
  it('rechaza una respuesta de tipo distinto al ensayo', () => {
    const trial = build('vigilancia')[0] as TapTrial;
    expect(() => evaluateResponse(trial, { kind: 'choice', chosenId: 'x', rtMs: 1 })).toThrow(
      TypeError,
    );
  });

  it('una respuesta sin tiempo no cuenta reacción', () => {
    const trial = build('stroop')[0] as ChoiceTrial;
    expect(evaluateResponse(trial, { kind: 'choice', chosenId: null, rtMs: null }).rtMs).toBeNull();
  });
});
