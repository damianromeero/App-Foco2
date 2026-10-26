import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'premium';
export type ButtonSize = 'md' | 'lg';

const BASE =
  'pressable sheen inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-2xl font-semibold tracking-[-0.01em] disabled:cursor-not-allowed disabled:opacity-40';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'fill-brand text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.5),var(--shadow-glow)] hover:brightness-110 active:brightness-95',
  secondary: 'glass ring-gradient text-ink hover:brightness-125',
  ghost: 'text-ink hover:bg-glass',
  danger: 'bg-danger text-canvas hover:brightness-110',
  premium:
    'fill-gold text-premium-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_14px_40px_-14px_rgb(245_181_74/0.7)] hover:brightness-105',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'min-h-12 px-5 text-[0.95rem]',
  lg: 'min-h-14 px-6 text-[1.02rem]',
};

/** Clases de botón compartidas por <Button> y <LinkButton>. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return [BASE, VARIANTS[variant], SIZES[size], extra].filter(Boolean).join(' ');
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

interface LinkButtonProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function LinkButton({ variant, size, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
