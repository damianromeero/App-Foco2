import { describe, expect, it } from 'vitest';
import { aplicarAccesoPremium, describeBilling, type BillingView } from './billing';
import { NO_SUBSCRIPTION } from './model';

const vistaGratuita: BillingView = describeBilling(
  NO_SUBSCRIPTION,
  new Date('2026-10-24T10:00:00Z'),
);

describe('nivel premium según el acceso de la tabla de accesos', () => {
  it('sin acceso vigente, la vista queda como estaba (gratuita)', () => {
    expect(aplicarAccesoPremium(vistaGratuita, false)).toEqual(vistaGratuita);
    expect(vistaGratuita.entitlement).toBe('free');
  });

  it('con acceso vigente, premium y fase activa, sin cambiar nada más', () => {
    const vista = aplicarAccesoPremium(vistaGratuita, true);
    expect(vista.entitlement).toBe('premium');
    expect(vista.phase).toBe('activa');
    expect(vista.canCancel).toBe(vistaGratuita.canCancel);
    expect(vista.canWithdraw).toBe(vistaGratuita.canWithdraw);
  });
});
