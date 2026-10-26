import { useEffect, useState } from 'react';
import { MINUTE_MS } from '../domain/time';

/** Fecha actual que se refresca cada minuto (suficiente para días, cuentas atrás y cambios de día). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, MINUTE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return now;
}
