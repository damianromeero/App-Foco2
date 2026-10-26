import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReflectionStep } from './SessionSteps';

describe('ReflectionStep', () => {
  it('no guarda respuestas que la persona no ha elegido', () => {
    const onDone = vi.fn();
    render(<ReflectionStep onDone={onDone} />);

    const continueButton = screen.getByRole('button', { name: 'Continuar' });
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Igual'));
    expect(continueButton).toBeDisabled();

    fireEvent.click(screen.getByLabelText('No lo sé'));
    expect(continueButton).toBeEnabled();

    fireEvent.click(continueButton);
    expect(onDone).toHaveBeenCalledWith({ mood: 'igual', phoneUse: 'no-se' });
  });

  it('saltar la reflexión no guarda ninguna respuesta', () => {
    const onDone = vi.fn();
    render(<ReflectionStep onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: 'Saltar' }));
    expect(onDone).toHaveBeenCalledWith(null);
  });
});
