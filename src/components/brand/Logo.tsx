import { useId } from 'react';
import { Link } from 'react-router';
import { plantilla } from '../../config/plantilla';
import {
  MARCA_A,
  MARCA_DEGRADADO,
  MARCA_PUNTO,
  MARCA_RADIO,
  NOMBRE_ANCHO,
  NOMBRE_TRAZO,
} from './marca';

/**
 * Símbolo de la marca: la «A» blanca en arco con su punto dorado, sobre el degradado verde, azul y violeta.
 * Lleva su propio degradado (con id único), así que funciona en cualquier pantalla.
 */
export function LogoMark({ className = 'size-9' }: { className?: string }) {
  const gradientId = `marca-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          {MARCA_DEGRADADO.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx={MARCA_RADIO} fill={`url(#${gradientId})`} />
      <path fill="#fff" d={MARCA_A} />
      <circle cx={MARCA_PUNTO.cx} cy={MARCA_PUNTO.cy} r={MARCA_PUNTO.r} fill="#FDE68A" />
    </svg>
  );
}

/** Nombre dibujado con la tipografía del logo. Toma el color del texto: negro en modo claro, blanco en oscuro. */
export function LogoNombre({ className = 'h-9' }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${NOMBRE_ANCHO} 64`}
      aria-hidden="true"
      className={`w-auto ${className}`}
      fill="currentColor"
    >
      <path d={NOMBRE_TRAZO} />
    </svg>
  );
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-ink">
      <LogoMark />
      <LogoNombre />
      <span className="sr-only">{plantilla.nombre}</span>
    </Link>
  );
}
