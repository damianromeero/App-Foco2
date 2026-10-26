import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link, useParams } from 'react-router';
import { Button, LinkButton } from '../../components/ui/Button';
import { Card, Notice, PageHeader } from '../../components/ui/Surfaces';
import { lessonById, LESSONS } from '../../content/lessons';
import { referenceById } from '../../content/science';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';

/** Titular con la última palabra en cursiva serif. */
function accentLast(text: string) {
  const words = text.split(' ');
  const last = words.pop();
  if (words.length === 0) return <span className="pixel-accent">{text}</span>;
  return (
    <>
      {words.join(' ')} <span className="pixel-accent">{last}</span>
    </>
  );
}

export default function LessonDetail() {
  const { id } = useParams();
  const lesson = id ? lessonById(id) : undefined;
  useDocumentMeta({
    title: lesson ? lesson.title : 'Lección',
    description: lesson?.summary,
  });
  const entitlement = useEntitlement();
  const lessonsRead = useAppStore((state) => state.lessonsRead);
  const markLessonRead = useAppStore((state) => state.markLessonRead);

  if (!lesson) {
    return (
      <div className="mx-auto max-w-xl space-y-8">
        <PageHeader
          title={
            <>
              Esa lección <span className="pixel-accent">no existe</span>
            </>
          }
        />
        <LinkButton to="/lecciones">Volver a las lecciones</LinkButton>
      </div>
    );
  }

  const locked = !lesson.free && entitlement !== 'premium';
  const read = lessonsRead.includes(lesson.id);
  const index = LESSONS.findIndex((item) => item.id === lesson.id);
  const next = LESSONS[index + 1];

  return (
    <article className="mx-auto w-full max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Un minuto de ciencia"
        title={accentLast(lesson.title)}
        lead={lesson.summary}
      />

      {locked ? (
        <Notice
          tone="premium"
          title="Esta lección es Premium."
          action={
            <LinkButton to="/precios" variant="premium">
              Ver planes
            </LinkButton>
          }
        >
          Puedes leer el resumen y las fuentes en la pestaña Ciencia.
        </Notice>
      ) : (
        <Card>
          <div className="max-w-prose space-y-6 text-lg leading-[1.75]">
            {lesson.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </Card>
      )}

      {lesson.refs.length > 0 && (
        <section aria-labelledby="fuentes" className="space-y-3">
          <h2 id="fuentes" className="eyebrow">
            Fuentes
          </h2>
          <ul className="max-w-prose space-y-3 border-l-2 border-line pl-4 font-mono text-sm leading-relaxed text-ink-soft">
            {lesson.refs.map((refId) => {
              const reference = referenceById(refId);
              return reference ? (
                <li key={refId}>
                  <Link
                    to={`/ciencia#${refId}`}
                    className="py-3.5 font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {reference.citation}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {!locked && (
          <Button
            size="lg"
            variant={read ? 'secondary' : 'primary'}
            onClick={() => {
              markLessonRead(lesson.id);
            }}
            disabled={read}
          >
            {read ? 'Leída' : 'Marcar como leída'}
          </Button>
        )}
        {next && (
          <Link
            to={`/lecciones/${next.id}`}
            className="glass ring-gradient inline-flex min-h-12 items-center justify-between gap-3 rounded-2xl px-5 font-semibold text-ink"
          >
            Siguiente: {next.title}
            <ArrowRightIcon
              size={18}
              weight="bold"
              className="shrink-0 text-brand"
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
    </article>
  );
}
