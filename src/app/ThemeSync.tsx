import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';

/** Aplica al <html> las preferencias de tema, texto y movimiento. El script de arranque ya lo hizo; esto mantiene los cambios en vivo. */
export function ThemeSync() {
  const theme = useAppStore((state) => state.settings.theme);
  const textSize = useAppStore((state) => state.settings.textSize);
  const reduceMotion = useAppStore((state) => state.settings.reduceMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.text = textSize;
    root.dataset.motion = reduceMotion;
  }, [theme, textSize, reduceMotion]);

  return null;
}
