import { useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircleIcon, XCircleIcon } from '@phosphor-icons/react';
import { LinkButton } from '../../components/ui/Button';
import { Card, Notice } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { TRIAL_DAYS } from '../../domain/pricing';
import { useBillingStore } from '../../store/billingStore';
import { plantilla } from '../../config/plantilla';

/** Tarjeta única de resumen: un estado, un mensaje y una acción principal. */
function Summary({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md pt-4">
      <Card variant="hero" className="animate-fade-up">
        <div className="space-y-6">{children}</div>
      </Card>
    </div>
  );
}

/** Pantalla de retorno del pago. Lee el estado real de la suscripción en lugar de fiarse de la URL. */
export default function Checkout() {
  useDocumentMeta({
    title: 'Pago',
    description: `Plan y pago de ${plantilla.nombre}.`,
  });
  const [params] = useSearchParams();
  const status = params.get('estado');
  const refresh = useBillingStore((state) => state.refresh);
  const view = useBillingStore((state) => state.snapshot);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (status === 'ok') {
    const started = view.status === 'trialing' || view.status === 'active';
    return (
      <Summary>
        <CheckCircleIcon size={56} weight="duotone" className="icon-aurora" aria-hidden="true" />
        <h1 className="text-4xl leading-[1.02]">
          {started ? (
            <>
              Tu prueba ha <span className="pixel-accent">empezado</span>.
            </>
          ) : (
            <>
              Estamos confirmando tu <span className="pixel-accent">pago</span>…
            </>
          )}
        </h1>
        <Notice
          tone="success"
          title={started ? 'Acceso completo activado.' : 'Esto puede tardar unos segundos.'}
        >
          {started
            ? `Tienes ${TRIAL_DAYS} días con acceso completo. Te avisaremos tres días antes del primer cobro.`
            : 'Si no cambia en un minuto, recarga la página o revisa Cuenta.'}
        </Notice>
        <LinkButton to="/hoy" size="lg" className="w-full">
          Ir a Hoy
        </LinkButton>
      </Summary>
    );
  }

  if (status === 'cancelado') {
    return (
      <Summary>
        <XCircleIcon size={56} weight="duotone" className="text-ink-soft" aria-hidden="true" />
        <h1 className="text-4xl leading-[1.02]">
          No se ha cobrado <span className="pixel-accent">nada</span>.
        </h1>
        <p className="text-ink-soft">
          Puedes seguir con el plan gratuito o volver a elegir cuando quieras.
        </p>
        <div className="flex flex-col gap-3">
          <LinkButton to="/precios" size="lg" className="w-full">
            Volver a los planes
          </LinkButton>
          <LinkButton to="/hoy" variant="ghost" className="w-full">
            Ir a Hoy
          </LinkButton>
        </div>
      </Summary>
    );
  }

  return (
    <Summary>
      <h1 className="text-4xl leading-[1.02]">
        Aquí verás el estado de tu <span className="pixel-accent">pago</span>.
      </h1>
      <p className="text-ink-soft">
        Esta página aparece al volver de la pasarela de pago. Para revisar tu suscripción, ve a
        Cuenta.
      </p>
      <LinkButton to="/cuenta" size="lg" className="w-full">
        Ir a Cuenta
      </LinkButton>
    </Summary>
  );
}
