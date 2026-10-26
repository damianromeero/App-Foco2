import { useState, type SyntheticEvent } from 'react';
import { ADMIN_APP } from '../../admin/config';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { env } from '../../config/env';
import { getSupabaseComprador, isCloudEnabled } from '../../services/supabase';

type Fase = 'escribiendo' | 'enviando' | 'enviado' | 'limite' | 'fallo';

/** Entrada al panel: un enlace de un solo uso a tu correo. Sin contraseñas. Sin nube no envía nada. */
export default function Entrar() {
  useDocumentMeta({ title: 'Acceso al panel' });
  const configurado = isCloudEnabled();
  const [correo, setCorreo] = useState('');
  const [fase, setFase] = useState<Fase>('escribiendo');

  async function enviar(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (fase === 'enviando') return;
    setFase('enviando');
    try {
      // Cliente sin sesión persistente: el enlace solo sirve para pedir el correo. La sesión la guarda el servidor.
      const supabase = await getSupabaseComprador();
      if (!supabase) {
        setFase('fallo');
        return;
      }
      // shouldCreateUser: false. La respuesta es la misma exista o no el correo, salvo el límite de envíos.
      const { error } = await supabase.auth.signInWithOtp({
        email: correo.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${env.appUrl}/admin/confirmar`,
        },
      });
      setFase(error?.status === 429 ? 'limite' : 'enviado');
    } catch {
      setFase('fallo');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <meta name="robots" content="noindex" />
      <Card as="section" labelledBy="titulo-entrada">
        <p className="text-base text-ink-soft">{ADMIN_APP.nombre}</p>
        <h1 id="titulo-entrada" className="mt-1 text-2xl font-semibold text-ink">
          Panel de administración
        </h1>

        {!configurado ? (
          <p className="mt-4 text-base text-ink-soft">El panel necesita Supabase configurado</p>
        ) : (
          <>
            <p className="mt-2 text-base text-ink-soft">
              Solo entran las personas autorizadas. Te enviamos un enlace a tu correo.
            </p>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={(evento) => {
                void enviar(evento);
              }}
            >
              <label htmlFor="correo-admin" className="text-base text-ink">
                Correo
              </label>
              <input
                id="correo-admin"
                name="correo"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={correo}
                onChange={(evento) => {
                  setCorreo(evento.target.value);
                }}
                disabled={fase === 'enviando'}
                className="min-h-12 w-full rounded-2xl px-4 text-base text-ink glass ring-1 ring-inset ring-line"
              />
              <Button type="submit" disabled={fase === 'enviando' || correo.trim() === ''}>
                {fase === 'enviando' ? 'Enviando…' : 'Enviar enlace'}
              </Button>
            </form>

            {fase === 'enviado' ? (
              <p role="status" className="mt-4 text-base text-ink">
                Si el correo tiene acceso, te llegará un enlace en unos minutos. Revisa también la
                carpeta de spam.
              </p>
            ) : null}
            {fase === 'limite' ? (
              <p role="alert" className="mt-4 text-base text-danger-text">
                Hay demasiados intentos. Espera unos minutos y vuelve a intentarlo.
              </p>
            ) : null}
            {fase === 'fallo' ? (
              <p role="alert" className="mt-4 text-base text-danger-text">
                No pudimos enviar el enlace. Revisa tu conexión y vuelve a intentarlo.
              </p>
            ) : null}
          </>
        )}
      </Card>
    </main>
  );
}
