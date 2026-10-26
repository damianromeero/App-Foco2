import {
  CreditCardIcon,
  CrownIcon,
  LeafIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  SignInIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../components/brand/Logo';
import {
  CompraPremium,
  FAQ_PAGO,
  FREE_GAMES,
  PlanOption,
  PREMIUM_FEATURES,
  SIN_COBRO_HOY,
} from '../../components/pricing/Planes';
import { LinkButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Surfaces';
import { GARANTIA, plantilla } from '../../config/plantilla';
import { FAQ, GOAL_PARA, GOALS } from '../../content/copy';
import { PLAN_IDS, PLANS, TRIAL_DAYS, formatUSD, type PlanId } from '../../domain/pricing';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { leerEstadoAcceso } from '../../services/acceso';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';
import { useAppStore } from '../../store/appStore';

/**
 * Lo que incluye el plan, de lo más deseado a lo menos, cerrado con la prueba y la garantía configuradas. «Todo lo
 * gratuito sigue gratis» ya lo dice la tarjeta «Si prefieres no pagar», más abajo: así los precios asoman antes en móvil.
 */
const STACK: { icon: PhosphorIcon; text: string }[] = [
  ...PREMIUM_FEATURES.filter((feature) => feature.icon !== LeafIcon),
  { icon: ShieldCheckIcon, text: `${TRIAL_DAYS} días de prueba y ${GARANTIA}.` },
];

/**
 * Tercera etapa del embudo: portada (/) → onboarding (/onboarding) → paywall (/paywall) → compra en Hotmart.
 * Repite lo que la persona eligió en el onboarding, recomienda el plan anual sin esconder el mensual, explica la prueba
 * en tres pasos y deja siempre una salida honesta: el plan gratuito (sin nube) o entrar con la compra (nube).
 * No hay contadores, testimonios ni urgencia: solo los precios y la garantía configurados.
 */
export default function Paywall() {
  useDocumentMeta({
    title: 'Tu plan',
    description: `Prueba de ${TRIAL_DAYS} días del plan completo. ${GARANTIA}. El cobro y el reembolso los gestiona Hotmart.`,
  });
  // Medición anónima (apagada por defecto): la visita cuenta como vista de precios, sin datos de la persona.
  useEffect(() => {
    registrarEvento('precios_vista');
  }, []);
  // Se llega desde el último paso del onboarding, que suele estar bajado: el paywall empieza por su titular.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const goal = useAppStore((state) => state.goal);
  const displayName = useAppStore((state) => state.displayName);
  const onboarded = useAppStore((state) => state.onboardedAt !== null);
  const [plan, setPlan] = useState<PlanId>('annual');
  const selected = PLANS[plan];
  const goalLabel = GOALS.find((item) => item.value === goal)?.label ?? null;
  const para = goal ? GOAL_PARA[goal] : 'no perder el hilo';
  const name = displayName?.trim() ?? '';
  // Con la nube conectada, la app exige una compra: no se ofrece un plan gratuito que no existe.
  const conNube = isCloudEnabled();
  // Con la nube, quien ya compró y entró no necesita la oferta: se le ofrece ir a Hoy. Ante cualquier duda, se trata
  // como sin compra (el botón de entrar sigue a la vista) y la guarda de la app decide al entrar.
  const [conAcceso, setConAcceso] = useState(false);
  useEffect(() => {
    if (!conNube) return;
    let vigente = true;
    void leerEstadoAcceso().then((estado) => {
      if (vigente) setConAcceso(estado.tipo === 'con-acceso');
    });
    return () => {
      vigente = false;
    };
  }, [conNube]);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 pt-5 pb-3 sm:px-6">
        <Logo />
        {!onboarded && (
          <Link
            to="/onboarding"
            className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:underline"
          >
            Hacer el inicio
          </Link>
        )}
      </header>

      <main id="contenido" className="mx-auto w-full max-w-2xl space-y-10 px-4 pt-4 pb-16 sm:px-6">
        {/* Orden fijo: titular → subtítulo → lo que incluye → precios con su botón. Lo demás va debajo. */}
        <section aria-labelledby="paywall-titulo" className="space-y-6">
          <div className="space-y-3">
            {goalLabel !== null && (
              <p className="eyebrow flex items-center gap-2 text-brand">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_currentColor]"
                />
                Tu objetivo: {goalLabel}
              </p>
            )}
            <h1
              id="paywall-titulo"
              className="text-[clamp(2rem,calc(1.3rem+3vw),3.25rem)] leading-[1.04] text-balance"
            >
              {name ? `${name}, tu` : 'Tu'} entrenamiento de {plantilla.minutosSesion} minutos para{' '}
              <span className="pixel-accent">{para}</span>.
            </h1>
            <p className="text-lg text-ink-soft">
              Tres juegos breves al día, ajustados a tu nivel, y tu progreso siempre a la vista.
            </p>
          </div>

          <div className="glass ring-gradient rounded-card p-5 sm:p-6">
            <h2 id="incluye" className="flex items-center gap-2 text-lg font-bold">
              <CrownIcon weight="fill" aria-hidden="true" className="icon-gold size-6" />
              Todo lo que incluye Premium
            </h2>
            <ul aria-labelledby="incluye" className="mt-4 space-y-2.5">
              {STACK.map((item) => (
                <li key={item.text} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="fill-gold flex size-8 shrink-0 items-center justify-center rounded-lg"
                  >
                    <item.icon weight="bold" className="size-4 text-premium-ink" />
                  </span>
                  <span className="min-w-0">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="elige" className="space-y-5">
          <h2 id="elige" className="text-2xl font-bold">
            Elige tu plan
          </h2>
          <fieldset>
            <legend className="sr-only">Facturación</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* El recomendado va primero, como en las apps de referencia; el mensual sigue a la vista. */}
              {[...PLAN_IDS].reverse().map((id) => (
                <PlanOption
                  key={id}
                  id={id}
                  name="plan-paywall"
                  checked={plan === id}
                  onSelect={() => {
                    setPlan(id);
                  }}
                />
              ))}
            </div>
          </fieldset>
          <div className="space-y-3">
            <CompraPremium plan={plan} />
            <p className="text-center text-base font-semibold">{SIN_COBRO_HOY}</p>
            <p className="text-center text-sm text-ink-soft">
              Después, {formatUSD(selected.cents)} {selected.periodLabel}. {GARANTIA}. El cobro y el
              reembolso los gestiona Hotmart.
            </p>
          </div>
        </section>

        <section aria-labelledby="como-sigue" className="space-y-5">
          <h2 id="como-sigue" className="text-2xl font-bold">
            Cómo sigue, paso a paso
          </h2>
          <ol className="space-y-3">
            <PaywallStep
              step={1}
              icon={PlayIcon}
              title="Hoy"
              body="Empiezas con acceso completo. No te cobran nada."
            />
            <PaywallStep
              step={2}
              icon={CreditCardIcon}
              title={`Al terminar los ${TRIAL_DAYS} días`}
              body={`Hotmart cobra ${formatUSD(selected.cents)} ${selected.periodLabel}, si sigues.`}
            />
            <PaywallStep
              step={3}
              icon={ShieldCheckIcon}
              title={GARANTIA}
              body="Si no te convence, pides el reembolso en ese plazo con Hotmart."
            />
          </ol>
        </section>

        {conNube && conAcceso ? (
          <Card labelledBy="ya-tienes">
            <div className="flex gap-4">
              <IconTile icon={SignInIcon} />
              <div className="space-y-3">
                <h2 id="ya-tienes" className="text-xl font-bold">
                  Tu compra ya está activa
                </h2>
                <p className="text-ink-soft">Entraste con el correo de tu compra.</p>
                <LinkButton to="/hoy" variant="secondary" className="w-full sm:w-auto">
                  Ir a Hoy
                </LinkButton>
              </div>
            </div>
          </Card>
        ) : conNube ? (
          <Card labelledBy="ya-compre">
            <div className="flex gap-4">
              <IconTile icon={SignInIcon} />
              <div className="space-y-3">
                <h2 id="ya-compre" className="text-xl font-bold">
                  ¿Ya compraste?
                </h2>
                <p className="text-ink-soft">Entra con el correo que usaste en Hotmart.</p>
                <LinkButton to="/entrar" variant="secondary" className="w-full sm:w-auto">
                  Entrar con mi correo
                </LinkButton>
              </div>
            </div>
          </Card>
        ) : (
          <Card labelledBy="sin-pagar">
            <div className="flex gap-4">
              <IconTile icon={LeafIcon} />
              <div className="space-y-3">
                <h2 id="sin-pagar" className="text-xl font-bold">
                  Si prefieres no pagar
                </h2>
                <p className="text-ink-soft">
                  Sigues con la sesión diaria de {plantilla.minutosSesion} minutos y {FREE_GAMES}{' '}
                  juegos, gratis.
                </p>
                <LinkButton to="/hoy" variant="secondary" className="w-full sm:w-auto">
                  Seguir con el plan gratuito
                </LinkButton>
              </div>
            </div>
          </Card>
        )}

        <section aria-labelledby="faq-paywall" className="space-y-4">
          <h2 id="faq-paywall" className="text-2xl font-bold">
            Antes de pagar
          </h2>
          <div className="glass ring-gradient divide-y divide-line overflow-hidden rounded-card">
            {FAQ.filter((item) => FAQ_PAGO.includes(item.question)).map((item) => (
              <details key={item.question} className="group px-5 sm:px-7">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <PlusIcon
                    weight="bold"
                    aria-hidden="true"
                    className="size-5 shrink-0 text-brand transition-transform duration-300 group-open:rotate-45"
                  />
                </summary>
                <p className="pr-8 pb-5 text-ink-soft">{item.answer}</p>
              </details>
            ))}
          </div>
          <p className="text-base text-ink-soft">
            Las condiciones completas están en{' '}
            <Link
              className="font-semibold text-brand underline-offset-4 hover:underline"
              to="/legal/terminos"
            >
              las condiciones de uso
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

function IconTile({ icon: Icon }: { icon: PhosphorIcon }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft ring-1 ring-inset ring-brand/20">
      <Icon weight="duotone" aria-hidden="true" className="icon-aurora size-6" />
    </span>
  );
}

/** Paso numerado de la prueba: número grande, icono y una frase. */
function PaywallStep({
  step,
  icon: Icon,
  title,
  body,
}: {
  step: number;
  icon: PhosphorIcon;
  title: string;
  body: string;
}) {
  return (
    <li className="glass ring-1 ring-inset ring-line flex items-center gap-4 rounded-2xl p-4">
      <span
        aria-hidden="true"
        className="fill-aurora flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-brand-ink"
      >
        {step}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold">
          <Icon weight="duotone" aria-hidden="true" className="icon-aurora size-5 shrink-0" />
          {title}
        </span>
        <span className="block text-ink-soft">{body}</span>
      </span>
    </li>
  );
}
