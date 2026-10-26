import { describeBilling } from './billing';
import type { SubscriptionSnapshot } from './model';
import {
  ANNUAL_BONUS,
  PLANS,
  TRIAL_DAYS,
  formatUSD,
  mesesGratisAnual,
  monthlyEquivalentCents,
} from './pricing';

const NOW = new Date('2026-10-16T12:00:00Z');
const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(NOW.getTime() + offsetDays * DAY).toISOString();

const sub = (overrides: Partial<SubscriptionSnapshot>): SubscriptionSnapshot => ({
  status: 'none',
  plan: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  firstPaidAt: null,
  ...overrides,
});

describe('describeBilling', () => {
  it('sin suscripción: plan gratuito', () => {
    const view = describeBilling(sub({}), NOW);
    expect(view.entitlement).toBe('free');
    expect(view.phase).toBe('gratis');
    expect(view.canCancel).toBe(false);
  });

  it('durante la prueba: acceso premium y cobro previsto al terminar', () => {
    const view = describeBilling(
      sub({ status: 'trialing', plan: 'monthly', trialEndsAt: iso(5) }),
      NOW,
    );
    expect(view.entitlement).toBe('premium');
    expect(view.phase).toBe('prueba');
    expect(view.trialDaysLeft).toBe(5);
    expect(view.nextChargeCents).toBe(599);
    expect(view.canCancel).toBe(true);
  });

  it('a 3 días o menos del cobro se avisa a la persona', () => {
    const view = describeBilling(
      sub({ status: 'trialing', plan: 'annual', trialEndsAt: iso(2) }),
      NOW,
    );
    expect(view.phase).toBe('prueba-por-terminar');
    expect(view.nextChargeCents).toBe(5990);
  });

  it('cancelar durante la prueba conserva el acceso hasta que termina', () => {
    const view = describeBilling(
      sub({ status: 'trialing', plan: 'monthly', trialEndsAt: iso(4), cancelAtPeriodEnd: true }),
      NOW,
    );
    expect(view.phase).toBe('cancelando');
    expect(view.entitlement).toBe('premium');
    expect(view.canResume).toBe(true);
  });

  it('suscripción activa: próximo cobro y cancelación disponible', () => {
    const view = describeBilling(
      sub({ status: 'active', plan: 'annual', currentPeriodEnd: iso(200), firstPaidAt: iso(-30) }),
      NOW,
    );
    expect(view.phase).toBe('activa');
    expect(view.nextChargeCents).toBe(5990);
    expect(view.canCancel).toBe(true);
    expect(view.canWithdraw).toBe(false);
  });

  it('cancelada al final del periodo: sigue con acceso hasta entonces', () => {
    const before = describeBilling(
      sub({
        status: 'active',
        plan: 'monthly',
        currentPeriodEnd: iso(10),
        cancelAtPeriodEnd: true,
      }),
      NOW,
    );
    expect(before.phase).toBe('cancelando');
    expect(before.entitlement).toBe('premium');

    const after = describeBilling(
      sub({
        status: 'active',
        plan: 'monthly',
        currentPeriodEnd: iso(-1),
        cancelAtPeriodEnd: true,
      }),
      NOW,
    );
    expect(after.phase).toBe('cancelada');
    expect(after.entitlement).toBe('free');
  });

  it('cobro fallido: se mantiene el acceso hasta el final del periodo ya pagado', () => {
    const inPeriod = describeBilling(
      sub({ status: 'past_due', plan: 'monthly', currentPeriodEnd: iso(3) }),
      NOW,
    );
    expect(inPeriod.phase).toBe('pago-pendiente');
    expect(inPeriod.entitlement).toBe('premium');

    const expired = describeBilling(
      sub({ status: 'past_due', plan: 'monthly', currentPeriodEnd: iso(-3) }),
      NOW,
    );
    expect(expired.entitlement).toBe('free');
  });

  it('desistimiento: disponible 14 días desde el primer cobro', () => {
    const inside = describeBilling(
      sub({ status: 'active', plan: 'monthly', currentPeriodEnd: iso(20), firstPaidAt: iso(-10) }),
      NOW,
    );
    expect(inside.canWithdraw).toBe(true);
    expect(inside.withdrawUntil).not.toBeNull();

    const outside = describeBilling(
      sub({ status: 'active', plan: 'monthly', currentPeriodEnd: iso(20), firstPaidAt: iso(-15) }),
      NOW,
    );
    expect(outside.canWithdraw).toBe(false);
  });
});

describe('precios', () => {
  it('el plan anual equivale a diez mensualidades: dos meses gratis', () => {
    expect(PLANS.annual.cents).toBe(PLANS.monthly.cents * 10);
    expect(mesesGratisAnual()).toBe(2);
    expect(ANNUAL_BONUS).toBe('dos meses gratis');
  });

  it('el anual equivale a US$4,99 al mes', () => {
    expect(monthlyEquivalentCents('annual')).toBe(499);
    expect(formatUSD(monthlyEquivalentCents('annual'))).toBe('US$4,99');
  });

  it('formatea en dólares con coma decimal y símbolo delante', () => {
    expect(formatUSD(PLANS.monthly.cents)).toBe('US$5,99');
    expect(formatUSD(PLANS.annual.cents)).toBe('US$59,90');
    expect(formatUSD(0)).toBe('US$0,00');
  });

  it('la prueba gratuita dura 7 días', () => {
    expect(TRIAL_DAYS).toBe(7);
  });
});
