import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { plantilla } from '../../config/plantilla';
import { avisoDeBorradoHotmart } from '../../services/cuenta';
import { DialogoBorrarCuenta } from './DialogoBorrarCuenta';

// jsdom no implementa <dialog>.showModal/close: basta con reflejar el atributo para que el componente siga su ciclo.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
});

const abrir = (props: Partial<Parameters<typeof DialogoBorrarCuenta>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <DialogoBorrarCuenta open busy={false} onClose={onClose} onConfirm={onConfirm} {...props} />,
  );
  return { onConfirm, onClose };
};

describe('DialogoBorrarCuenta', () => {
  it('muestra el aviso exacto de Hotmart y el título de eliminación', () => {
    abrir();
    expect(screen.getByRole('heading', { name: 'Eliminar tu cuenta' })).toBeInTheDocument();
    expect(screen.getByText(avisoDeBorradoHotmart())).toBeInTheDocument();
    expect(screen.getByText(/escribe a correo@example\.com\./i)).toBeInTheDocument();
    expect(plantilla.soporteEmail).toBe('correo@example.com');
  });

  it('el botón de eliminar queda bloqueado hasta escribir ELIMINAR', async () => {
    const usuaria = userEvent.setup();
    const { onConfirm } = abrir();
    const boton = screen.getByRole('button', { name: 'Eliminar cuenta' });
    expect(boton).toBeDisabled();

    await usuaria.type(screen.getByLabelText(/escribe eliminar/i), 'eliminar');
    expect(boton).toBeDisabled();

    await usuaria.clear(screen.getByLabelText(/escribe eliminar/i));
    await usuaria.type(screen.getByLabelText(/escribe eliminar/i), 'ELIMINAR');
    expect(boton).toBeEnabled();

    await usuaria.click(boton);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('mientras hay una operación en curso no se puede confirmar', async () => {
    const usuaria = userEvent.setup();
    abrir({ busy: true });
    await usuaria.type(screen.getByLabelText(/escribe eliminar/i), 'ELIMINAR');
    expect(screen.getByRole('button', { name: 'Eliminar cuenta' })).toBeDisabled();
  });

  it('Volver cierra sin confirmar', async () => {
    const usuaria = userEvent.setup();
    const { onConfirm, onClose } = abrir();
    await usuaria.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
