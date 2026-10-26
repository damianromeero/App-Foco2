import { ArrowRightIcon, LockIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { Badge, Card, PageHeader } from '../../components/ui/Surfaces';
import { LESSONS } from '../../content/lessons';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useEntitlement } from '../../hooks/useBillingView';

export default function Lessons() {
  useDocumentMeta({
    title: 'Lecciones',
    description:
      'Micro-lecciones de un minuto sobre atención, multitarea y hábitos digitales, con sus fuentes.',
  });
  const entitlement = useEntitlement();
  const lessonsRead = useAppStore((state) => state.lessonsRead);

  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="pixel-accent">Lecciones</span>}
        lead="Un minuto de ciencia cada vez, con sus fuentes. Lo que no sabemos, también lo decimos."
      />
      <ul className="space-y-4">
        {LESSONS.map((lesson, index) => {
          const locked = !lesson.free && entitlement !== 'premium';
          const read = lessonsRead.includes(lesson.id);
          return (
            <li
              key={lesson.id}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Card as="article" labelledBy={`leccion-${lesson.id}`}>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="eyebrow">
                      {String(index + 1).padStart(2, '0')} · {lesson.minutes} min
                    </p>
                    {read && (
                      <Badge tone="brand" dot>
                        Leída
                      </Badge>
                    )}
                    {locked && (
                      <Badge tone="premium">
                        <LockIcon size={12} weight="fill" aria-hidden="true" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <h2 id={`leccion-${lesson.id}`} className="text-2xl">
                      {lesson.title}
                    </h2>
                    <p className="text-ink-soft">{lesson.summary}</p>
                  </div>
                  <Link
                    to={`/lecciones/${lesson.id}`}
                    className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand underline-offset-4 hover:underline"
                  >
                    {locked ? 'Ver el resumen' : 'Leer la lección'}
                    <ArrowRightIcon size={18} weight="bold" aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
