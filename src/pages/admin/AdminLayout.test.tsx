import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as consultas from '../../admin/consultas';
import { isCloudEnabled } from '../../services/supabase';
import AdminLayout from './AdminLayout';

vi.mock('../../services/supabase', () => ({
  isCloudEnabled: vi.fn(() => false),
}));

/** Respuesta JSON del servidor de sesión del panel. */
function estadoServidor(tipo: 'sin-sesion' | 'sin-admin' | 'sin-mfa' | 'admin') {
  return Promise.resolve(
    new Response(JSON.stringify({ tipo, correo: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

vi.mock('../../admin/consultas', () => ({
  leerResumen: vi.fn(),
  leerCompras: vi.fn(),
  leerUso: vi.fn(),
  leerAvisos: vi.fn(),
}));

function renderizar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/entrar" element={<p>PANTALLA_ENTRAR</p>} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>CONTENIDO_SECRETO</p>} />
          <Route path="seguridad" element={<p>PANTALLA_SEGURIDAD</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin nube no muestra datos ni hace peticiones', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(false);
    const red = vi.spyOn(globalThis, 'fetch');

    renderizar('/admin');

    expect(await screen.findByText('El panel necesita Supabase configurado')).toBeInTheDocument();
    expect(screen.queryByText('CONTENIDO_SECRETO')).not.toBeInTheDocument();
    expect(consultas.leerResumen).not.toHaveBeenCalled();
    expect(consultas.leerUso).not.toHaveBeenCalled();
    expect(consultas.leerCompras).not.toHaveBeenCalled();
    expect(consultas.leerAvisos).not.toHaveBeenCalled();
    expect(red).not.toHaveBeenCalled();
    red.mockRestore();
  });

  it('pide que no se indexe el panel', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(false);

    renderizar('/admin');

    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    });
  });

  it('sin sesión manda a la entrada sin mostrar nada del panel', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    const red = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => estadoServidor('sin-sesion'));

    renderizar('/admin');

    expect(await screen.findByText('PANTALLA_ENTRAR')).toBeInTheDocument();
    expect(screen.queryByText('CONTENIDO_SECRETO')).not.toBeInTheDocument();
    red.mockRestore();
  });

  it('con segundo factor pendiente manda a seguridad, sin mostrar el contenido', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    const red = vi.spyOn(globalThis, 'fetch').mockImplementation(() => estadoServidor('sin-mfa'));

    renderizar('/admin');

    expect(await screen.findByText('PANTALLA_SEGURIDAD')).toBeInTheDocument();
    expect(screen.queryByText('CONTENIDO_SECRETO')).not.toBeInTheDocument();
    red.mockRestore();
  });
});
