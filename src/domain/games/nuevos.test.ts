import { createRng } from '../rng';
import { isMirrorSymmetric, figureGeometry, figureKey, makeFigure, samePoints } from './figures';
import { getGame } from './registry';
import {
  evaluateResponse,
  type ChoiceTrial,
  type FigureVisual,
  type Point,
  type TapTrial,
  type Trial,
} from './types';

const build = (id: string, level = 3, calm = false, seed = 'nuevos'): Trial[] =>
  getGame(id as never).build(createRng(seed), level, calm);

const choices = (trials: Trial[]): ChoiceTrial[] =>
  trials.filter((trial): trial is ChoiceTrial => trial.mode === 'choice');

/** Ensayos de tipo tap, para los juegos de reacción. */
const taps = (trials: Trial[]): TapTrial[] =>
  trials.filter((trial): trial is TapTrial => trial.mode === 'tap');

/** Puntos de una figura de contorno libre, tal como se dibuja (ya reflejada y girada). */
function outlineOf(figure: FigureVisual): Point[] {
  const geometry = figureGeometry(figure);
  if (geometry.kind !== 'polygon') throw new Error('se esperaba un polígono');
  return geometry.points;
}

describe('casilla iluminada', () => {
  it('la respuesta es la casilla que se iluminó en la vista previa', () => {
    for (const trial of choices(build('casilla-iluminada', 4))) {
      const visual = trial.preview?.visual;
      expect(visual?.kind).toBe('cuadricula');
      if (visual?.kind !== 'cuadricula') continue;
      expect(visual.lit).toEqual([Number(trial.answerId)]);
      expect(trial.options).toHaveLength(visual.columns * visual.columns);
    }
  });

  it('la cuadrícula crece y la luz dura menos con el nivel', () => {
    const low = choices(build('casilla-iluminada', 1))[0];
    const high = choices(build('casilla-iluminada', 10))[0];
    expect(high?.columns ?? 0).toBeGreaterThan(low?.columns ?? 0);
    expect(high?.preview?.ms ?? Infinity).toBeLessThan(low?.preview?.ms ?? 0);
  });
});

describe('espejo o giro', () => {
  it('la figura comparada es la referencia girada, o su reflejo girado, según la respuesta', () => {
    for (const trial of [1, 4, 8].flatMap((level) => choices(build('espejo-o-giro', level)))) {
      if (trial.visual?.kind !== 'conjunto') throw new Error('falta el conjunto');
      const [reference, compared] = trial.visual.items;
      if (reference?.kind !== 'figura' || compared?.kind !== 'figura') throw new Error('figuras');
      const comparedPoints = outlineOf(compared);

      const matchingTurns = Array.from({ length: 360 }, (_, turn) => turn).filter((turn) => {
        const turned: FigureVisual = { ...reference, rotation: turn, mirror: false };
        return samePoints(comparedPoints, outlineOf(turned), 0.6);
      });
      if (trial.answerId === 'girada') {
        expect(matchingTurns, 'la figura girada debe coincidir con la referencia').toContain(
          compared.rotation % 360,
        );
      } else {
        expect(matchingTurns, 'el espejo no coincide con ningún giro de la referencia').toEqual([]);
      }
    }
  });
});

describe('qué ha cambiado (diferencia en cuadrícula)', () => {
  it('las dos cuadrículas solo son distintas en la casilla de la respuesta', () => {
    for (const trial of choices(build('diferencia-cuadricula', 6))) {
      if (trial.visual?.kind !== 'conjunto') throw new Error('falta el conjunto');
      const [first, second] = trial.visual.items;
      if (first?.kind !== 'cuadricula' || second?.kind !== 'cuadricula') throw new Error('grids');
      const differing = (first.cells ?? []).flatMap((cell, index) => {
        const other = second.cells?.[index] ?? null;
        const same =
          (cell === null && other === null) ||
          (cell !== null && other !== null && figureKey(cell) === figureKey(other));
        return same ? [] : [index];
      });
      expect(differing).toEqual([Number(trial.answerId)]);
    }
  });

  it('desde el nivel 4 el cambio es solo de giro, así que la figura sigue siendo la misma', () => {
    for (const trial of choices(build('diferencia-cuadricula', 6))) {
      if (trial.visual?.kind !== 'conjunto') continue;
      const [first, second] = trial.visual.items;
      if (first?.kind !== 'cuadricula' || second?.kind !== 'cuadricula') continue;
      const index = Number(trial.answerId);
      const before = first.cells?.[index];
      const after = second.cells?.[index];
      expect(before?.form).toBe(after?.form);
      expect(before?.rotation).not.toBe(after?.rotation);
    }
  });
});

describe('cuál no encaja', () => {
  it('tres figuras comparten el valor de la pista y la respuesta es la que cambia', () => {
    const cueOf = (prompt: string): string => {
      const match = /por (la forma|el tamaño|el relleno|el giro)/.exec(prompt);
      if (!match?.[1]) throw new Error(`pista no reconocida: ${prompt}`);
      return match[1];
    };
    const valueOf = (figure: FigureVisual, cue: string): string => {
      if (cue === 'la forma') return typeof figure.form === 'string' ? figure.form : 'trazo';
      if (cue === 'el tamaño') return figure.size;
      if (cue === 'el relleno') return String(figure.filled);
      return String(figure.rotation);
    };
    for (const level of [2, 8]) {
      for (const trial of choices(build('cual-no-encaja', level))) {
        const cue = cueOf(trial.prompt);
        const figures = trial.options.map((option) => option.visual);
        const values = figures.map((figure) =>
          figure?.kind === 'figura' ? valueOf(figure, cue) : '',
        );
        const answer = values[Number(trial.answerId)];
        const others = values.filter((_, index) => index !== Number(trial.answerId));
        expect(new Set(others).size, trial.prompt).toBe(1);
        expect(answer, trial.prompt).not.toBe(others[0]);
      }
    }
  });
});

describe('simetría', () => {
  it('la respuesta "sí" solo aparece cuando la figura coincide consigo misma al doblarla', () => {
    for (const level of [1, 7]) {
      for (const trial of choices(build('simetria', level))) {
        if (trial.visual?.kind !== 'figura') throw new Error('falta la figura');
        const form = trial.visual.form;
        if (typeof form === 'string') throw new Error('se esperaba un trazo libre');
        expect(isMirrorSymmetric(form.points)).toBe(trial.answerId === 'si');
        expect(trial.visual.axis).toBe(true);
      }
    }
  });
});

/** Siguiente valor de una propiedad a partir de las cuatro primeras: constante, ciclo de 2 o 3, o paso fijo en grados. */
function predictNext<T extends string | number | boolean>(values: readonly T[]): T | undefined {
  if (values.every((value) => value === values[0])) return values[0];
  for (const period of [2, 3]) {
    if (values.slice(period).every((value, index) => value === values[index])) {
      return values[4 - period];
    }
  }
  if (typeof values[0] === 'number') {
    const numbers = values as readonly number[];
    const step = ((((numbers[1] ?? 0) - (numbers[0] ?? 0)) % 360) + 360) % 360;
    const steady = numbers.every((value, index) => {
      if (index === 0) return true;
      const previous = numbers[index - 1] ?? 0;
      return (((value - previous) % 360) + 360) % 360 === step;
    });
    if (steady) return (((numbers[3] ?? 0) + step) % 360) as unknown as T;
  }
  return undefined;
}

describe('siguiente figura', () => {
  it('la continuación se puede deducir de las cuatro figuras vistas y solo una opción la cumple', () => {
    for (const level of [1, 5, 9]) {
      for (const trial of choices(build('siguiente-figura', level, false, 'serie'))) {
        if (trial.visual?.kind !== 'conjunto') throw new Error('falta la serie');
        const shown = trial.visual.items.slice(0, 4).map((item) => {
          if (item.kind !== 'figura' || typeof item.form !== 'string') throw new Error('figura');
          return item;
        });
        const next = {
          form: predictNext(shown.map((figure) => figure.form as string)),
          size: predictNext(shown.map((figure) => figure.size)),
          filled: predictNext(shown.map((figure) => figure.filled)),
          rotation: predictNext(shown.map((figure) => figure.rotation)),
        };
        expect(next, trial.displayLabel).not.toEqual({
          form: undefined,
          size: undefined,
          filled: undefined,
          rotation: undefined,
        });
        const matching = trial.options
          .filter((option) => {
            const figure = option.visual;
            return (
              figure?.kind === 'figura' &&
              figure.form === next.form &&
              figure.size === next.size &&
              figure.filled === next.filled &&
              figure.rotation === next.rotation
            );
          })
          .map((option) => option.id);
        expect(matching).toEqual([trial.answerId]);
      }
    }
  });

  it('cuatro opciones distintas y una de ellas es la respuesta', () => {
    for (const trial of choices(build('siguiente-figura', 7))) {
      const figures = trial.options.map((option) => option.visual);
      expect(trial.options).toHaveLength(4);
      const keys = figures.map((figure) => (figure?.kind === 'figura' ? figureKey(figure) : ''));
      expect(new Set(keys).size).toBe(4);
      expect(trial.visual?.kind).toBe('conjunto');
    }
  });
});

describe('sonido', () => {
  it('mismo tono: la respuesta "igual" solo aparece cuando las alturas coinciden', () => {
    for (const trial of choices(build('mismo-tono', 4))) {
      if (trial.visual?.kind !== 'tonos') throw new Error('faltan tonos');
      const [first, second] = trial.visual.tones;
      expect(first?.hz === second?.hz).toBe(trial.answerId === 'igual');
    }
  });

  it('agudo o grave: el segundo tono sube o baja según la respuesta, y nunca son iguales', () => {
    for (const trial of choices(build('agudo-o-grave', 4))) {
      if (trial.visual?.kind !== 'tonos') throw new Error('faltan tonos');
      const [first, second] = trial.visual.tones;
      expect(first?.hz).not.toBe(second?.hz);
      expect((second?.hz ?? 0) > (first?.hz ?? 0)).toBe(trial.answerId === 'agudo');
    }
  });

  it('contar pitidos: el número de tonos es la respuesta y las opciones llegan hasta el máximo', () => {
    for (const trial of choices(build('contar-pitidos', 8))) {
      if (trial.visual?.kind !== 'tonos') throw new Error('faltan tonos');
      expect(trial.visual.tones).toHaveLength(Number(trial.answerId));
      expect(Number(trial.answerId)).toBeGreaterThanOrEqual(2);
      expect(trial.options.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('la separación entre pitidos se reduce con el nivel', () => {
    const gapOf = (level: number) => {
      const trial = choices(build('contar-pitidos', level))[0];
      return trial?.visual?.kind === 'tonos' ? trial.visual.gapMs : 0;
    };
    expect(gapOf(10)).toBeLessThan(gapOf(1));
  });
});

describe('reacción y espera', () => {
  it('el reflejo siempre tiene un estímulo que hay que tocar, con espera aleatoria', () => {
    for (const trial of taps(build('reflejo', 3))) {
      expect(trial.target).toBe(true);
      expect(trial.waitMs).toBeGreaterThanOrEqual(800);
      expect(trial.waitMs).toBeLessThanOrEqual(2400);
    }
  });

  it('la espera incluye ensayos en los que no hay que tocar', () => {
    const trials = taps(build('espera-la-senal', 6, false, 'espera'));
    expect(trials.some((trial) => !trial.target)).toBe(true);
    expect(trials.some((trial) => trial.target)).toBe(true);
    for (const trial of trials) {
      expect(trial.waitMs).toBeGreaterThanOrEqual(700);
      expect(trial.waitMs).toBeLessThanOrEqual(2300);
    }
  });

  it('en modo sin prisa la ventana para tocar es más larga', () => {
    expect(taps(build('reflejo', 3, true))[0]?.showMs).toBeGreaterThan(
      taps(build('reflejo', 3, false))[0]?.showMs ?? 0,
    );
    expect(taps(build('espera-la-senal', 3, true))[0]?.showMs).toBeGreaterThan(
      taps(build('espera-la-senal', 3, false))[0]?.showMs ?? 0,
    );
  });
});

describe('seguir los puntos', () => {
  it('la letra de la respuesta corresponde a un punto que se iluminó al principio', () => {
    for (const trial of choices(build('seguir-puntos', 5))) {
      const preview = trial.preview?.visual;
      if (preview?.kind !== 'puntos' || trial.visual?.kind !== 'puntos') {
        throw new Error('faltan los puntos');
      }
      expect(preview.dots.filter((dot) => dot.lit)).toHaveLength(3);
      const answerDot = trial.visual.dots.find((dot) => dot.letter === trial.answerId);
      const litEnds = preview.dots.filter((dot) => dot.lit).map((dot) => dot.to);
      expect(litEnds.some((point) => answerDot && samePoints([point], [answerDot.to]))).toBe(true);
    }
  });

  it('las cuatro letras de las opciones están dibujadas en la posición final', () => {
    for (const trial of choices(build('seguir-puntos', 5))) {
      if (trial.visual?.kind !== 'puntos') throw new Error('faltan los puntos');
      const letters = trial.visual.dots.flatMap((dot) => (dot.letter ? [dot.letter] : []));
      expect([...letters].sort()).toEqual(trial.options.map((option) => option.id).sort());
    }
  });
});

describe('busca el triángulo', () => {
  it('hay un único triángulo sin girar, y es la respuesta', () => {
    for (const trial of choices(build('busqueda-formas', 6))) {
      const upright = trial.options.filter((option) => {
        const figure = option.visual;
        return figure?.kind === 'figura' && figure.form === 'triangulo' && figure.rotation === 0;
      });
      expect(upright.map((option) => option.id)).toEqual([trial.answerId]);
    }
  });

  it('desde el nivel 4 aparecen triángulos girados como distractores', () => {
    const turned = choices(build('busqueda-formas', 6)).some((trial) =>
      trial.options.some(
        (option) =>
          option.visual?.kind === 'figura' &&
          option.visual.form === 'triangulo' &&
          option.visual.rotation !== 0,
      ),
    );
    expect(turned).toBe(true);
    const plain = choices(build('busqueda-formas', 1)).some((trial) =>
      trial.options.some(
        (option) =>
          option.visual?.kind === 'figura' &&
          option.visual.form === 'triangulo' &&
          option.visual.rotation !== 0,
      ),
    );
    expect(plain).toBe(false);
  });
});

describe('evaluateResponse con los tipos nuevos', () => {
  it('una respuesta anticipada es incorrecta aunque el estímulo fuera objetivo', () => {
    const trial = taps(build('reflejo', 2))[0];
    if (!trial) throw new Error('falta el ensayo');
    expect(
      evaluateResponse(trial, { kind: 'tap', tapped: true, rtMs: null, anticipated: true }),
    ).toEqual({ correct: false, rtMs: null, scorable: true });
  });

  it('una respuesta anticipada también es incorrecta en un ensayo sin estímulo objetivo', () => {
    const trial = taps(build('espera-la-senal', 6, false, 'espera')).find((item) => !item.target);
    if (!trial) throw new Error('falta un ensayo sin objetivo');
    expect(
      evaluateResponse(trial, { kind: 'tap', tapped: true, rtMs: null, anticipated: true }).correct,
    ).toBe(false);
  });

  it('en una elección con dibujo, la respuesta se evalúa por su id', () => {
    const trial = choices(build('cual-no-encaja', 2))[0];
    if (!trial) throw new Error('falta el ensayo');
    expect(
      evaluateResponse(trial, { kind: 'choice', chosenId: trial.answerId, rtMs: 700 }).correct,
    ).toBe(true);
    const wrong = trial.options.find((option) => option.id !== trial.answerId);
    expect(
      evaluateResponse(trial, { kind: 'choice', chosenId: wrong?.id ?? null, rtMs: 700 }).correct,
    ).toBe(false);
  });

  it('una respuesta de toque sin anticipación sigue igual que antes', () => {
    const trial = taps(build('reflejo', 2))[0];
    if (!trial) throw new Error('falta el ensayo');
    expect(evaluateResponse(trial, { kind: 'tap', tapped: true, rtMs: 350 })).toEqual({
      correct: true,
      rtMs: 350,
      scorable: true,
    });
  });
});

describe('figuras y geometría', () => {
  it('reflejar cambia la figura: una flecha reflejada no coincide con la original girada', () => {
    const arrow = makeFigure({ form: 'flecha', size: 'grande' });
    const mirrored = makeFigure({ form: 'flecha', size: 'grande', mirror: true });
    expect(samePoints(outlineOf(arrow), outlineOf(mirrored))).toBe(false);
  });

  it('un círculo no cambia al girarlo', () => {
    const circle = makeFigure({ form: 'circulo', size: 'mediana' });
    expect(figureGeometry({ ...circle, rotation: 90 })).toEqual(figureGeometry(circle));
  });
});
