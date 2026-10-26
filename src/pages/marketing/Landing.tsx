import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  BookOpenTextIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  CheckIcon,
  CreditCardIcon,
  DeviceMobileIcon,
  LeafIcon,
  PlusIcon,
  PuzzlePieceIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TimerIcon,
  WindIcon,
  XCircleIcon,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { LinkButton, buttonClass } from '../../components/ui/Button';
import { Badge, Card, SectionTitle } from '../../components/ui/Surfaces';
import { COPY, FAQ } from '../../content/copy';
import { CLAIMS } from '../../content/science';
import { GARANTIA, plantilla } from '../../config/plantilla';
import {
  ANNUAL_BONUS,
  PLANS,
  TRIAL_DAYS,
  formatUSD,
  monthlyEquivalentCents,
} from '../../domain/pricing';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { registrarEvento } from '../../services/medicion';

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
const PROMISE_ICONS: PhosphorIcon[] = [LeafIcon, ShieldCheckIcon, TimerIcon];
const TRIAL_ICONS: PhosphorIcon[] = [SparkleIcon, CreditCardIcon, ShieldCheckIcon];
/** Una escena, un icono: el móvil, la lectura y el cambio de tarea. */
const SCENE_ICONS: PhosphorIcon[] = [DeviceMobileIcon, BookOpenTextIcon, ArrowsClockwiseIcon];
/** Cada paso del método lleva el icono de su acción: respirar, entrenar y ver el progreso. */
const STEP_ICONS: PhosphorIcon[] = [WindIcon, PuzzlePieceIcon, ChartLineUpIcon];
const TRIAL_LINES = [
  {
    day: `Prueba de ${TRIAL_DAYS} días`,
    text: 'acceso completo, y ves el precio de cada plan antes de pagar.',
  },
  { day: 'Al terminar la prueba', text: 'el cobro lo gestiona Hotmart, si sigues.' },
  { day: GARANTIA, text: 'si no te convence, pides el reembolso con Hotmart.' },
];

/**
 * Entrada escalonada: el elemento sube y se asienta sin cambiar su opacidad,
 * así el texto siempre tiene su contraste real.
 */
function rise(delay: number) {
  return {
    initial: { y: 16 },
    animate: { y: 0 },
    transition: { duration: 0.8, delay, ease: EASE_OUT },
  };
}

/** Pone una palabra del texto en cursiva de Instrument Serif. El texto visible no cambia. */
function emphasize(text: string, word: string): ReactNode {
  const start = text.indexOf(word);
  if (start === -1) return text;
  return (
    <>
      {text.slice(0, start)}
      <span className="pixel-accent">{word}</span>
      {text.slice(start + word.length)}
    </>
  );
}

/** Detalle del siguiente paso que la app muestra en Hoy, con el mismo texto que usa la pantalla. */
const SESION_DETALLE = 'Tres juegos y una pausa para ti';
/** Corte de la captura: la mitad superior se ve y la base se funde con el fondo. */
const CORTE = 'linear-gradient(to bottom, #000 62%, transparent)';

/**
 * Anillos de foco que salen de la cámara del dispositivo: la firma de la app.
 * Son decorativos. El punto central respira muy despacio; con movimiento reducido no se mueve.
 */
function FocusRings() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-130 -130 260 130"
      className="pointer-events-none absolute bottom-full left-1/2 mb-2 w-[13.5rem] -translate-x-1/2 overflow-visible md:w-64"
    >
      <circle
        r="44"
        fill="none"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: 'var(--c-line-strong)' }}
      />
      <circle
        r="78"
        fill="none"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
        style={{ stroke: 'var(--c-line)' }}
      />
      <circle
        r="116"
        fill="none"
        strokeWidth="1"
        strokeOpacity="0.6"
        vectorEffect="non-scaling-stroke"
        stroke="url(#grad-aurora-icon)"
      />
      <circle
        r="12"
        opacity="0.3"
        fill="url(#grad-aurora-icon)"
        className="origin-center animate-pulso-foco motion-reduce:animate-none"
        style={{ transformBox: 'fill-box' }}
      />
      <circle
        r="3.5"
        fill="url(#grad-aurora-icon)"
        className="origin-center animate-pulso-foco motion-reduce:animate-none"
        style={{ transformBox: 'fill-box' }}
      />
    </svg>
  );
}

/**
 * Captura real de la pantalla Hoy dentro de un dispositivo.
 * La base se funde con el fondo. La tarjeta solo repite un texto que la app muestra en esa pantalla.
 */
function HeroDevice() {
  return (
    <motion.div
      {...rise(0.2)}
      className="relative mx-auto w-full max-w-[18rem] pt-[6.5rem] md:max-w-xs md:pt-[8rem] lg:max-w-[22rem]"
    >
      <div className="animate-flota-lenta relative motion-reduce:animate-none">
        <FocusRings />
        <div
          className="ring-gradient relative rounded-[2.5rem] bg-surface p-2 shadow-lift"
          style={{ maskImage: CORTE, WebkitMaskImage: CORTE }}
        >
          <span
            aria-hidden="true"
            className="absolute top-3.5 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black"
          />
          <div className="relative overflow-hidden rounded-[2rem]">
            <img
              src="/captura-hoy.webp"
              width={780}
              height={980}
              alt={`Pantalla principal de la app ${plantilla.nombre}`}
              fetchPriority="high"
              decoding="async"
              className="block h-auto w-full"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
              style={{ background: 'linear-gradient(to top, var(--c-canvas) 12%, transparent)' }}
            />
          </div>
        </div>
        <div className="glass ring-1 ring-inset ring-line absolute -left-2 bottom-[10%] w-[13.5rem] rounded-2xl p-4 md:-left-6 md:w-60">
          <p className="eyebrow flex items-center gap-2 text-brand">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_currentColor]"
            />
            Sesión de {plantilla.minutosSesion} min
          </p>
          <p className="mt-2 text-base leading-snug font-semibold">{SESION_DETALLE}</p>
        </div>
      </div>
    </motion.div>
  );
}

/** Icono del paso en una pastilla de cristal: el mismo lenguaje que las tarjetas de promesas. */
function StepIconChip({ index }: { index: number }) {
  const StepIcon = STEP_ICONS[index] ?? WindIcon;
  return (
    <span className="glass ring-1 ring-inset ring-line mb-1 flex size-10 items-center justify-center rounded-xl md:mx-auto">
      <StepIcon weight="duotone" aria-hidden="true" className="icon-aurora size-5" />
    </span>
  );
}

export default function Landing() {
  useDocumentMeta({
    title: 'Entrena tu atención en 5 minutos',
    description: `Cinco minutos al día con juegos breves para volver a tu tarea sin perder el hilo. Sin anuncios, sin cookies de terceros, sin culpa. ${GARANTIA}.`,
  });

  // Medición anónima (apagada por defecto): una visita a la portada. Sin datos de la persona.
  useEffect(() => {
    registrarEvento('portada_vista');
  }, []);

  // La barra inferior de móvil aparece cuando el botón principal sale de la pantalla.
  // Solo se muestra entre el primer botón y el cierre: al llegar al final o al pie desaparece.
  const ctaRef = useRef<HTMLDivElement>(null);
  const finalRef = useRef<HTMLElement>(null);
  const [pastCta, setPastCta] = useState(false);
  const [beforeFinal, setBeforeFinal] = useState(true);
  // Se lee la posición real en cada scroll: un salto largo no siempre dispara un observador de intersección.
  useEffect(() => {
    const cta = ctaRef.current;
    const final = finalRef.current;
    if (!cta || !final) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      setPastCta(cta.getBoundingClientRect().bottom < 0);
      setBeforeFinal(final.getBoundingClientRect().top > window.innerHeight);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="space-y-24">
      <section
        aria-labelledby="hero"
        className="grid gap-12 pt-6 md:grid-cols-[1.05fr_0.95fr] md:items-start md:gap-10 md:pt-16"
      >
        <div className="space-y-7">
          <motion.p {...rise(0)} className="eyebrow flex items-center gap-2 text-brand">
            <span className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_currentColor]" />
            {COPY.hero.eyebrow}
          </motion.p>
          <motion.h1
            {...rise(0.08)}
            id="hero"
            className="text-[clamp(2.75rem,calc(1.2rem_+_4.4vw),4.5rem)] leading-[0.98]"
          >
            {emphasize(COPY.hero.title, 'hilo')}
          </motion.h1>
          <motion.p
            {...rise(0.16)}
            className="max-w-xl text-lg leading-relaxed text-ink-soft sm:text-xl"
          >
            {COPY.hero.lead}
          </motion.p>
          <motion.div {...rise(0.24)} ref={ctaRef} className="flex flex-col gap-3 sm:flex-row">
            <LinkButton
              to="/onboarding"
              size="lg"
              className="px-7"
              id="cta-portada"
              data-evento="inicio-gratis"
            >
              {COPY.hero.primary}
            </LinkButton>
            <a href="#como-funciona" className={buttonClass('secondary', 'lg')}>
              {COPY.hero.secondary}
            </a>
          </motion.div>
          <motion.ul {...rise(0.32)} className="flex flex-wrap gap-2">
            {COPY.hero.trust.map((item) => (
              <li
                key={item}
                className="glass ring-1 ring-inset ring-line flex items-center gap-1.5 rounded-full py-1.5 pr-3.5 pl-2.5 text-sm font-medium text-ink-soft"
              >
                <CheckIcon weight="bold" aria-hidden="true" className="size-3.5 text-brand" />
                {item}
              </li>
            ))}
          </motion.ul>
        </div>
        <HeroDevice />
      </section>

      <section aria-labelledby="problema" className="space-y-10">
        <SectionTitle id="problema" eyebrow={COPY.problem.eyebrow}>
          {emphasize(COPY.problem.title, 'otra')}
        </SectionTitle>
        <ul className="grid gap-5 md:grid-cols-3">
          {COPY.problem.scenes.map((scene, index) => {
            const SceneIcon = SCENE_ICONS[index] ?? DeviceMobileIcon;
            return (
              <motion.li
                key={scene.title}
                initial={{ y: 28 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: index * 0.09, ease: EASE_OUT }}
              >
                <Card as="article" className="h-full">
                  <div className="flex flex-col gap-5">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft ring-1 ring-inset ring-brand/20">
                      <SceneIcon
                        weight="duotone"
                        aria-hidden="true"
                        className="icon-aurora size-7"
                      />
                    </span>
                    <div className="space-y-3">
                      <h3 className="text-xl font-bold">{scene.title}</h3>
                      <p className="text-ink-soft">{scene.body}</p>
                    </div>
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </ul>
        <p className="glass ring-1 ring-inset ring-line border-l-2 border-l-brand rounded-2xl p-5 text-lg leading-relaxed font-medium sm:p-6">
          {COPY.problem.worst}
        </p>
      </section>

      <section aria-labelledby="promesas" className="space-y-10">
        <SectionTitle id="promesas" eyebrow="Lo que nos diferencia">
          Tres promesas que puedes <span className="pixel-accent">comprobar</span>.
        </SectionTitle>
        <ul className="grid gap-5 md:grid-cols-3">
          {COPY.promises.map((promise, index) => {
            const PromiseIcon = PROMISE_ICONS[index] ?? LeafIcon;
            return (
              <motion.li
                key={promise.title}
                initial={{ y: 28 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, delay: index * 0.09, ease: EASE_OUT }}
              >
                <Card as="article" className="h-full">
                  <div className="flex flex-col gap-5">
                    <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft ring-1 ring-inset ring-brand/20">
                      <PromiseIcon
                        weight="duotone"
                        aria-hidden="true"
                        className="icon-aurora size-7"
                      />
                    </span>
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold">{promise.title}</h3>
                      <p className="text-ink-soft">{promise.body}</p>
                    </div>
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </ul>
        <p>
          <Link
            to="/pacto"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline"
          >
            Lee el Pacto Sin Trampas: diez promesas con cómo comprobarlas
            <ArrowRightIcon weight="bold" aria-hidden="true" className="size-4" />
          </Link>
        </p>
      </section>

      <section id="como-funciona" aria-labelledby="como" className="scroll-mt-28 space-y-12">
        <SectionTitle id="como" eyebrow="Cómo funciona">
          Cinco minutos. Tres <span className="pixel-accent">pasos</span>.
        </SectionTitle>
        <div className="relative">
          <ol className="grid gap-10 md:grid-cols-3 md:gap-0">
            {COPY.howItWorks.map((item, index) => (
              <motion.li
                key={item.step}
                className="relative flex gap-5 md:flex-col md:items-center md:px-6 md:text-center"
                initial={{ y: 24 }}
                whileInView={{ y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: index * 0.12, ease: EASE_OUT }}
              >
                {index < COPY.howItWorks.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-14 -bottom-10 left-7 w-px fill-aurora opacity-70 md:-right-1/2 md:top-7 md:bottom-auto md:left-1/2 md:h-px md:w-auto"
                  />
                )}
                <span className="fill-aurora relative flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-brand-ink shadow-glow">
                  {item.step}
                </span>
                <div className="space-y-2 md:mt-6">
                  <StepIconChip index={index} />
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="text-ink-soft">{item.body}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="honestidad" className="space-y-8">
        <SectionTitle id="honestidad" eyebrow="Sin humo">
          {COPY.honesty.title}
        </SectionTitle>
        <div className="grid gap-5 md:grid-cols-2">
          <Card labelledBy="medimos">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <CheckCircleIcon
                  weight="duotone"
                  aria-hidden="true"
                  className="icon-aurora size-8"
                />
                <h3 id="medimos" className="text-xl font-bold">
                  Sí medimos
                </h3>
              </div>
              <ul className="space-y-4">
                {COPY.honesty.measure.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-soft">
                    <CheckIcon
                      weight="bold"
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-brand"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
          <Card labelledBy="no-prometemos">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <XCircleIcon weight="duotone" aria-hidden="true" className="size-8 text-ink-soft" />
                <h3 id="no-prometemos" className="text-xl font-bold">
                  No prometemos
                </h3>
              </div>
              <ul className="space-y-4">
                {COPY.honesty.notPromise.map((item) => (
                  <li key={item} className="flex gap-3 text-ink-soft">
                    <XCircleIcon
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-ink-soft"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
        <p className="text-base text-ink-soft">
          Hay {CLAIMS.length} afirmaciones sobre el entrenamiento cerebral analizadas en la pestaña{' '}
          <Link
            to="/ciencia"
            className="py-3.5 font-semibold text-brand underline-offset-4 hover:underline"
          >
            {COPY.honesty.link}
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="precio" className="space-y-8">
        <SectionTitle id="precio" eyebrow="Precio sin letra pequeña">
          {emphasize(COPY.trial.title, '7 días')}
        </SectionTitle>
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <Card>
            <div className="space-y-6">
              <p className="text-ink-soft">{COPY.trial.body}</p>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-4 bottom-4 left-3.5 w-px fill-aurora opacity-60"
                />
                <ol className="relative flex flex-col gap-6 pl-10">
                  {TRIAL_LINES.map((line, index) => {
                    const TrialIcon = TRIAL_ICONS[index] ?? SparkleIcon;
                    return (
                      <li key={line.day} className="relative font-medium">
                        <span className="glass ring-gradient absolute -left-10 flex size-7 items-center justify-center rounded-full">
                          <TrialIcon
                            weight="duotone"
                            aria-hidden="true"
                            className="icon-aurora size-4"
                          />
                        </span>
                        <span className="eyebrow text-brand">{line.day}</span>: {line.text}
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          </Card>
          <Card>
            <div className="space-y-5">
              <p className="eyebrow">Precios</p>
              <div className="space-y-3">
                <div className="glass ring-1 ring-inset ring-line rounded-2xl p-4">
                  <p className="text-sm font-semibold text-ink-soft">{PLANS.monthly.label}</p>
                  <p className="text-lg">
                    <span className="figure text-2xl font-bold">
                      {formatUSD(PLANS.monthly.cents)}
                    </span>{' '}
                    al mes
                  </p>
                </div>
                <div className="fill-gold rounded-2xl p-px shadow-[0_16px_40px_-16px_rgb(245_181_74/0.6)]">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[0.9375rem] bg-surface p-4">
                    <p className="text-lg">
                      <span className="block text-sm font-semibold text-ink-soft">
                        {PLANS.annual.label}
                      </span>
                      <span className="figure text-2xl font-bold">
                        {formatUSD(monthlyEquivalentCents('annual'))}
                      </span>{' '}
                      al mes
                      <span className="block text-base text-ink-soft">
                        {formatUSD(PLANS.annual.cents)} al año · {ANNUAL_BONUS}
                      </span>
                    </p>
                    <Badge tone="premium">Mejor precio</Badge>
                  </div>
                </div>
              </div>
              <Link
                to="/precios"
                className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline"
              >
                Ver todos los detalles
                <ArrowRightIcon weight="bold" aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </Card>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <LinkButton
            to="/onboarding"
            size="lg"
            className="px-7"
            id="cta-medio"
            data-evento="inicio-gratis"
          >
            {COPY.hero.primary}
          </LinkButton>
          <p className="text-ink-soft">
            Prueba de {TRIAL_DAYS} días. {GARANTIA}. El cobro y el reembolso los gestiona Hotmart.
          </p>
        </div>
      </section>

      <section aria-labelledby="faq" className="space-y-8">
        <SectionTitle id="faq" eyebrow="Preguntas frecuentes">
          Lo que más nos <span className="pixel-accent">preguntan</span>.
        </SectionTitle>
        <div className="glass ring-gradient divide-y divide-line overflow-hidden rounded-card">
          {FAQ.map((item) => (
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
      </section>

      <section
        ref={finalRef}
        aria-labelledby="final"
        className="glass ring-gradient relative isolate overflow-hidden rounded-[2rem] px-6 py-16 text-center sm:px-12 sm:py-20"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-80 w-[110%] -translate-x-1/2 rounded-full fill-aurora opacity-25 blur-3xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -left-20 -z-10 size-72 rounded-full bg-[radial-gradient(closest-side,var(--c-glow-2),transparent)]"
        />
        <h2 id="final" className="mx-auto max-w-3xl text-[2.25rem] leading-[1.02] sm:text-6xl">
          {emphasize(COPY.finalCta.title, 'cinco')}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          {COPY.finalCta.body}
        </p>
        <div className="mt-9 flex justify-center">
          <LinkButton
            to="/onboarding"
            size="lg"
            className="px-8"
            id="cta-final"
            data-evento="inicio-gratis"
          >
            {COPY.finalCta.button}
            <ArrowRightIcon weight="bold" aria-hidden="true" />
          </LinkButton>
        </div>
      </section>

      <AnimatePresence>
        {pastCta && beforeFinal && (
          <motion.div
            key="barra-movil"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.45, ease: EASE_OUT }}
            className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 md:hidden"
          >
            <LinkButton
              to="/onboarding"
              size="lg"
              className="w-full"
              id="cta-barra"
              data-evento="inicio-gratis"
            >
              {COPY.hero.primary}
            </LinkButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
