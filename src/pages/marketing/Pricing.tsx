import {
  ArrowUUpLeftIcon,
  CrownIcon,
  CreditCardIcon,
  LeafIcon,
  PlayIcon,
  PlusIcon,
  ShieldCheckIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import {
  CompraPremium,
  FAQ_PAGO,
  PlanOption,
  PREMIUM_FEATURES,
  SIN_COBRO_HOY,
} from '../../components/pricing/Planes';
import { Card, PageHeader, SectionTitle } from '../../components/ui/Surfaces';
import { GARANTIA } from '../../config/plantilla';
import { FAQ } from '../../content/copy';
import { PLAN_IDS, PLANS, TRIAL_DAYS, formatUSD, type PlanId } from '../../domain/pricing';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { registrarEvento } from '../../services/medicion';

export default function Pricing() {
  useDocumentMeta({
    title: 'Precios',
    description: `Prueba de ${TRIAL_DAYS} días. Plan mensual o anual, con el pago y el reembolso gestionados por Hotmart. ${GARANTIA}.`,
  });
  // Medición anónima (apagada por defecto): una visita a los precios. Sin datos de la persona.
  useEffect(() => {
    registrarEvento('precios_vista');
  }, []);
  const [plan, setPlan] = useState<PlanId>('annual');
  const selected = PLANS[plan];

  return (
    <div className="space-y-20">
      <PageHeader
        eyebrow="Precios"
        title={
          <>
            Prueba {TRIAL_DAYS} días. Decide con <span className="pixel-accent">calma</span>.
          </>
        }
        lead={`Prueba de ${TRIAL_DAYS} días. ${GARANTIA}: si no te convence, pides el reembolso. El cobro y el reembolso los gestiona Hotmart.`}
      />

      <section aria-labelledby="planes" className="space-y-8">
        <h2 id="planes" className="sr-only">
          Planes
        </h2>
        <fieldset>
          <legend className="mb-4 font-semibold">Elige la facturación</legend>
          <div className="grid gap-4 md:grid-cols-2">
            {PLAN_IDS.map((id) => (
              <PlanOption
                key={id}
                id={id}
                checked={plan === id}
                onSelect={() => {
                  setPlan(id);
                }}
              />
            ))}
          </div>
        </fieldset>

        <div className="mx-auto grid max-w-2xl gap-5">
          <Card as="article" labelledBy="plan-premium" variant="hero">
            <div className="flex h-full flex-col gap-6">
              <div className="flex items-center gap-3">
                <CrownIcon weight="fill" aria-hidden="true" className="icon-gold size-8" />
                <h3 id="plan-premium" className="text-2xl font-bold">
                  Premium · {selected.label}
                </h3>
              </div>
              <p className="text-ink-soft">Todo lo que incluye:</p>
              <ul className="space-y-3 text-ink-soft">
                {PREMIUM_FEATURES.map((feature) => (
                  <li key={feature.text} className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="fill-gold flex size-9 shrink-0 items-center justify-center rounded-xl"
                    >
                      <feature.icon weight="bold" className="size-4 text-premium-ink" />
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>
              <div className="mt-auto space-y-3 pt-2">
                <CompraPremium plan={plan} />
                <p className="text-center text-sm text-ink-soft">{SIN_COBRO_HOY}</p>
                <p className="text-center text-sm text-ink-soft">
                  {GARANTIA}. El cobro y el reembolso los gestiona Hotmart.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="antes-de-pagar" className="space-y-8">
        <SectionTitle id="antes-de-pagar" eyebrow="Antes y después de pagar">
          Ves el precio <span className="pixel-accent">antes</span> de pagar.
        </SectionTitle>
        <ol className="grid gap-4 md:grid-cols-3">
          <TimelineStep
            step={1}
            icon={PlayIcon}
            day={`Prueba de ${TRIAL_DAYS} días`}
            title="Empiezas con acceso completo"
            body="Ves el precio, el periodo y lo que incluye cada plan antes de pagar."
          />
          <TimelineStep
            step={2}
            icon={CreditCardIcon}
            day="Al terminar la prueba"
            title="Hotmart cobra"
            body={`${formatUSD(selected.cents)} ${selected.periodLabel}, según el plan que elijas, si sigues. El cobro lo gestiona Hotmart.`}
          />
          <TimelineStep
            step={3}
            icon={ShieldCheckIcon}
            day={GARANTIA}
            title="Si no te convence"
            body="Pides el reembolso dentro de ese plazo. Lo gestiona Hotmart."
          />
        </ol>
      </section>

      <section aria-labelledby="salir" className="space-y-6">
        <SectionTitle id="salir" eyebrow="Si cambias de opinión">
          Lo que pasa <span className="pixel-accent">después</span>.
        </SectionTitle>
        <div className="grid gap-5 md:grid-cols-2">
          <Card labelledBy="reembolso-t">
            <div className="flex gap-4">
              <IconTile icon={ArrowUUpLeftIcon} />
              <div className="space-y-2">
                <h3 id="reembolso-t" className="text-xl font-bold">
                  Reembolso
                </h3>
                <p className="text-ink-soft">
                  {GARANTIA}. Pides el reembolso dentro de ese plazo y lo gestiona&nbsp;Hotmart.
                </p>
              </div>
            </div>
          </Card>
          <Card labelledBy="cancelar-t">
            <div className="flex gap-4">
              <IconTile icon={LeafIcon} />
              <div className="space-y-2">
                <h3 id="cancelar-t" className="text-xl font-bold">
                  Cancelar
                </h3>
                <p className="text-ink-soft">
                  Cancelas tu suscripción en Hotmart cuando quieras. El primer cobro llega al
                  terminar la&nbsp;prueba.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section aria-labelledby="faq-precios" className="space-y-6">
        <SectionTitle id="faq-precios" eyebrow="Preguntas sobre el pago">
          Lo que quieres saber <span className="pixel-accent">antes de pagar</span>.
        </SectionTitle>
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
          Precio mensual: {formatUSD(PLANS.monthly.cents)}. Anual: {formatUSD(PLANS.annual.cents)}.
          Prueba de {TRIAL_DAYS} días. Las condiciones completas están en{' '}
          <a
            className="py-3.5 font-semibold text-brand underline-offset-4 hover:underline"
            href="/legal/terminos"
          >
            las condiciones de uso
          </a>
          .
        </p>
      </section>
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

function TimelineStep({
  step,
  icon,
  day,
  title,
  body,
}: {
  step: number;
  icon: PhosphorIcon;
  day: string;
  title: string;
  body: string;
}) {
  return (
    <li>
      <Card as="article" className="h-full">
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <IconTile icon={icon} />
            <span aria-hidden="true" className="figure text-4xl font-bold text-brand">
              {step}
            </span>
          </div>
          <p className="eyebrow text-brand">{day}</p>
          <h3 className="text-xl font-bold">{title}</h3>
          <p className="text-ink-soft">{body}</p>
        </div>
      </Card>
    </li>
  );
}
