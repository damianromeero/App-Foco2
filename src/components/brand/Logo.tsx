import { Link } from 'react-router';
import { plantilla } from '../../config/plantilla';

/**
 * Símbolo: un anillo de luz (el foco) sobre un degradado de marca, con un núcleo dorado.
 * Usa el degradado definido en GradientDefs, así que siempre debe montarse dentro de la app.
 */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="18" fill="url(#grad-aurora-icon)" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="17.25"
        fill="none"
        stroke="rgb(255 255 255 / 0.35)"
        strokeWidth="1.5"
      />
      <circle cx="32" cy="32" r="16" fill="none" stroke="rgb(255 255 255 / 0.95)" strokeWidth="5" />
      <circle cx="32" cy="32" r="6" fill="#FDE68A" />
    </svg>
  );
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-2.5 rounded-lg">
      <LogoMark />
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em] whitespace-nowrap">
        {plantilla.nombre}
      </span>
    </Link>
  );
}
