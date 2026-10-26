import { describe, expect, it } from 'vitest';
import { enmascararCorreo, ultimosSeis } from './enmascarar';

describe('enmascararCorreo', () => {
  it('deja la primera letra y el dominio', () => {
    expect(enmascararCorreo('cliente@example.com')).toBe('c***@example.com');
  });

  it('nunca deja el correo completo', () => {
    const enmascarado = enmascararCorreo('maria.lopez@example.com');
    expect(enmascarado).not.toContain('maria.lopez');
    expect(enmascarado).toBe('m***@example.com');
  });

  it('sin una arroba válida devuelve tres asteriscos', () => {
    expect(enmascararCorreo('sin-arroba')).toBe('***');
    expect(enmascararCorreo('@example.com')).toBe('***');
    expect(enmascararCorreo('cliente@')).toBe('***');
    expect(enmascararCorreo('')).toBe('***');
  });
});

describe('ultimosSeis', () => {
  it('muestra solo los últimos 6 caracteres de un identificador largo', () => {
    expect(ultimosSeis('HP123456789ABCDEF')).toBe('…ABCDEF');
  });

  it('un identificador de 6 caracteres o menos no se muestra entero', () => {
    expect(ultimosSeis('abc123')).toBe('…');
    expect(ultimosSeis('')).toBe('…');
  });
});
