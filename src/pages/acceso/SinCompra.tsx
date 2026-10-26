import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Comprobando, ErrorComprobacion, MarcoAcceso } from '../../components/acceso/MarcoAcceso';
import { Button, buttonClass } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import {
  cerrarSesionDeAcceso,
  enlaceDeCompra,
  enmascararCorreo,
  leerEstadoAcceso,
  type EstadoAcceso,
} from '../../services/acceso';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

/**
 * Pantalla para quien entró con un correo sin compra activa. Muestra el correo enmascarado y permite usar otro correo o
 * cerrar la sesión. Si no hay enlace de compra configurado, no muestra ningún botón de compra (sin avisos: lo que falta lo
 * lista `npm run verificar`).
 */
export default function SinCompra() {
  useDocumentMeta({
    title: 'Sin compra',
    description: 'Tu correo no tiene una compra activa en Foco Mente.',
  });
  const navigate = useNavigate();
  const conectado = isCloudEnabled();
  const enlace = enlaceDeCompra();
  const [estado, setEstado] = useState<EstadoAcceso | null>(null);
  const [intento, setIntento] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [falloSalir, setFalloSalir] = useState(false);

  useEffect(() => {
    if (!conectado) return;
    let vigente = true;
    void leerEstadoAcceso().then((resultado) => {
      if (!vigente) return;
      if (resultado.tipo === 'con-acceso') {
        void navigate('/hoy', { replace: true });
        return;
      }
      if (resultado.tipo === 'sin-sesion') {
        void navigate('/entrar', { replace: true });
        return;
      }
      setEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [conectado, intento, navigate]);

  useEffect(() => {
    if (estado?.tipo === 'sin-acceso') registrarEvento('sin_compra_visto');
  }, [estado]);

  const salir = async () => {
    setSaliendo(true);
    setFalloSalir(false);
    try {
      await cerrarSesionDeAcceso();
      await useAuthStore.getState().refrescar();
      void navigate('/entrar', { replace: true });
    } catch {
      setFalloSalir(true);
      setSaliendo(false);
    }
  };

  // Sin nube no hay compras que comprobar: la app funciona en este dispositivo.
  if (!conectado) return <Navigate to="/hoy" replace />;

  if (estado === null) {
    return (
      <MarcoAcceso>
        <Comprobando />
      </MarcoAcceso>
    );
  }

  if (estado.tipo !== 'sin-acceso') {
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

  const enmascarado = enmascararCorreo(estado.correo);

  return (
    <MarcoAcceso>
      <div className="space-y-4">
        <h1 className="text-[2rem] leading-[1.1]">
          No encontramos una compra activa con este correo.
        </h1>
        <p className="text-base leading-relaxed text-ink-soft">
          {enmascarado ? (
            <>
              Entraste como <span className="font-semibold text-ink">{enmascarado}</span>.{' '}
            </>
          ) : null}
          Si compraste con otro correo, entra con ese. Si todavía no has comprado, tu acceso se
          activa con la compra.
        </p>
      </div>

      <div className="space-y-3">
        {enlace && (
          <a
            href={enlace}
            rel="noopener"
            className={buttonClass('primary', 'lg', 'w-full')}
            onClick={() => {
              registrarEvento('compra_clic');
            }}
          >
            Comprar
          </a>
        )}
        <Button
          variant="secondary"
          className="w-full"
          disabled={saliendo}
          onClick={() => {
            void salir();
          }}
        >
          Usar otro correo
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          disabled={saliendo}
          onClick={() => {
            void salir();
          }}
        >
          Cerrar sesión
        </Button>
        {falloSalir && (
          <p role="alert" className="text-base leading-relaxed text-danger-text">
            No pudimos cerrar la sesión. Inténtalo de nuevo.
          </p>
        )}
      </div>
    </MarcoAcceso>
  );
}
