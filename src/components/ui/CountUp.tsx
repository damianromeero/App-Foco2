import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Cifra que sube hasta su valor final. Con movimiento reducido aparece directamente.
 * El valor final siempre está en el DOM: los lectores de pantalla no esperan a la animación.
 */
export function CountUp({
  value,
  duration = 1.1,
  format = (n: number) => Math.round(n).toString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        setAnimated(latest);
      },
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      controls.stop();
    };
  }, [value, duration, reduce]);

  // Con movimiento reducido se muestra el valor final sin pasar por la animación.
  const shown = reduce ? value : animated;

  return (
    <span className={className}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
