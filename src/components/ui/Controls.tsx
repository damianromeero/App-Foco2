import { motion } from 'motion/react';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

const SPRING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as const;

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p id={`${id}-label`} className="leading-snug font-medium">
          {label}
        </p>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-base text-ink-soft">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onClick={() => {
          onChange(!checked);
        }}
        className={`pressable relative inline-flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-[background,box-shadow] duration-300 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] ${checked ? 'fill-brand shadow-[var(--shadow-glow)]' : 'glass ring-1 ring-inset ring-line-strong'}`}
      >
        <motion.span
          aria-hidden="true"
          className="block size-6 rounded-full bg-white shadow-[0_2px_10px_rgb(0_0_0/0.35)]"
          animate={{ x: checked ? 24 : 0 }}
          transition={SPRING}
        />
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/**
 * Opciones excluyentes. Con pocas opciones cortas se muestra como control segmentado con un indicador
 * que se desliza; con descripciones, como lista de filas de cristal. Ambas usan radios nativos:
 * teclado y lector de pantalla funcionan sin trabajo extra.
 */
export function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
  columns = 2,
}: {
  legend: string;
  options: readonly SegmentOption<T>[];
  /** Null cuando todavía no se ha elegido nada: ninguna opción aparece seleccionada. */
  value: T | null;
  onChange: (next: T) => void;
  columns?: 1 | 2 | 3;
}) {
  const name = useId();
  const compact = options.length <= 3 && options.every((option) => !option.description);

  if (compact) {
    return (
      <fieldset className="space-y-3">
        <legend className="mb-3 font-semibold">{legend}</legend>
        <div
          className="glass ring-gradient grid gap-1 rounded-2xl p-1"
          style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <label
                key={option.value}
                className="pressable relative flex min-h-11 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus"
              >
                <input
                  type="radio"
                  name={name}
                  value={option.value}
                  checked={selected}
                  onChange={() => {
                    onChange(option.value);
                  }}
                  className="sr-only"
                />
                {selected && (
                  <motion.span
                    layoutId={`${name}-pill`}
                    className="fill-brand absolute inset-0 -z-0 rounded-xl shadow-[var(--shadow-glow)]"
                    transition={SPRING}
                  />
                )}
                <span className={`relative ${selected ? 'text-brand-ink' : 'text-ink-soft'}`}>
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  const gridCols = columns === 1 ? '' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <fieldset>
      <legend className="mb-3 font-semibold">{legend}</legend>
      <div className={`grid gap-2.5 ${gridCols}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`pressable flex min-h-14 cursor-pointer items-start gap-4 rounded-2xl p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${selected ? 'glass ring-gradient' : 'ring-1 ring-inset ring-line hover:bg-glass'}`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => {
                  onChange(option.value);
                }}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1 ring-inset transition-colors ${selected ? 'ring-brand' : 'ring-line-strong'}`}
              >
                <motion.span
                  className="fill-brand block size-2.5 rounded-full"
                  initial={false}
                  animate={{ scale: selected ? 1 : 0 }}
                  transition={SPRING}
                />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-ink">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block text-base text-ink-soft">{option.description}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Pestañas con flechas del teclado, para cambiar entre vistas de una misma página. */
export function Tabs<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: ReactNode }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const step = keys[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="scroll-x-snap glass ring-gradient -mx-4 flex gap-1 overflow-x-auto rounded-2xl p-1 px-4 sm:mx-0 sm:px-1"
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onKeyDown={(event) => {
              move(event, index);
            }}
            onClick={() => {
              onChange(option.value);
            }}
            className={`pressable relative min-h-11 shrink-0 snap-start rounded-xl px-4 text-sm font-semibold transition-colors ${selected ? 'text-brand-ink' : 'text-ink-soft hover:text-ink'}`}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-tab`}
                className="fill-brand absolute inset-0 rounded-xl shadow-[var(--shadow-glow)]"
                transition={SPRING}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
