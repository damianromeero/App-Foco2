import { useState } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Notice } from '../ui/Surfaces';
import {
  PALABRA_CONFIRMAR_BORRADO,
  avisoDeBorradoHotmart,
  confirmacionDeBorradoValida,
} from '../../services/cuenta';

/** Campo de confirmación: 16 px para no provocar zoom en iOS. */
const FIELD =
  'min-h-12 w-full rounded-xl bg-canvas/60 px-3.5 text-base text-ink ring-1 ring-inset ring-ink/15';

/**
 * Diálogo para eliminar la cuenta. Muestra el aviso de Hotmart y exige escribir ELIMINAR antes de poder confirmar. Al
 * confirmar solo llama a `onConfirm`: el borrado lo hace el padre con la base, nunca con un proveedor de cobros.
 */
export function DialogoBorrarCuenta({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [escrito, setEscrito] = useState('');
  const valido = confirmacionDeBorradoValida(escrito);

  const cerrar = () => {
    setEscrito('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={cerrar} title="Eliminar tu cuenta">
      <Notice tone="accent" title="Antes de eliminar tu cuenta">
        {avisoDeBorradoHotmart()}
      </Notice>
      <p className="text-ink-soft">
        Se borran tu cuenta, tus sesiones guardadas en el servidor y los datos de este dispositivo.
        Esto no se puede deshacer. Si quieres conservarlos, descárgalos antes.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valido && !busy) onConfirm();
        }}
        className="space-y-4"
      >
        <label className="flex flex-col gap-2 text-sm font-medium">
          Escribe {PALABRA_CONFIRMAR_BORRADO} para confirmar
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            value={escrito}
            onChange={(event) => {
              setEscrito(event.target.value);
            }}
            className={FIELD}
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={cerrar}>
            Volver
          </Button>
          <Button type="submit" variant="danger" disabled={!valido || busy}>
            Eliminar cuenta
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
