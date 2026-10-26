import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BrainIcon,
  EyeIcon,
  HandPalmIcon,
  LockIcon,
  MagnifyingGlassIcon,
  type IconProps,
} from '@phosphor-icons/react';
import type { ComponentType, CSSProperties } from 'react';
import { Link } from 'react-router';
import { Badge, Card, PageHeader } from '../../components/ui/Surfaces';
import { LinkButton } from '../../components/ui/Button';
import { CATEGORIES, GAMES } from '../../domain/games/registry';
import type { CategoryId } from '../../domain/games/types';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';

/** Icono y color de cada familia de juegos. Los colores son tokens del tema, también en modo oscuro. */
const CATEGORY_GLYPH: Record<CategoryId, { icon: ComponentType<IconProps>; color: string }> = {
  'atencion-sostenida': { icon: EyeIcon, color: 'var(--c-aurora-a)' },
  'control-inhibitorio': { icon: HandPalmIcon, color: 'var(--c-accent)' },
  'memoria-de-trabajo': { icon: BrainIcon, color: 'var(--c-aurora-c)' },
  flexibilidad: { icon: ArrowsClockwiseIcon, color: 'var(--c-aurora-b)' },
  'atencion-selectiva': { icon: MagnifyingGlassIcon, color: 'var(--c-stroop-azul)' },
};

function Glyph({ category }: { category: CategoryId }) {
  const { icon: Icon, color } = CATEGORY_GLYPH[category];
  const style: CSSProperties = {
    color,
    backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 34%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.2)`,
  };
  return (
    <span
      aria-hidden="true"
      className="grid size-12 shrink-0 place-items-center rounded-2xl"
      style={style}
    >
      <Icon size={26} weight="duotone" />
    </span>
  );
}

export default function Library() {
  useDocumentMeta({
    title: 'Biblioteca',
    description:
      'Juegos breves de atención, control de impulsos, memoria de trabajo y cambio de tarea.',
  });
  const entitlement = useEntitlement();
  const sinColor = useAppStore((state) => state.settings.sinColor);

  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="pixel-accent">Biblioteca</span>}
        lead="Practica cualquier juego cuando quieras. Las partidas de práctica no cuentan para la racha, pero sí ajustan tu nivel."
      />

      <ul className="grid gap-4 lg:grid-cols-2">
        {GAMES.map((game, index) => {
          const locked = !game.free && entitlement !== 'premium';
          const unavailable = sinColor && game.requiresColor;
          return (
            <li
              key={game.id}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <Card as="article" labelledBy={`juego-${game.id}`} className="h-full">
                <div className="flex h-full flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <Glyph category={game.category} />
                    {!game.free && <Badge tone="premium">Premium</Badge>}
                  </div>
                  <div className="space-y-2">
                    <p className="eyebrow">{CATEGORIES[game.category].label}</p>
                    <h2 id={`juego-${game.id}`} className="text-2xl">
                      {game.name}
                    </h2>
                    <p className="text-ink-soft">{game.tagline}</p>
                  </div>
                  <div className="mt-auto pt-1">
                    {unavailable ? (
                      <p className="text-base text-ink-soft">
                        No disponible en el modo sin colores.
                      </p>
                    ) : locked ? (
                      <LinkButton to="/precios" variant="premium" className="w-full">
                        <LockIcon size={18} weight="fill" aria-hidden="true" />
                        {'Desbloquear con\u00a0Premium'}
                      </LinkButton>
                    ) : (
                      <LinkButton
                        to={`/practica/${game.id}`}
                        variant="secondary"
                        className="w-full"
                      >
                        Practicar
                      </LinkButton>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Link
        to="/ciencia"
        className="glass ring-gradient animate-fade-up flex min-h-12 items-center justify-between gap-3 rounded-2xl px-5 py-4 font-semibold text-ink"
        style={{ animationDelay: `${GAMES.length * 70}ms` }}
      >
        Qué dice la ciencia sobre estos juegos
        <ArrowRightIcon
          size={20}
          weight="bold"
          className="shrink-0 text-brand"
          aria-hidden="true"
        />
      </Link>
    </div>
  );
}
