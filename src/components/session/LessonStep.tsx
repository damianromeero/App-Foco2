import { Link } from 'react-router';
import { referenceById } from '../../content/science';
import type { Lesson } from '../../content/lessons';
import { Button } from '../ui/Button';
import { Card } from '../ui/Surfaces';

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

export function LessonStep({ lesson, onDone }: { lesson: Lesson; onDone: () => void }) {
  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <div className="space-y-3">
        <p className="eyebrow flex items-center gap-2 text-brand">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full bg-brand shadow-[0_0_10px_currentColor]"
          />
          Un minuto de ciencia
        </p>
        <h2 className="text-3xl leading-[1.05]">{accentLast(lesson.title)}</h2>
      </div>
      <Card>
        <div className="max-w-prose space-y-5 text-lg leading-[1.75]">
          {lesson.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {lesson.refs.length > 0 && (
          <ul className="mt-6 space-y-2 border-l-2 border-line pl-4 font-mono text-sm leading-relaxed text-ink-soft">
            {lesson.refs.map((refId) => {
              const reference = referenceById(refId);
              return reference ? (
                <li key={refId}>
                  Fuente:{' '}
                  <Link
                    to={`/ciencia#${refId}`}
                    className="font-medium text-brand underline-offset-4 hover:underline"
                  >
                    {reference.label}
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        )}
      </Card>
      <Button size="lg" className="w-full" onClick={onDone}>
        Entendido
      </Button>
    </div>
  );
}
