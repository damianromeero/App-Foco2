import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Card, Notice, PageHeader } from '../../components/ui/Surfaces';
import { LEGAL_DOCUMENTS, LEGAL_DRAFT_NOTICE, legalDocument } from '../../content/legal';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

/** Resalta la última palabra del título en cursiva de Instrument Serif. */
function accentLast(title: string): ReactNode {
  // Acepta espacio normal o sin ruptura (\u00a0) para que no se parta la última palabra.
  const space = Math.max(title.lastIndexOf(' '), title.lastIndexOf('\u00a0'));
  if (space === -1) return title;
  return (
    <>
      {title.slice(0, space + 1)}
      <span className="pixel-accent">{title.slice(space + 1)}</span>
    </>
  );
}

export default function Legal() {
  const { slug } = useParams();
  const document = legalDocument(slug ?? '');
  useDocumentMeta({
    title: document ? document.title : 'Legal',
    description: document?.description,
  });

  if (!document) {
    return <Navigate to="/legal/privacidad" replace />;
  }

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <PageHeader
        eyebrow="Información legal"
        title={accentLast(document.title)}
        lead={document.description}
      />

      {/* Aviso para quien vende la app: solo en desarrollo, nunca lo ve el cliente. */}
      {import.meta.env.DEV && (
        <Notice tone="accent" title="Documento en borrador">
          {LEGAL_DRAFT_NOTICE}
        </Notice>
      )}

      <nav aria-label="Documentos legales" className="flex flex-wrap gap-2 text-sm">
        {LEGAL_DOCUMENTS.map((item) => {
          const current = item.slug === document.slug;
          return (
            <Link
              key={item.slug}
              to={`/legal/${item.slug}`}
              aria-current={current ? 'page' : undefined}
              className={`pressable inline-flex min-h-11 items-center rounded-full px-4 font-semibold ${current ? 'fill-brand text-brand-ink shadow-[var(--shadow-glow)]' : 'glass ring-1 ring-inset ring-line text-ink-soft hover:text-ink'}`}
            >
              {item.title}
            </Link>
          );
        })}
      </nav>

      {document.sections.map((section, index) => (
        <Card key={section.heading} labelledBy={`seccion-${index}`}>
          <div className="space-y-4">
            <h2 id={`seccion-${index}`} className="text-xl font-bold">
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-ink-soft">
                {paragraph}
              </p>
            ))}
          </div>
        </Card>
      ))}
    </article>
  );
}
