import { CompassIcon } from '@phosphor-icons/react';
import { LinkButton } from '../../components/ui/Button';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { plantilla } from '../../config/plantilla';

export default function NotFound() {
  useDocumentMeta({
    title: 'Página no encontrada',
    description: `Esta página no existe. Vuelve a ${plantilla.nombre} para seguir entrenando.`,
  });
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="relative animate-fade-up">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-12 rounded-full bg-[radial-gradient(closest-side,var(--c-glow-1),transparent)]"
        />
        <CompassIcon
          size={96}
          weight="duotone"
          className="icon-aurora relative"
          aria-hidden="true"
        />
      </div>
      <p
        className="figure text-aurora animate-fade-up text-[4.5rem]"
        style={{ animationDelay: '80ms' }}
      >
        404
      </p>
      <div className="animate-fade-up space-y-4" style={{ animationDelay: '160ms' }}>
        <h1 className="text-4xl sm:text-5xl">
          Esta página no <span className="pixel-accent">existe</span>.
        </h1>
        <p className="text-lg text-ink-soft">Quizá el enlace ha cambiado. Volvamos a tu foco.</p>
      </div>
      <LinkButton to="/" size="lg" className="animate-fade-up" style={{ animationDelay: '240ms' }}>
        Ir al inicio
      </LinkButton>
    </div>
  );
}
