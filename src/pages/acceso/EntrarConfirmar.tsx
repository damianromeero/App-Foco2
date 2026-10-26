import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Comprobando, ErrorComprobacion, MarcoAcceso } from '../../components/acceso/MarcoAcceso';
import { Card } from '../../components/ui/Surfaces';
import { LinkButton } from '../../components/ui/Button';
import { confirmarEnlace, type EstadoAcceso } from '../../services/acceso';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';
import { useAuthStore } from '../../store/authStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { plantilla } from '../../config/plantilla';

/**
 * Destino del enlace del correo. La librería convierte el enlace en sesión y aquí se comprueba la compra: con acceso va a
 * la app; sin compra, a «sin compra»; sin sesión (enlace no válido o caducado) o con un fallo, se explica y se ofrece
 * volver a intentarlo.
 */
export default function EntrarConfirmar() {
  useDocumentMeta({
    title: 'Confirmar acceso',
    description: `Comprobando tu acceso a ${plantilla.nombre}.`,
  });
  const navigate = useNavigate();
  const conectado = isCloudEnabled();
  const [estado, setEstado] = useState<EstadoAcceso | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!conectado) return;
    let vigente = true;
    // El hash trae los tokens del enlace: se lee una vez, se borra de la barra de direcciones y se entrega al servidor.
    const hash = window.location.hash;
    if (hash !== '') window.history.replaceState(null, '', window.location.pathname);
    void confirmarEnlace(hash).then((resultado) => {
      if (!vigente) return;
      void useAuthStore.getState().refrescar();
      if (resultado.tipo === 'con-acceso') {
        registrarEvento('acceso_confirmado');
        void navigate('/hoy', { replace: true });
        return;
      }
      if (resultado.tipo === 'sin-acceso') {
        void navigate('/sin-compra', { replace: true });
        return;
      }
      setEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [conectado, intento, navigate]);

  // Sin nube no hay enlace que confirmar: la app funciona en este dispositivo.
  if (!conectado) return <Navigate to="/hoy" replace />;

  if (estado === null) {
    return (
      <MarcoAcceso>
        <Comprobando />
      </MarcoAcceso>
    );
  }

  if (estado.tipo === 'sin-sesion') {
    return (
      <MarcoAcceso>
        <Card>
          <div className="space-y-4">
            <p role="alert" className="text-base leading-relaxed">
              El enlace no es válido o ya caducó.
            </p>
            <LinkButton to="/entrar" className="w-full">
              Pedir un enlace nuevo
            </LinkButton>
          </div>
        </Card>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso>
      <ErrorComprobacion
        onReintentar={() => {
          setEstado(null);
          setIntento((valor) => valor + 1);
        }}
      />
    </MarcoAcceso>
  );
}
