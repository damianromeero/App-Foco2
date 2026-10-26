import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { useAppStore } from '../../store/appStore';

/** Fondo ambiental: tres resplandores de marca que derivan muy despacio. Va detrás de todo. */
export function Ambient() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-[18%] -left-[22%] size-[78vmax] rounded-full bg-[radial-gradient(closest-side,var(--c-glow-1),transparent)]" />
      <div className="absolute top-[28%] -right-[28%] size-[70vmax] rounded-full bg-[radial-gradient(closest-side,var(--c-glow-2),transparent)]" />
      <div className="absolute -bottom-[30%] left-[4%] size-[72vmax] rounded-full bg-[radial-gradient(closest-side,var(--c-glow-3),transparent)]" />
    </div>
  );
}

/**
 * Definiciones de degradado para iconos. Un icono con la clase "icon-aurora" o "icon-gold"
 * se pinta con el degradado de marca o dorado. Estar fuera de pantalla no lo oculta.
 */
export function GradientDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      className="pointer-events-none absolute size-0 overflow-hidden"
    >
      <defs>
        <linearGradient id="grad-aurora-icon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--c-aurora-a)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--c-aurora-b)' }} />
          <stop offset="1" style={{ stopColor: 'var(--c-aurora-c)' }} />
        </linearGradient>
        <linearGradient id="grad-gold-icon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--c-gold-a)' }} />
          <stop offset="0.55" style={{ stopColor: 'var(--c-gold-b)' }} />
          <stop offset="1" style={{ stopColor: 'var(--c-gold-c)' }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Aplica el ajuste de movimiento de la app a Motion: "sistema" sigue al sistema operativo. */
export function MotionRoot({ children }: { children: ReactNode }) {
  const reduceMotion = useAppStore((state) => state.settings.reduceMotion);
  const reducedMotion = reduceMotion === 'si' ? 'always' : reduceMotion === 'no' ? 'never' : 'user';
  return <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>;
}
