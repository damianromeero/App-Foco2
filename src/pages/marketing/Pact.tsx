import { Card, PageHeader, SectionTitle } from '../../components/ui/Surfaces';
import { PACT } from '../../content/pact';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

export default function Pact() {
  useDocumentMeta({
    title: 'El Pacto Sin Trampas',
    description:
      'Diez promesas públicas sobre precio, cobros, reembolso y datos, con cómo comprobarlas.',
  });

  return (
    <div className="space-y-16">
      <PageHeader
        eyebrow="Compromisos"
        title={
          <>
            El Pacto Sin <span className="pixel-accent">Trampas</span>
          </>
        }
        lead="Diez promesas que se pueden comprobar dentro de la app. Cada una dice dónde mirar. Si dejamos de cumplir alguna, lo cambiamos aquí primero."
      />

      <section aria-labelledby="promesas-pacto" className="space-y-8">
        <SectionTitle id="promesas-pacto" eyebrow="Las promesas">
          Lo que prometemos y cómo <span className="pixel-accent">verificarlo</span>.
        </SectionTitle>
        <ol className="grid gap-4 md:grid-cols-2">
          {PACT.map((item, index) => (
            <li key={item.promise}>
              <Card as="article" className="h-full">
                <div className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="glass ring-gradient flex size-12 shrink-0 items-center justify-center rounded-2xl font-mono text-sm font-medium text-brand"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 space-y-3">
                    <h3 className="text-xl font-bold">{item.promise}</h3>
                    <p className="text-ink-soft">
                      <span className="font-semibold text-ink">Cómo comprobarlo:</span>{' '}
                      {item.howToCheck}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
