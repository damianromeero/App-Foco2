import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Acceso from '../../services/acceso';
import {
  cerrarSesionDeAcceso,
  enviarEnlaceDeAcceso,
  confirmarEnlace,
  leerEstadoAcceso,
} from '../../services/acceso';
import { registrarEvento } from '../../services/medicion';
import { isCloudEnabled } from '../../services/supabase';
import Entrar from './Entrar';
import EntrarConfirmar from './EntrarConfirmar';
import SinCompra from './SinCompra';

const env = vi.hoisted(() => ({
  appUrl: 'https://app.test',
  enlaceCompra: undefined as string | undefined,
}));

vi.mock('../../config/env', () => ({ env }));

vi.mock('../../services/supabase', () => ({
  getSupabase: vi.fn(),
  isCloudEnabled: vi.fn(() => false),
}));

vi.mock('../../services/medicion', () => ({
  registrarEvento: vi.fn(),
}));

vi.mock('../../services/acceso', async (importOriginal) => {
  const real = await importOriginal<typeof Acceso>();
  return {
    ...real,
    enviarEnlaceDeAcceso: vi.fn((_correo: string) => Promise.resolve()),
    confirmarEnlace: vi.fn(),
    leerEstadoAcceso: vi.fn(),
    cerrarSesionDeAcceso: vi.fn(() => Promise.resolve()),
  };
});

const CORREO = 'correo@example.com';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isCloudEnabled).mockReturnValue(false);
  env.enlaceCompra = undefined;
});

/** /entrar dentro de un router, con /hoy como destino visible. */
function EntrarConRutas() {
  return (
    <MemoryRouter initialEntries={['/entrar']}>
      <Routes>
        <Route path="/entrar" element={<Entrar />} />
        <Route path="/hoy" element={<p>Pantalla de hoy</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Entrar', () => {
  it('sin nube lleva a la app en silencio: sin avisos internos, sin formulario y sin envíos', () => {
    render(<EntrarConRutas />);
    expect(screen.getByText('Pantalla de hoy')).toBeInTheDocument();
    expect(screen.queryByText(/todavía|esta copia|demostración|configurad/i)).toBeNull();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviarme el enlace' })).not.toBeInTheDocument();
    expect(enviarEnlaceDeAcceso).not.toHaveBeenCalled();
  });

  it('con nube envía el correo y muestra el mensaje genérico', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    const user = userEvent.setup();
    render(<EntrarConRutas />);

    await user.type(screen.getByLabelText('Correo de tu compra'), CORREO);
    await user.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

    expect(enviarEnlaceDeAcceso).toHaveBeenCalledWith(CORREO);
    expect(
      await screen.findByText(
        'Si hay una compra con ese correo, te hemos enviado un enlace. Revisa tu bandeja.',
      ),
    ).toBeInTheDocument();
  });

  it('si el envío falla por causa ajena, avisa sin revelar nada del correo', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(enviarEnlaceDeAcceso).mockRejectedValueOnce(new Error('red'));
    const user = userEvent.setup();
    render(<EntrarConRutas />);

    await user.type(screen.getByLabelText('Correo de tu compra'), CORREO);
    await user.click(screen.getByRole('button', { name: 'Enviarme el enlace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos enviar el enlace');
  });

  it('sin enlace de compra no muestra botón de compra ni avisos internos', () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    render(<EntrarConRutas />);
    expect(screen.getByLabelText('Correo de tu compra')).toBeInTheDocument();
    expect(screen.queryByText(/todavía|configurad/i)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Comprar' })).not.toBeInTheDocument();
  });

  it('con enlace de compra muestra un enlace real', () => {
    env.enlaceCompra = 'https://pago.example/foco';
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    render(<EntrarConRutas />);
    expect(screen.getByRole('link', { name: 'Comprar' })).toHaveAttribute(
      'href',
      'https://pago.example/foco',
    );
  });
});

function Rutas({ inicio }: { inicio: string }) {
  return (
    <MemoryRouter initialEntries={[inicio]}>
      <Routes>
        <Route path="/sin-compra" element={<SinCompra />} />
        <Route path="/entrar/confirmar" element={<EntrarConfirmar />} />
        <Route path="/entrar" element={<p>Pantalla de entrada</p>} />
        <Route path="/hoy" element={<p>Pantalla de hoy</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SinCompra', () => {
  it('sin enlace de compra no muestra un enlace roto', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    render(<Rutas inicio="/sin-compra" />);

    expect(
      await screen.findByText('No encontramos una compra activa con este correo.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/todavía no está configurada/i)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Comprar' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar otro correo' })).toBeInTheDocument();
  });

  it('sin nube, /sin-compra y /entrar/confirmar llevan a la app sin avisos', () => {
    const { unmount } = render(<Rutas inicio="/sin-compra" />);
    expect(screen.getByText('Pantalla de hoy')).toBeInTheDocument();
    unmount();
    render(<Rutas inicio="/entrar/confirmar" />);
    expect(screen.getByText('Pantalla de hoy')).toBeInTheDocument();
    expect(leerEstadoAcceso).not.toHaveBeenCalled();
    expect(confirmarEnlace).not.toHaveBeenCalled();
  });

  it('muestra el correo enmascarado, nunca completo', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    render(<Rutas inicio="/sin-compra" />);

    expect(await screen.findByText('c***@example.com')).toBeInTheDocument();
    expect(screen.queryByText(CORREO)).not.toBeInTheDocument();
  });

  it('con enlace de compra muestra Comprar con rel noopener', async () => {
    env.enlaceCompra = 'https://pago.example/foco';
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    render(<Rutas inicio="/sin-compra" />);

    const enlace = await screen.findByRole('link', { name: 'Comprar' });
    expect(enlace).toHaveAttribute('href', 'https://pago.example/foco');
    expect(enlace).toHaveAttribute('rel', 'noopener');
  });

  it('registra el aviso de sin compra al mostrarse', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    render(<Rutas inicio="/sin-compra" />);

    await screen.findByText('No encontramos una compra activa con este correo.');
    expect(registrarEvento).toHaveBeenCalledWith('sin_compra_visto');
  });

  it('pulsar Comprar registra el clic, sin plan', async () => {
    env.enlaceCompra = 'https://pago.example/foco';
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    const user = userEvent.setup();
    render(<Rutas inicio="/sin-compra" />);

    const enlace = await screen.findByRole('link', { name: 'Comprar' });
    // Evita la navegación real de jsdom: solo interesa el registro del clic.
    enlace.addEventListener('click', (evento) => {
      evento.preventDefault();
    });
    await user.click(enlace);

    expect(registrarEvento).toHaveBeenCalledWith('compra_clic');
  });

  it('«Usar otro correo» cierra la sesión y va a la entrada', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    const user = userEvent.setup();
    render(<Rutas inicio="/sin-compra" />);

    await user.click(await screen.findByRole('button', { name: 'Usar otro correo' }));

    expect(cerrarSesionDeAcceso).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Pantalla de entrada')).toBeInTheDocument();
  });
});

describe('EntrarConfirmar', () => {
  it('con acceso registra la confirmación y lleva a la app', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(confirmarEnlace).mockResolvedValue({ tipo: 'con-acceso', correo: CORREO });
    render(<Rutas inicio="/entrar/confirmar" />);

    expect(await screen.findByText('Pantalla de hoy')).toBeInTheDocument();
    expect(registrarEvento).toHaveBeenCalledWith('acceso_confirmado');
  });

  it('sin compra lleva a «sin compra» sin registrar la confirmación', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(confirmarEnlace).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    vi.mocked(leerEstadoAcceso).mockResolvedValue({ tipo: 'sin-acceso', correo: CORREO });
    render(<Rutas inicio="/entrar/confirmar" />);

    expect(
      await screen.findByText('No encontramos una compra activa con este correo.'),
    ).toBeInTheDocument();
    expect(registrarEvento).not.toHaveBeenCalledWith('acceso_confirmado');
  });

  it('sin sesión explica que el enlace no vale y ofrece pedir uno nuevo', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(confirmarEnlace).mockResolvedValue({ tipo: 'sin-sesion' });
    render(<Rutas inicio="/entrar/confirmar" />);

    expect(await screen.findByText('El enlace no es válido o ya caducó.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
      'href',
      '/entrar',
    );
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it('ante un error ofrece reintentar y no deja pasar', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    vi.mocked(confirmarEnlace).mockResolvedValue({ tipo: 'error' });
    render(<Rutas inicio="/entrar/confirmar" />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.queryByText('Pantalla de hoy')).not.toBeInTheDocument();
  });
});
