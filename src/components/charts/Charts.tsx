import { useId } from 'react';
import { roundTo } from '../../domain/math';

export interface BarDatum {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
}

/** Id estable para degradados dentro del gráfico. useId trae dos puntos, que no sirven en url(). */
function useGradientId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}

/** Barras accesibles: cada barra tiene su texto y el gráfico se describe entero para lectores de pantalla. */
export function BarChart({ data, ariaLabel }: { data: readonly BarDatum[]; ariaLabel: string }) {
  const gradient = useGradientId('bar');
  const max = Math.max(1, ...data.map((item) => item.value));
  const width = 280;
  const height = 120;
  const gap = 12;
  const barWidth = (width - gap * (data.length - 1)) / Math.max(1, data.length);
  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        role="img"
        aria-label={ariaLabel}
        className="h-44 w-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--c-aurora-b)' }} />
            <stop offset="1" style={{ stopColor: 'var(--c-aurora-a)' }} />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((step) => (
          <line
            key={step}
            x1={0}
            x2={width}
            y1={height * (1 - step)}
            y2={height * (1 - step)}
            strokeDasharray="2 6"
            className="stroke-ink/12"
          />
        ))}
        {data.map((item, index) => {
          const barHeight = (item.value / max) * height;
          const x = index * (barWidth + gap);
          return (
            <g key={`${item.label}-${index}`}>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={Math.max(barHeight, 4)}
                rx={7}
                fill={item.highlight ? `url(#${gradient})` : undefined}
                className={
                  item.highlight ? 'drop-shadow-[0_6px_14px_var(--c-glow-1)]' : 'fill-ink/10'
                }
              />
              <text
                x={x + barWidth / 2}
                y={height + 18}
                textAnchor="middle"
                className="fill-ink-soft font-mono text-[11px] uppercase"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {data.map((item) => (
            <tr key={item.label}>
              <th scope="row">{item.label}</th>
              <td>{item.hint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface LinePoint {
  label: string;
  value: number;
}

/** Línea de precisión (0–100 %). Incluye la tabla equivalente para quien no ve el gráfico. */
export function LineChart({
  points,
  ariaLabel,
}: {
  points: readonly LinePoint[];
  ariaLabel: string;
}) {
  const lineGradient = useGradientId('line');
  const areaGradient = useGradientId('area');
  const width = 320;
  const height = 140;
  const padding = 12;
  const count = points.length;
  const x = (index: number) =>
    count <= 1 ? width / 2 : padding + (index * (width - padding * 2)) / (count - 1);
  const y = (value: number) =>
    padding + (1 - Math.min(1, Math.max(0, value))) * (height - padding * 2);
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(point.value)}`)
    .join(' ');
  const area =
    count > 1 ? `${path} L${x(count - 1)},${height - padding} L${x(0)},${height - padding} Z` : '';
  return (
    <figure className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel}
        className="h-44 w-full overflow-visible"
      >
        <defs>
          <linearGradient
            id={lineGradient}
            gradientUnits="userSpaceOnUse"
            x1={padding}
            x2={width - padding}
            y1={0}
            y2={0}
          >
            <stop offset="0" style={{ stopColor: 'var(--c-aurora-a)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--c-aurora-b)' }} />
            <stop offset="1" style={{ stopColor: 'var(--c-aurora-c)' }} />
          </linearGradient>
          <linearGradient
            id={areaGradient}
            gradientUnits="userSpaceOnUse"
            x1={0}
            x2={0}
            y1={padding}
            y2={height - padding}
          >
            <stop offset="0" style={{ stopColor: 'var(--c-aurora-a)', stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: 'var(--c-aurora-a)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <line
          x1={padding}
          x2={width - padding}
          y1={y(0.8)}
          y2={y(0.8)}
          strokeDasharray="4 6"
          className="stroke-accent/60"
        />
        {area && <path d={area} fill={`url(#${areaGradient})`} />}
        {count > 1 && (
          <path
            d={path}
            fill="none"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            stroke={`url(#${lineGradient})`}
            className="drop-shadow-[0_4px_10px_var(--c-glow-1)]"
          />
        )}
        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={x(index)}
            cy={y(point.value)}
            r={4.5}
            strokeWidth={2.5}
            style={{ fill: 'var(--c-canvas)', stroke: 'var(--c-aurora-b)' }}
          />
        ))}
      </svg>
      <p className="text-xs text-ink-soft">
        Línea discontinua: 80 % de precisión, la meta del reto de precisión.
      </p>
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.label}>
              <th scope="row">{point.label}</th>
              <td>{`${roundTo(point.value * 100, 0)} %`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Anillo de precisión con el porcentaje en el centro. */
export function Ring({
  value,
  label,
  size = 120,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const gradient = useGradientId('ring');
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        role="img"
        aria-label={`${label}: ${percent} %`}
        className="size-full -rotate-90 drop-shadow-[0_0_12px_var(--c-glow-1)]"
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--c-aurora-a)' }} />
            <stop offset="0.55" style={{ stopColor: 'var(--c-aurora-b)' }} />
            <stop offset="1" style={{ stopColor: 'var(--c-aurora-c)' }} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="9" className="stroke-ink/10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          stroke={`url(#${gradient})`}
          className="transition-[stroke-dashoffset] duration-700 motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden="true" className="figure absolute text-[2rem]">
        {percent} %
      </span>
    </div>
  );
}
