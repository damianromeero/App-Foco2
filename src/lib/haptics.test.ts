import { afterEach, describe, expect, it, vi } from 'vitest';
import { buzz } from './haptics';

function setNavigator(key: 'vibrate' | 'userActivation', value: unknown): void {
  Object.defineProperty(navigator, key, { value, configurable: true });
}

describe('buzz', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'vibrate');
    Reflect.deleteProperty(navigator, 'userActivation');
  });

  it('no intenta vibrar antes de un gesto de la persona, para no provocar un bloqueo en consola', () => {
    const vibrate = vi.fn(() => true);
    setNavigator('vibrate', vibrate);
    setNavigator('userActivation', { hasBeenActive: false });

    buzz([18, 60, 40]);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('vibra con el patrón pedido cuando ya hubo un gesto', () => {
    const vibrate = vi.fn(() => true);
    setNavigator('vibrate', vibrate);
    setNavigator('userActivation', { hasBeenActive: true });

    buzz([18, 60, 40]);
    expect(vibrate).toHaveBeenCalledWith([18, 60, 40]);
  });

  it('no hace nada en navegadores sin vibración', () => {
    setNavigator('userActivation', { hasBeenActive: true });
    expect(() => {
      buzz();
    }).not.toThrow();
  });
});
