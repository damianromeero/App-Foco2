import { audioSupported, barHeightPercent, playTimeline, toneTimeline } from './tones';

describe('toneTimeline', () => {
  it('coloca cada tono detrás del anterior, separado por el hueco', () => {
    expect(
      toneTimeline(
        [
          { hz: 440, ms: 200 },
          { hz: 660, ms: 300 },
        ],
        100,
      ),
    ).toEqual([
      { hz: 440, startMs: 0, endMs: 200 },
      { hz: 660, startMs: 300, endMs: 600 },
    ]);
  });

  it('una lista vacía no tiene horario', () => {
    expect(toneTimeline([], 100)).toEqual([]);
  });
});

describe('barHeightPercent', () => {
  it('los tonos más agudos tienen barras más altas, dentro de límites visibles', () => {
    expect(barHeightPercent(300)).toBeLessThan(barHeightPercent(600));
    expect(barHeightPercent(100)).toBeGreaterThanOrEqual(20);
    expect(barHeightPercent(5000)).toBeLessThanOrEqual(95);
  });
});

describe('audio sin Web Audio', () => {
  it('en un entorno sin AudioContext se declara no disponible y no reproduce', () => {
    expect(audioSupported()).toBe(false);
    expect(playTimeline(toneTimeline([{ hz: 440, ms: 100 }], 0))).toBe(false);
  });
});
