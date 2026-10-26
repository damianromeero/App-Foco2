import { SealCheckIcon, WarningIcon, XCircleIcon } from '@phosphor-icons/react';
import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { Badge, Card, PageHeader, SectionTitle } from '../../components/ui/Surfaces';
import { CLAIM_LABEL, CLAIMS, REFERENCES, type ClaimStatus } from '../../content/science';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

type Tone = 'brand' | 'accent' | 'danger' | 'neutral';

const STATUS_TONE: Record<ClaimStatus, Tone> = {
  respaldado: 'brand',
  parcial: 'accent',
  'no-respaldado': 'danger',
  'sin-demostrar': 'neutral',
};

const STATUS_DOT: Record<Tone, string> = {
  brand: 'bg-brand',
  accent: 'bg-accent',
  danger: 'bg-danger',
  neutral: 'bg-ink-soft',
};

/** Leyenda de la evidencia: de lo más sólido a lo que no tiene respaldo. */
const STATUS_ORDER: ClaimStatus[] = ['respaldado', 'parcial', 'sin-demostrar', 'no-respaldado'];

export default function Science() {
  useDocumentMeta({
    title: 'Ciencia',
    description:
      'Qué está demostrado sobre el entrenamiento de la atención, qué no, y con qué fuentes.',
  });
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <div className="space-y-20">
      <PageHeader
        eyebrow="Ciencia"
        title={
          <>
            Qué está <span className="pixel-accent">demostrado</span>, qué no.
          </>
        }
        lead="Muchas aplicaciones de entrenamiento cerebral prometen demasiado. Aquí separamos lo que la evidencia respalda de lo que no. Si algo no está demostrado, lo decimos."
      />

      <ul aria-label="Resumen de la evidencia" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const count = CLAIMS.filter((claim) => claim.status === status).length;
          const tone = STATUS_TONE[status];
          return (
            <li
              key={status}
              className="glass ring-gradient flex flex-col justify-between gap-5 rounded-2xl p-4 sm:p-5"
            >
              <p className="eyebrow flex items-start gap-2 leading-snug">
                <span
                  aria-hidden="true"
                  className={`mt-1 size-1.5 shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${STATUS_DOT[tone]}`}
                />
                {CLAIM_LABEL[status]}
              </p>
              <p className="figure text-4xl sm:text-5xl">{count}</p>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="afirmaciones" className="space-y-8">
        <SectionTitle id="afirmaciones" eyebrow="Afirmación por afirmación">
          Lo que decimos, con el grado de <span className="pixel-accent">evidencia</span>.
        </SectionTitle>
        <ul className="grid gap-4 md:grid-cols-2">
          {CLAIMS.map((item) => (
            <li key={item.claim}>
              <Card as="article" className="h-full">
                <div className="flex h-full flex-col gap-4">
                  <div>
                    <Badge tone={STATUS_TONE[item.status]} dot>
                      {CLAIM_LABEL[item.status]}
                    </Badge>
                  </div>
                  <h3 className="text-lg leading-snug font-bold">{item.claim}</h3>
                  <p className="text-ink-soft">{item.explanation}</p>
                  {item.refs.length > 0 && (
                    <p className="mt-auto flex flex-wrap items-center gap-x-3 pt-2 text-base text-ink-soft">
                      <span className="font-semibold text-ink">Fuentes:</span>
                      {item.refs.map((ref) => (
                        <a
                          key={ref}
                          href={`#${ref}`}
                          className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
                        >
                          {ref}
                        </a>
                      ))}
                    </p>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="referencias" className="space-y-8">
        <SectionTitle id="referencias" eyebrow="Fuentes">
          Referencias.
        </SectionTitle>
        <ol className="space-y-4">
          {REFERENCES.map((reference) => {
            const verified = reference.verification === 'verificada';
            return (
              <li key={reference.id} id={reference.id} className="scroll-mt-28">
                <Card as="article">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-surface-2 px-2 py-1 text-xs">
                        {reference.id}
                      </code>
                      <Badge tone={verified ? 'brand' : 'accent'}>
                        {verified ? (
                          <SealCheckIcon weight="fill" aria-hidden="true" className="size-3.5" />
                        ) : (
                          <WarningIcon weight="fill" aria-hidden="true" className="size-3.5" />
                        )}
                        {verified ? 'Verificada' : 'Verificación parcial'}
                      </Badge>
                    </div>
                    <p className="font-medium">{reference.citation}</p>
                    <p className="text-ink-soft">{reference.finding}</p>
                    {reference.doi && (
                      <p className="text-base text-ink-soft">
                        DOI:{' '}
                        <a
                          className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
                          href={`https://doi.org/${reference.doi}`}
                          rel="noopener noreferrer"
                        >
                          {reference.doi}
                        </a>
                      </p>
                    )}
                    {reference.url && (
                      <p className="text-sm">
                        <a
                          className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
                          href={reference.url}
                          rel="noopener noreferrer"
                        >
                          Ver la fuente
                        </a>
                      </p>
                    )}
                    {reference.note && (
                      <p className="text-base text-ink-soft">Nota: {reference.note}</p>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="no-prometemos" className="space-y-8">
        <SectionTitle id="no-prometemos" eyebrow="Lo que no hacemos">
          No prometemos lo que no podemos <span className="pixel-accent">demostrar</span>.
        </SectionTitle>
        <Card>
          <ul className="space-y-4 text-lg text-ink-soft">
            <li className="flex gap-3">
              <XCircleIcon aria-hidden="true" className="mt-1 size-5 shrink-0" />
              No decimos que sirva para el TDAH, la demencia ni ninguna otra enfermedad.
            </li>
            <li className="flex gap-3">
              <XCircleIcon aria-hidden="true" className="mt-1 size-5 shrink-0" />
              No decimos que te haga más inteligente en general.
            </li>
            <li className="flex gap-3">
              <XCircleIcon aria-hidden="true" className="mt-1 size-5 shrink-0" />
              No usamos cifras virales sin fuente, como la de la atención de "8 segundos".
            </li>
            <li className="flex gap-3">
              <XCircleIcon aria-hidden="true" className="mt-1 size-5 shrink-0" />
              Medimos tu rendimiento en la app, y solo eso.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
