import { useEffect, useState } from 'react';

export type EstadoConsulta<T> =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; datos: T }
  | { tipo: 'sin-nube' }
  | { tipo: 'error'; mensaje: string };

interface Resultado<T> {
  clave: string;
  estado: EstadoConsulta<T>;
}

const MENSAJE_GENERICO = 'No pudimos leer los datos del panel. Vuelve a intentarlo.';

/**
 * Lee una consulta del panel y la vuelve a pedir cuando cambia el parámetro o al reintentar. Nunca muestra el resultado
 * de una petición anterior: mientras llega la nueva, el estado es «cargando».
 */
export function useConsulta<P extends string, T>(
  consulta: (parametro: P) => Promise<T | null>,
  parametro: P,
): { estado: EstadoConsulta<T>; reintentar: () => void } {
  const [intento, setIntento] = useState(0);
  const [resultado, setResultado] = useState<Resultado<T> | null>(null);
  const clave = `${parametro}#${String(intento)}`;

  useEffect(() => {
    let vigente = true;
    consulta(parametro).then(
      (datos) => {
        if (!vigente) return;
        setResultado({
          clave,
          estado: datos === null ? { tipo: 'sin-nube' } : { tipo: 'listo', datos },
        });
      },
      (error: unknown) => {
        if (!vigente) return;
        setResultado({
          clave,
          estado: {
            tipo: 'error',
            mensaje: error instanceof Error ? error.message : MENSAJE_GENERICO,
          },
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, [consulta, parametro, clave]);

  const estado: EstadoConsulta<T> =
    resultado?.clave === clave ? resultado.estado : { tipo: 'cargando' };

  return {
    estado,
    reintentar: () => {
      setIntento((actual) => actual + 1);
    },
  };
}
