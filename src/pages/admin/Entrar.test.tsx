import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseComprador, isCloudEnabled } from '../../services/supabase';
import Entrar from './Entrar';

vi.mock('../../services/supabase', () => ({
  getSupabaseComprador: vi.fn(),
  isCloudEnabled: vi.fn(() => false),
}));

interface ParametrosOtp {
  email: string;
  options: { shouldCreateUser: boolean; emailRedirectTo: string };
}

function renderizar() {
  return render(
    <MemoryRouter>
      <Entrar />
    </MemoryRouter>,
  );
}

describe('Entrar al panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin nube muestra el aviso y no envía nada', () => {
    vi.mocked(isCloudEnabled).mockReturnValue(false);

    renderizar();

    expect(screen.getByText('El panel necesita Supabase configurado')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(getSupabaseComprador).not.toHaveBeenCalled();
  });

  it('envía el enlace sin crear usuarios, con el cliente sin sesión persistente, y responde con un mensaje genérico', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    const signInWithOtp = vi.fn((_parametros: ParametrosOtp) => Promise.resolve({ error: null }));
    vi.mocked(getSupabaseComprador).mockResolvedValue({ auth: { signInWithOtp } } as never);
    const usuario = userEvent.setup();

    renderizar();
    await usuario.type(screen.getByLabelText('Correo'), 'cliente@example.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(/Si el correo tiene acceso/)).toBeInTheDocument();
    const [parametros] = signInWithOtp.mock.calls[0] ?? [];
    expect(parametros?.email).toBe('cliente@example.com');
    expect(parametros?.options.shouldCreateUser).toBe(false);
    expect(parametros?.options.emailRedirectTo).toMatch(/\/admin\/confirmar$/);
  });

  it('un error distinto del límite responde igual que un envío correcto', async () => {
    vi.mocked(isCloudEnabled).mockReturnValue(true);
    const signInWithOtp = vi.fn((_parametros: ParametrosOtp) =>
      Promise.resolve({ error: { status: 400 } }),
    );
    vi.mocked(getSupabaseComprador).mockResolvedValue({ auth: { signInWithOtp } } as never);
    const usuario = userEvent.setup();

    renderizar();
    await usuario.type(screen.getByLabelText('Correo'), 'ausente@example.com');
    await usuario.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText(/Si el correo tiene acceso/)).toBeInTheDocument();
  });
});
