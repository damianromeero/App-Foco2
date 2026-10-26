import {
  BookOpenTextIcon,
  ChartLineUpIcon,
  CheckIcon,
  LeafIcon,
  TargetIcon,
  TimerIcon,
  TrophyIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GAMES } from '../../domain/games/registry';
import {
  ANNUAL_BONUS,
  PLANS,
  TRIAL_DAYS,
  formatUSD,
  monthlyEquivalentCents,
  type PlanId,
} from '../../domain/pricing';
import { COPY } from '../../content/copy';
import { useBillingView } from '../../hooks/useBillingView';
import { enlaceDeCompra } from '../../services/acceso';
import { billing } from '../../services/billing';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useBillingStore } from '../../store/billingStore';
import { Button, buttonClass, LinkButton } from '../ui/Button';
import { Badge } from '../ui/Surfaces';
import { useToast } from '../ui/Toast';

/**
 * Piezas comunes de /precios y /paywall: las dos pantallas muestran los mismos planes, las mismas ventajas y el mismo
 * botón de compra. Así un precio o una regla de compra no se queda distinto en una de ellas.
 */

/** Juegos del plan gratuito, contados desde el catálogo. */
export const FREE_GAMES = GAMES.filter((game) => game.free).length;

/**
 * Cada ventaja lleva un icono y dice qué gana la persona, no qué función trae. Van de la más deseada a la menos, y todas
 * son verdad en la app: los juegos premium, el modo foco (/enfoque), el historial completo de Progreso, las lecciones
 * premium y los retos que piden juegos premium.
 */
export const PREMIUM_FEATURES: { icon: PhosphorIcon; text: string }[] = [
  { icon: TargetIcon, text: `Los ${GAMES.length} juegos, para practicar cuando quieras.` },
  { icon: TimerIcon, text: 'Modo foco: bloques de 15 a 45 minutos sin saltar de pestaña.' },
  { icon: ChartLineUpIcon, text: 'Tu evolución completa, juego por juego.' },
  { icon: BookOpenTextIcon, text: 'Todas las lecciones, con sus fuentes.' },
  { icon: TrophyIcon, text: 'Retos extra con los juegos premium.' },
  { icon: LeafIcon, text: 'Todo lo gratuito sigue siendo gratis.' },
];

/** Preguntas de la FAQ que responden la objeción del pago, junto al botón. */
export const FAQ_PAGO = [
  '¿Cuándo me cobran?',
  '¿Cómo cancelo o pido el reembolso?',
  '¿Y si no me convence?',
];

/** La respuesta a «¿me cobran hoy?», con las mismas palabras en las dos pantallas. */
export const SIN_COBRO_HOY =
  'No te cobran hoy. El primer cobro llega al terminar la prueba, si sigues.';

/**
 * Tarjeta de plan seleccionable. El anual va con borde dorado y «Mejor precio»: es el recomendado y el único elemento
 * dorado fuera de Premium. Muestra su equivalente mensual; el mensual se ve con su precio completo.
 */
export function PlanOption({
  id,
  checked,
  onSelect,
  name = 'plan',
}: {
  id: PlanId;
  checked: boolean;
  onSelect: () => void;
  name?: string;
}) {
  const plan = PLANS[id];
  const annual = id === 'annual';
  return (
    <label
      className={`pressable relative block cursor-pointer rounded-card has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-focus ${annual ? 'fill-gold p-px shadow-[0_18px_50px_-20px_rgb(245_181_74/0.6)]' : ''}`}
    >
      <input
        type="radio"
        name={name}
        value={id}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span
        className={`flex h-full flex-col gap-4 rounded-[1.6875rem] p-5 sm:p-6 ${annual ? 'bg-surface' : 'glass'} ${checked && !annual ? 'ring-gradient' : ''} ${!annual ? 'ring-1 ring-inset ring-line' : ''}`}
      >
        <span className="flex items-start justify-between gap-3">
          <span className="text-lg font-bold">{plan.label}</span>
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${checked ? 'fill-brand ring-brand text-brand-ink' : 'ring-ink/15'}`}
          >
            {checked && <CheckIcon weight="bold" className="size-4" />}
          </span>
        </span>
        {annual && <Badge tone="premium">Mejor precio</Badge>}
        {/* El anual se lee como su equivalente mensual, con el total del año siempre a la vista. */}
        <span className="mt-auto flex flex-wrap items-baseline gap-x-2">
          <span className="figure text-5xl">
            {formatUSD(annual ? monthlyEquivalentCents('annual') : plan.cents)}
          </span>
          <span className="text-base font-semibold text-ink-soft">al mes</span>
        </span>
        {annual ? (
          <span className="text-base font-semibold text-premium">
            {formatUSD(plan.cents)} {plan.periodLabel} · {ANNUAL_BONUS}
          </span>
        ) : (
          <span className="text-base text-ink-soft">Pagas mes a mes.</span>
        )}
      </span>
    </label>
  );
}

/**
 * Botón de compra de Premium. Con un enlace de Hotmart configurado, abre la página de compra de Hotmart. Sin enlace
 * (plantilla recién descargada), lleva al mismo camino que sigue la app sin cobros: a la app gratuita (/hoy) o, con la
 * nube, a /entrar. No simula ningún cobro ni muestra un pago que no ocurrió; lo que falta lo lista `npm run verificar`.
 * En el modo `demo` (solo desarrollo, nunca en producción) simula la prueba en este navegador. Quien ya tiene Premium va
 * a gestionar su plan.
 */
export function CompraPremium({ plan }: { plan: PlanId }) {
  const navigate = useNavigate();
  const toast = useToast();
  const view = useBillingView();
  const authStatus = useAuthStore((state) => state.status);
  const refresh = useBillingStore((state) => state.refresh);
  const [busy, setBusy] = useState(false);
  // Con Hotmart, la compra es la página de Hotmart (enlace público).
  const enlace = enlaceDeCompra();
  const needsAccount = billing.mode === 'stripe' && authStatus !== 'conectado';
  const label = `Empezar prueba de ${TRIAL_DAYS} días`;

  const start = async () => {
    setBusy(true);
    try {
      await billing.startCheckout(plan);
      await refresh();
      if (billing.mode === 'demo') {
        // Solo desarrollo: el modo demo nunca llega a una compilación de producción (src/config/env.ts).
        toast.show('Prueba demo iniciada. No hay cobros reales.');
        void navigate('/hoy');
      }
    } catch (error) {
      toast.show(error instanceof Error ? error.message : COPY.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  if (view.entitlement === 'premium') {
    return (
      <LinkButton to="/cuenta" variant="secondary" className="w-full">
        Gestionar mi plan
      </LinkButton>
    );
  }
  if (enlace !== null) {
    return (
      <a
        href={enlace}
        rel="noopener"
        className={buttonClass('premium', 'lg', 'w-full')}
        onClick={() => {
          registrarEvento('compra_clic');
        }}
      >
        {label}
      </a>
    );
  }
  if (needsAccount) {
    return (
      <LinkButton to="/entrar" variant="premium" className="w-full">
        Entra con tu correo de compra
      </LinkButton>
    );
  }
  if (billing.mode === 'off') {
    // Sin enlace de compra: el camino sin cobros de siempre, con un botón que dice adónde lleva.
    return isCloudEnabled() ? (
      <LinkButton to="/entrar" variant="premium" size="lg" className="w-full">
        Entrar con mi correo
      </LinkButton>
    ) : (
      <LinkButton to="/hoy" variant="premium" size="lg" className="w-full">
        Empezar a entrenar
      </LinkButton>
    );
  }
  return (
    <Button
      variant="premium"
      size="lg"
      className="w-full"
      disabled={busy}
      onClick={() => {
        void start();
      }}
    >
      {busy ? 'Preparando…' : label}
    </Button>
  );
}
