import { median, summarize } from './scoring';

describe('median', () => {
  it('devuelve null con una lista vacía', () => {
    expect(median([])).toBeNull();
  });

  it('devuelve el central en listas impares y la media de los centrales en pares', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
  });
});

describe('summarize', () => {
  it('ignora los ensayos que no puntúan', () => {
    const summary = summarize([
      { correct: false, rtMs: 900, scorable: false },
      { correct: true, rtMs: 400, scorable: true },
      { correct: false, rtMs: 700, scorable: true },
      { correct: true, rtMs: 500, scorable: true },
    ]);
    expect(summary.scorable).toBe(3);
    expect(summary.correct).toBe(2);
    expect(summary.accuracy).toBe(0.6667);
    expect(summary.medianRtMs).toBe(450);
  });

  it('no mide reacción en los fallos ni en los ensayos sin respuesta', () => {
    const summary = summarize([
      { correct: false, rtMs: 300, scorable: true },
      { correct: true, rtMs: null, scorable: true },
    ]);
    expect(summary.medianRtMs).toBeNull();
    expect(summary.accuracy).toBe(0.5);
  });

  it('una partida sin ensayos puntuables tiene precisión 0', () => {
    expect(summarize([])).toEqual({ scorable: 0, correct: 0, accuracy: 0, medianRtMs: null });
  });
});
