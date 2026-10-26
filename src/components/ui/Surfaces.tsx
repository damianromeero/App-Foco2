import type { ReactNode } from 'react';

type Tone = 'neutral' | 'brand' | 'premium' | 'accent' | 'danger';

const TONES: Record<Tone, string> = {
  neutral: 'glass ring-1 ring-inset ring-line text-ink-soft',
  brand: 'bg-brand-soft text-brand ring-1 ring-inset ring-brand/20',
  premium: 'fill-gold text-premium-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6)]',
  accent: 'bg-accent/12 text-accent-text ring-1 ring-inset ring-accent/25',
  danger: 'bg-danger/12 text-danger-text ring-1 ring-inset ring-danger/25',
};

/** Etiqueta pequeña. Premium usa un degradado dorado: es la única pieza dorada de la app. */
export function Badge({
  tone = 'neutral',
  children,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[0.66rem] font-medium uppercase tracking-[0.1em] ${TONES[tone]}`}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]"
        />
      )}
      {children}
    </span>
  );
}

type CardVariant = 'glass' | 'solid' | 'hero';

interface CardProps {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
  labelledBy?: string;
  variant?: CardVariant;
}

const CARD_VARIANTS: Record<CardVariant, string> = {
  glass: 'glass ring-gradient',
  solid: 'bg-surface ring-gradient shadow-soft',
  hero: 'glass ring-gradient',
};

/**
 * Superficie de contenido. "glass" es el cristal por defecto, con brillo en el borde.
 * "hero" añade un resplandor de marca en una esquina: para la tarjeta principal de cada pantalla.
 */
export function Card({
  children,
  className = '',
  as: Tag = 'section',
  labelledBy,
  variant = 'glass',
}: CardProps) {
  return (
    <Tag
      aria-labelledby={labelledBy}
      className={`relative overflow-hidden rounded-card p-5 sm:p-6 ${CARD_VARIANTS[variant]} ${className}`}
    >
      {variant === 'hero' && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-[radial-gradient(closest-side,var(--c-glow-1),transparent)]"
        />
      )}
      <div className="relative h-full">{children}</div>
    </Tag>
  );
}

export function SectionTitle({
  id,
  eyebrow,
  children,
  className = '',
}: {
  id?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && (
        <p className="eyebrow flex items-center gap-2 text-brand">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_currentColor]"
          />
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="mt-3 text-[2rem] leading-[1.04] sm:text-[2.6rem]">
        {children}
      </h2>
    </div>
  );
}

/** Encabezado de pantalla: etiqueta, titular grande con una palabra en cursiva y texto de apoyo. */
export function PageHeader({
  id,
  eyebrow,
  title,
  lead,
  actions,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="animate-fade-up space-y-4 pt-2">
      {eyebrow && (
        <p className="eyebrow flex items-center gap-2 text-brand">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_currentColor]"
          />
          {eyebrow}
        </p>
      )}
      <h1 id={id} className="text-[2.5rem] leading-[0.98] sm:text-6xl">
        {title}
      </h1>
      {lead && <p className="max-w-prose text-[1.05rem] leading-relaxed text-ink-soft">{lead}</p>}
      {actions && <div className="pt-1">{actions}</div>}
    </header>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'brand',
}: {
  value: number;
  label: string;
  tone?: 'brand' | 'premium' | 'accent';
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const fill = tone === 'premium' ? 'fill-gold' : tone === 'accent' ? 'bg-accent' : 'fill-brand';
  const glow =
    tone === 'premium'
      ? 'shadow-[0_0_14px_-2px_rgb(245_181_74/0.7)]'
      : 'shadow-[0_0_14px_-2px_var(--c-brand)]';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 w-full overflow-hidden rounded-full bg-glass ring-1 ring-inset ring-line"
    >
      <div
        className={`h-full rounded-full transition-[width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${fill} ${glow}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function Notice({
  tone = 'neutral',
  title,
  children,
  action,
}: {
  tone?: 'neutral' | 'premium' | 'accent' | 'success';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const styles = {
    neutral: 'glass ring-1 ring-inset ring-line',
    premium: 'bg-premium/10 ring-1 ring-inset ring-premium/30',
    accent: 'bg-accent/10 ring-1 ring-inset ring-accent/30',
    success: 'bg-brand-soft ring-1 ring-inset ring-brand/25',
  } as const;
  return (
    <div
      role="status"
      className={`animate-fade-up flex flex-col gap-3 rounded-2xl p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between ${styles[tone]}`}
    >
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-base text-ink-soft">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
