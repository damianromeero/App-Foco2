import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/supabase', () => ({
  isCloudEnabled: () => true,
}));

vi.mock('../services/auth', () => ({
  getSessionUser: vi.fn(() => Promise.resolve(null)),
}));

describe('authStore.init con conexión', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('si el servidor no responde, la cuenta queda como anónima y se reintenta al siguiente montaje', async () => {
    const auth = await import('../services/auth');
    vi.mocked(auth.getSessionUser).mockRejectedValueOnce(new Error('sin conexión'));

    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().init();

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('anonimo');
    });

    useAuthStore.getState().init();
    await vi.waitFor(() => {
      expect(auth.getSessionUser).toHaveBeenCalledTimes(2);
    });
  });

  it('con sesión del servidor queda conectada con el correo, sin guardar nada en el navegador', async () => {
    const auth = await import('../services/auth');
    vi.mocked(auth.getSessionUser).mockResolvedValueOnce({
      email: 'compradora@example.com',
      conAcceso: true,
    });

    const { useAuthStore } = await import('./authStore');
    useAuthStore.getState().init();

    await vi.waitFor(() => {
      expect(useAuthStore.getState().status).toBe('conectado');
    });
    expect(useAuthStore.getState().user).toEqual({
      email: 'compradora@example.com',
      conAcceso: true,
    });
  });
});
