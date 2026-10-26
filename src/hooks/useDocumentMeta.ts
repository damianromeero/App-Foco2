import { useEffect } from 'react';
import { plantilla } from '../config/plantilla';

interface DocumentMeta {
  title: string;
  description?: string;
}

/**
 * Título y descripción por página. Cada ruta tiene el suyo para que sea legible
 * en pestañas, historial y resultados de búsqueda.
 */
export function useDocumentMeta({ title, description }: DocumentMeta): void {
  useEffect(() => {
    const fullTitle = title === plantilla.nombre ? title : `${title} · ${plantilla.nombre}`;
    document.title = fullTitle;
    if (description) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'description';
        document.head.append(tag);
      }
      tag.content = description;
    }
  }, [title, description]);
}
