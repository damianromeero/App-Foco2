import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ChoiceTrial, GameSpec, TapTrial } from '../../domain/games/types';
import type { TrialOutcome } from '../../domain/scoring';
import { GameRunner } from './GameRunner';

const game: GameSpec = {
  id: 'vigilancia',
  category: 'atencion-sostenida',
  modality: 'simbolos',
  name: 'Vigilancia',
  tagline: '',
  instructions: [],
  trialCount: 2,
  typicalTrialMs: 300,
  free: true,
  requiresColor: false,
  build: () => [],
};

const targetTrial: TapTrial = {
  mode: 'tap',
  shape: 'letter',
  display: 'X',
  displayLabel: 'Letra X',
  prompt: 'Toca solo con la X',
  target: true,
  scorable: true,
  showMs: 200,
  isiMs: 100,
};

const otherTrial: TapTrial = {
  ...targetTrial,
  display: 'K',
  displayLabel: 'Letra K',
  target: false,
};

const choiceTrial: ChoiceTrial = {
  mode: 'choice',
  display: '',
  displayLabel: 'Número 3',
  prompt: 'Par o impar',
  options: [
    { id: 'par', label: 'PAR' },
    { id: 'impar', label: 'IMPAR' },
  ],
  answerId: 'impar',
  layout: 'row',
  scorable: true,
  isiMs: 50,
};

/**
 * Avanza el tiempo en pasos cortos. Cada paso va dentro de su propio act,
 * así React procesa los efectos entre ensayos igual que en el navegador.
 */
function run(ms: number): void {
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    act(() => {
      vi.advanceTimersByTime(50);
    });
  }
}

function renderRunner(
  trials: ChoiceTrial[] | TapTrial[],
  onFinish: (outcomes: TrialOutcome[]) => void,
) {
  render(
    <GameRunner game={game} trials={trials} feedback={false} haptics={false} onFinish={onFinish} />,
  );
}

describe('GameRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('un ensayo sin respuesta cuenta como fallo si era objetivo, y como acierto si no lo era', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([targetTrial, otherTrial], onFinish);

    run(600);

    expect(onFinish).toHaveBeenCalledTimes(1);
    const outcomes = onFinish.mock.calls[0]?.[0] ?? [];
    expect(outcomes.map((outcome) => outcome.correct)).toEqual([false, true]);
    expect(outcomes.every((outcome) => outcome.rtMs === null)).toBe(true);
  });

  it('cuenta una sola respuesta por ensayo aunque se toque varias veces', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([targetTrial, otherTrial], onFinish);

    const area = screen.getByRole('button', { name: 'Tocar para responder' });
    fireEvent.click(area);
    fireEvent.click(area);
    fireEvent.click(area);

    run(600);

    const outcomes = onFinish.mock.calls[0]?.[0] ?? [];
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]?.correct).toBe(true);
    expect(outcomes[1]?.correct).toBe(true);
  });

  it('en una elección, la respuesta avanza al intervalo en blanco y se evalúa contra la respuesta correcta', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([choiceTrial], onFinish);

    fireEvent.click(screen.getByRole('button', { name: 'PAR' }));
    run(100);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0][0]?.correct).toBe(false);
  });

  it('una lista vacía termina de inmediato sin resultados', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([], onFinish);
    expect(onFinish).toHaveBeenCalledWith([]);
  });
});

describe('GameRunner con ensayos nuevos', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const waitTrial: TapTrial = {
    ...targetTrial,
    waitMs: 300,
    showMs: 200,
    isiMs: 100,
  };

  it('tocar durante la espera cuenta como respuesta anticipada, aunque el estímulo sea objetivo', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([waitTrial], onFinish);

    expect(screen.getByText('Espera la señal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /No toques todavía/ }));
    run(600);

    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]?.[0]).toEqual([{ correct: false, rtMs: null, scorable: true }]);
  });

  it('después de la espera aparece el estímulo y tocar vale', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([waitTrial], onFinish);

    run(300);
    expect(screen.getByRole('button', { name: 'Tocar para responder' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tocar para responder' }));
    run(600);

    const outcomes = onFinish.mock.calls[0]?.[0] ?? [];
    expect(outcomes[0]?.correct).toBe(true);
    expect(outcomes[0]?.rtMs).not.toBeNull();
  });

  it('en la vista previa no aparecen las opciones hasta que termina', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    const previewTrial: ChoiceTrial = {
      ...choiceTrial,
      preview: {
        visual: { kind: 'cuadricula', columns: 2, lit: [0] },
        ms: 200,
        label: 'Luz en la fila 1, columna 1.',
      },
    };
    renderRunner([previewTrial], onFinish);

    expect(screen.queryByRole('button', { name: 'PAR' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Luz en la fila 1, columna 1.' })).toBeInTheDocument();

    run(200);
    fireEvent.click(screen.getByRole('button', { name: 'PAR' }));
    run(100);
    expect(onFinish.mock.calls[0]?.[0][0]?.correct).toBe(false);
  });

  it('las opciones sin texto tienen nombre accesible', () => {
    const cellTrial: ChoiceTrial = {
      ...choiceTrial,
      layout: 'grid',
      columns: 2,
      options: [
        { id: 'a', label: '', ariaLabel: 'Fila 1, columna 1' },
        { id: 'b', label: '', ariaLabel: 'Fila 1, columna 2' },
      ],
      answerId: 'b',
    };
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([cellTrial], onFinish);

    fireEvent.click(screen.getByRole('button', { name: 'Fila 1, columna 2' }));
    run(100);
    expect(onFinish.mock.calls[0]?.[0][0]?.correct).toBe(true);
  });

  it('sin audio disponible, la serie de tonos lo dice en pantalla y se sigue jugando', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    const toneTrial: ChoiceTrial = {
      ...choiceTrial,
      visual: {
        kind: 'tonos',
        tones: [
          { hz: 440, ms: 200 },
          { hz: 660, ms: 200 },
        ],
        gapMs: 100,
      },
    };
    renderRunner([toneTrial], onFinish);

    expect(screen.getByText(/no puede reproducir sonido/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reproducir los sonidos' }));
    fireEvent.click(screen.getByRole('button', { name: 'PAR' }));
    run(100);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('una elección con tiempo agotado cuenta como fallo si la opción correcta existía', () => {
    const onFinish = vi.fn<(outcomes: TrialOutcome[]) => void>();
    renderRunner([{ ...choiceTrial, limitMs: 300 }], onFinish);
    run(400);
    expect(onFinish.mock.calls[0]?.[0][0]?.correct).toBe(false);
  });
});
