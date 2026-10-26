import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { confirmarEnlaceAdmin, type EstadoAdmin } from '../../admin/sesion';
import { Card } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { isCloudEnabled } from '../../services/supabase';

/**
 * Una sola confirmación en vuelo. En desarrollo, StrictMode ejecuta el efecto dos veces: la segunda ejecución ya no ve el
 * hash (se borró) y reutiliza la misma confirmación, para no leer la cookie antes de que el servidor la fije.
 */
let confirmacionEnVuelo: Promise<EstadoAdmin> | null = null;

function confirmar(hash: string): Promise<EstadoAdmin> {
  if (confirmacionEnVuelo !== null) return confirmacionEnVuelo;
  const promesa = confirmarEnlaceAdmin(hash).finally(() => {
    confirmacionEnVuelo = null;
  });
  confirmacionEnVuelo = promesa;
  return promesa;
}

/**
 * Destino del enlace del correo. Los tokens llegan en el hash: se entregan al servidor, que los guarda en una cookie
 * httpOnly, y el hash se borra de la barra de direcciones. Según el estado: con segundo factor pendiente va a
 * Seguridad; con acceso, al panel; sin permiso, a la pantalla de «no hay nada aquí»; sin sesión, se explica el error.
 */
export default function Confirmar() {
  useDocumentMeta({ title: 'Confirmar acceso' });
  const navigate = useNavigate();
  const configurado = isCloudEnabled();
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    if (!configurado) return;
    let vigente = true;
    const hash = window.location.hash;
    if (hash !== '') window.history.replaceState(null, '', window.location.pathname);
    void confirmar(hash).then((estado) => {
      if (!vigente) return;
      if (estado === 'segundo-factor-pendiente') {
        void navigate('/admin/seguridad', { replace: true });
      } else if (estado === 'listo' || estado === 'sin-permiso') {
        void navigate('/admin', { replace: true });
      } else {
        setFallo(true);
      }
    });
    return () => {
      vigente = false;
    };
  }, [configurado, navigate]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <meta name="robots" content="noindex" />
      <Card as="section" labelledBy="titulo-confirmar">
        <h1 id="titulo-confirmar" className="text-2xl font-semibold text-ink">
          Acceso al panel
        </h1>
        {!configurado ? (
          <p className="mt-4 text-base text-ink-soft">El panel necesita Supabase configurado</p>
        ) : fallo ? (
          <div className="mt-4 flex flex-col gap-4">
            <p role="alert" className="text-base text-danger-text">
              No pudimos confirmar tu acceso. El enlace puede haber caducado.
            </p>
            <Link
              to="/admin/entrar"
              className="inline-flex min-h-11 items-center text-base font-medium text-accent-text underline underline-offset-4"
            >
              Pedir un enlace nuevo
            </Link>
          </div>
        ) : (
          <p role="status" className="mt-4 text-base text-ink-soft">
            Confirmando tu acceso…
          </p>
        )}
      </Card>
    </main>
  );
}
