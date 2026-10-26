import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leerEstadoAcceso } from '../services/acceso';
import { isCloudEnabled } from '../services/supabase';
import { RequireAcceso } from './RequireAcceso';

vi.mock('../services/supabase', () => ({
  getSupabase: vi.fn(),
  isCloudEnabled: vi.fn(() => true),
}));

vi.mock('../services/acceso', () => ({
  leerEstadoAcceso: vi.fn(),
}));

const CORREO = 'correo@example.com';

function Zona() {
  return (
    <MemoryRouter initialEntries={['/hoy']}>
      <Routes>
        <Route
          path="/hoy"
          element={
            <RequireAcceso>
              <p>Zona privada</p>
            </RequireAcceso>
          }
        />
        <Route path="/entrar" element={<p>Pantalla de entrada</p>} />
        <Route path="/sin-compra" element={<p>Pantalla sin compra</p>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isCloudEnabled).mockReturnValue(true);
});

describe('RequireAcceso', () => {
  it('sin nube pasa directo, en demostración', () => {
    vi.mocked(isCloudEnabled).mockReturnValue(false);
    render(<Zona />);
    expect(screen.getByText('Zona privada')).toBeInTheDocument();
    expect(leerEstadoAcceso).not.toHaveBeenCalled();
  });

  it('mientras comprueba muestra el estado de carga y no los hijos', () => {
    vi.mocked(leerEstadoAcceso).mockReturnValue(new Promise(() => undefined));
    render(<Zona />);
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando tu acceso');
    expect(screen.queryByText('Zona privada')).not.toBeInTheDocument();
  });

  it('con acceso confirmado muestra los hijos', async () => {
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'con-acceso', correo: CORREO });
    render(<Zona />);
    expect(await screen.findByText('Zona privada')).toBeInTheDocument();
  });

  it('sin sesión lleva a la entrada y no muestra los hijos', async () => {
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-sesion' });
    render(<Zona />);
    expect(await screen.findByText('Pantalla de entrada')).toBeInTheDocument();
    expect(screen.queryByText('Zona privada')).not.toBeInTheDocument();
  });

  it('sin compra lleva a «sin compra» y no muestra los hijos', async () => {
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    render(<Zona />);
    expect(await screen.findByText('Pantalla sin compra')).toBeInTheDocument();
    expect(screen.queryByText('Zona privada')).not.toBeInTheDocument();
  });

  it('ante un error no muestra los hijos y ofrece reintentar', async () => {
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'error' });
    render(<Zona />);
    expect(
      await screen.findByRole('heading', { name: 'No pudimos comprobar tu acceso' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByText('Zona privada')).not.toBeInTheDocument();
  });

  it('reintentar vuelve a comprobar y muestra los hijos si ahora hay acceso', async () => {
    vi.mocked(leerEstadoAcceso)
      .mockResolvedValueOnce({ tipo: 'error' })
      .mockResolvedValueOnce({ tipo: 'con-acceso', correo: CORREO });
    const user = userEvent.setup();
    render(<Zona />);

    await user.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Zona privada')).toBeInTheDocument();
    expect(leerEstadoAcceso).toHaveBeenCalledTimes(2);
  });
});
