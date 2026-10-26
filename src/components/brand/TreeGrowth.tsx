import { clamp } from '../../domain/math';

/**
 * Brote que crece con las sesiones completadas. Es decorativo: el dato real está en el texto de la página.
 * La copa usa el degradado de marca y la estrella de la quinta etapa, el dorado. Crece despacio.
 */
export function TreeGrowth({
  stage,
  className = 'size-40',
}: {
  stage: number;
  className?: string;
}) {
  const level = clamp(Math.round(stage), 0, 5);
  const crown = 6 + level * 5;
  const trunk = 6 + level * 6;
  const top = 108 - trunk - 14;
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={className}>
      <ellipse cx="60" cy="108" rx="40" ry="6" className="fill-brand/15" />
      <rect
        x={60 - 2.5}
        y={top}
        width="5"
        height={trunk + 14}
        rx="2.5"
        className="fill-ink-soft/70 transition-all duration-700 motion-reduce:transition-none"
      />
      {level === 0 && <circle cx="60" cy="92" r="4" className="fill-brand" />}
      {level > 0 && (
        <g className="icon-aurora transition-all duration-700 motion-reduce:transition-none">
          <circle cx="60" cy={top} r={crown} />
          {level >= 3 && <circle cx={60 - crown * 0.8} cy={top + crown * 0.3} r={crown * 0.6} />}
          {level >= 4 && <circle cx={60 + crown * 0.8} cy={top + crown * 0.3} r={crown * 0.6} />}
        </g>
      )}
      {level >= 5 && (
        <g className="icon-gold">
          <circle cx="60" cy={top - crown * 0.7} r={crown * 0.45} />
        </g>
      )}
    </svg>
  );
}
