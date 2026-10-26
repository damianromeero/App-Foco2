import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * Diálogo modal con el elemento <dialog> nativo: foco atrapado, Escape para cerrar
 * y anuncio correcto a los lectores de pantalla. En móvil sube desde abajo como hoja de cristal.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => {
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-0 w-full max-w-md bg-transparent p-0 text-ink backdrop:bg-black/55 backdrop:backdrop-blur-sm max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:mx-auto max-sm:max-w-none sm:m-auto sm:w-[min(92vw,28rem)]"
    >
      <div className="open:animate-sheet relative overflow-hidden rounded-t-sheet bg-surface pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lift ring-gradient sm:rounded-sheet">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--c-glow-1),transparent)]"
        />
        <div
          aria-hidden="true"
          className="relative mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-line-strong sm:hidden"
        />
        <div className="relative space-y-5 p-6 pt-5">
          <h2 id={titleId} className="text-[1.7rem]">
            {title}
          </h2>
          {children}
        </div>
      </div>
    </dialog>
  );
}
