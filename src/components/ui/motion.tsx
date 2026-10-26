import { AnimatePresence, motion, type Variants } from 'motion/react';
import type { ReactNode } from 'react';

/** Curva de entrada: rápida al principio y asentada al final. Es la misma para toda la app. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Una fase completa de una sesión o de un juego: introducción, ensayos, resumen, reflexión. */
export const phaseVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2, ease: 'easeIn' } },
};

/**
 * El estímulo de cada ensayo. No empieza en opacidad cero: el tiempo de reacción se mide desde
 * que aparece, así que tiene que verse completo desde el primer frame. Solo hay un leve asentamiento.
 */
export const stimulusVariants: Variants = {
  initial: { opacity: 0.6, scale: 0.97 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } },
};

/** El enunciado cambia con una caída corta: el ojo sigue el texto sin que la pantalla salte. */
export const promptVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: 'easeOut' } },
};

/** La marca de acierto o fallo: aparece con un pequeño rebote y se retira sin ruido. */
export const markVariants: Variants = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 28 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.16, ease: 'easeOut' } },
};

/** Palabra de la respiración («Inhala», «Exhala»): sube suave al cambiar de tiempo. */
export const cueVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.22, ease: 'easeIn' } },
};

/**
 * Cambio entre fases. Cuando cambia la clave, la fase anterior se retira y la nueva entra.
 * "popLayout" saca de la distribución a la que se va, así que no hay saltos de altura mientras se cruzan.
 */
export function PhaseSwitch({ phaseKey, children }: { phaseKey: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={phaseKey}
        variants={phaseVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
