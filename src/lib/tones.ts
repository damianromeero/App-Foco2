import type { Tone } from '../domain/games/types';

export interface TimedTone {
  hz: number;
  startMs: number;
  endMs: number;
}

/** Horario de cada tono: uno detrás de otro, separados por el hueco indicado. Es puro, así que se puede probar sin audio. */
export function toneTimeline(tones: readonly Tone[], gapMs: number): TimedTone[] {
  let cursor = 0;
  return tones.map((tone) => {
    const timed: TimedTone = { hz: tone.hz, startMs: cursor, endMs: cursor + tone.ms };
    cursor += tone.ms + gapMs;
    return timed;
  });
}

/** Altura de la barra que sustituye al sonido, en porcentaje: escala logarítmica entre 250 y 700 Hz. */
export function barHeightPercent(hz: number): number {
  const ratio = (Math.log2(hz) - Math.log2(250)) / (Math.log2(700) - Math.log2(250));
  return Math.round(Math.min(95, Math.max(20, 20 + ratio * 75)));
}

type AudioContextConstructor = typeof AudioContext;

interface AudioWindow {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
}

function contextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const audioWindow = window as unknown as AudioWindow;
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

/** Cierto si el navegador puede reproducir sonido con Web Audio. */
export function audioSupported(): boolean {
  return contextConstructor() !== undefined;
}

/** Un solo contexto para toda la app, creado en el primer toque del usuario. */
let sharedContext: AudioContext | null = null;

/**
 * Reproduce los tonos. Solo se llama desde un toque del usuario, así el navegador deja crear el contexto.
 * Devuelve false si no hay audio disponible o si falla; quien llama muestra la alternativa visual.
 */
export function playTimeline(timeline: readonly TimedTone[]): boolean {
  const Constructor = contextConstructor();
  if (!Constructor) return false;
  try {
    sharedContext ??= new Constructor();
    const context = sharedContext;
    if (context.state === 'suspended') void context.resume();
    const origin = context.currentTime + 0.05;
    for (const tone of timeline) {
      const start = origin + tone.startMs / 1000;
      const end = origin + tone.endMs / 1000;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = tone.hz;
      // Envolvente corta para que el tono no haga clic al empezar ni al acabar.
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.015);
      gain.gain.setValueAtTime(0.15, Math.max(start + 0.02, end - 0.03));
      gain.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}
