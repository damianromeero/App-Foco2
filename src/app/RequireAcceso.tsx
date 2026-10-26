import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { Comprobando, ErrorComprobacion, MarcoAcceso } from '../components/acceso/MarcoAcceso';
import { leerEstadoAcceso, type EstadoAcceso } from '../services/acceso';
import { isCloudEnabled } from '../services/supabase';

/**
 * Protege la zona de la app. Sin Supabase configurado es la demostración local y pasa directo. Con Supabase, solo deja
 * ver los hijos a quien tiene sesión y una compra activa: sin sesión va a la entrada y sin compra a «sin compra». Un fallo
 * muestra error con reintentar; nunca deja pasar.
 */
export function RequireAcceso({ children }: { children: ReactNode }) {
  const conectado = isCloudEnabled();
  const [estado, setEstado] = useState<EstadoAcceso | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!conectado) return;
    let vigente = true;
    void leerEstadoAcceso().then((resultado) => {
      if (vigente) setEstado(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [conectado, intento]);

  if (!conectado) return <>{children}</>;

  if (estado === null) {
    return (
      <MarcoAcceso>
        <Comprobando />
      </MarcoAcceso>
    );
  }

  if (estado.tipo === 'con-acceso') return <>{children}</>;
  if (estado.tipo === 'sin-sesion') return <Navigate to="/entrar" replace />;
  if (estado.tipo === 'sin-acceso') return <Navigate to="/sin-compra" replace />;

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
