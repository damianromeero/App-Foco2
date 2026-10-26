import { useState, type SyntheticEvent } from 'react';
import { Navigate } from 'react-router';
import { MarcoAcceso } from '../../components/acceso/MarcoAcceso';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card, Notice, PageHeader } from '../../components/ui/Surfaces';
import { enlaceDeCompra, enviarEnlaceDeAcceso } from '../../services/acceso';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

/** Campo de correo: 16 px para no provocar zoom en iOS. */
const CAMPO =
  'min-h-12 w-full rounded-xl bg-canvas/60 px-3.5 text-base text-ink ring-1 ring-inset ring-ink/15 focus:ring-2 focus:ring-brand';

type Envio = 'inicial' | 'enviando' | 'enviado' | 'error';

/**
 * Entrada con el correo de la compra: pide un enlace. Sin contraseñas y sin revelar si el correo tiene compra.
 * Sin nube (plantilla sin Supabase) no hay acceso que pedir: lleva a la app, que funciona en este dispositivo.
 * Sin enlace de compra no se muestra el botón «Comprar». Lo que falta configurar lo lista `npm run verificar`.
 */
export default function Entrar() {
  useDocumentMeta({
    title: 'Entrar',
    description: 'Entra con el correo de tu compra.',
  });
  const conectado = isCloudEnabled();
  const enlace = enlaceDeCompra();
  const [correo, setCorreo] = useState('');
  const [envio, setEnvio] = useState<Envio>('inicial');

  const enviar = async (evento: SyntheticEvent<HTMLFormElement>) => {
    evento.preventDefault();
    setEnvio('enviando');
    try {
      await enviarEnlaceDeAcceso(correo.trim());
      registrarEvento('acceso_enlace_pedido');
      setEnvio('enviado');
    } catch {
      setEnvio('error');
    }
  };

  if (!conectado) return <Navigate to="/hoy" replace />;

  return (
    <MarcoAcceso>
      <PageHeader
        title="Entra con tu correo de compra"
        lead="Usa el correo con el que compraste. Te enviaremos un enlace, sin contraseñas."
      />

      {envio === 'enviado' && (
        <>
          <Notice tone="success">
            Si hay una compra con ese correo, te hemos enviado un enlace. Revisa tu bandeja.
          </Notice>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setEnvio('inicial');
            }}
          >
            Usar otro correo
          </Button>
        </>
      )}

      {envio !== 'enviado' && (
        <Card>
          <form
            onSubmit={(evento) => {
              void enviar(evento);
            }}
            className="space-y-5"
          >
            <label className="flex flex-col gap-2 text-base font-semibold">
              Correo de tu compra
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={correo}
                onChange={(evento) => {
                  setCorreo(evento.target.value);
                }}
                className={CAMPO}
              />
            </label>
            {envio === 'error' && (
              <p role="alert" className="text-base leading-relaxed text-danger-text">
                No pudimos enviar el enlace. Revisa tu conexión e inténtalo de nuevo.
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={envio === 'enviando' || correo.trim() === ''}
            >
              {envio === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}
            </Button>
          </form>
        </Card>
      )}

      {enlace && (
        <a href={enlace} rel="noopener" className={buttonClass('secondary', 'md', 'w-full')}>
          Comprar
        </a>
      )}
    </MarcoAcceso>
  );
}
