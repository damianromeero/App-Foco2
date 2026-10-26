import { useId } from 'react';
import { Link } from 'react-router';
import { Card } from '../ui/Surfaces';

/** Cifra con su etiqueta, una nota opcional y, si hace falta, un enlace a la sección donde se resuelve. */
export function TarjetaKpi({
  etiqueta,
  valor,
  nota,
  enlace,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  enlace?: { href: string; texto: string };
}) {
  const id = useId();
  return (
    <Card as="section" labelledBy={id} className="flex flex-col">
      <h2 id={id} className="text-base text-ink-soft">
        {etiqueta}
      </h2>
      <p className="mt-2 text-3xl font-semibold text-ink tabular-nums">{valor}</p>
      {nota ? <p className="mt-1 text-base text-ink-soft">{nota}</p> : null}
      {enlace ? (
        <Link
          to={enlace.href}
          className="mt-4 inline-flex min-h-11 items-center text-base font-medium text-accent-text underline underline-offset-4"
        >
          {enlace.texto}
        </Link>
      ) : null}
    </Card>
  );
}
