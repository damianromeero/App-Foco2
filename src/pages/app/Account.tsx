import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Link, useNavigate } from 'react-router';
import { Button, LinkButton } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Badge, Card, Notice, PageHeader } from '../../components/ui/Surfaces';
import { useToast } from '../../components/ui/Toast';
import { GARANTIA, MARCA_ARCHIVO } from '../../config/plantilla';
import { COPY } from '../../content/copy';
import { ANNUAL_BONUS, PLANS, formatUSD, monthlyEquivalentCents } from '../../domain/pricing';
import { formatFullDate } from '../../lib/format';
import { billing } from '../../services/billing';
import { sendMagicLink, signOut } from '../../services/auth';
import { cerrarSesionDeAcceso } from '../../services/acceso';
import { borrarMiCuenta } from '../../services/cuenta';
import { isCloudEnabled } from '../../services/supabase';
import { DialogoBorrarCuenta } from '../../components/cuenta/DialogoBorrarCuenta';
import { useAuthStore } from '../../store/authStore';
import { useBillingStore } from '../../store/billingStore';
import { useBillingView } from '../../hooks/useBillingView';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useAppStore } from '../../store/appStore';
import { buildExport } from '../../data/exportData';
import { downloadText } from '../../lib/download';
import { toDateKey } from '../../domain/dates';
import { useNow } from '../../hooks/useNow';

const PHASE_TEXT = {
  gratis: 'Plan gratuito. La sesión diaria completa es tuya.',
  prueba: 'Estás en tu prueba gratuita con acceso completo.',
  'prueba-por-terminar': 'Tu prueba termina pronto.',
  activa: 'Suscripción activa.',
  cancelando: 'Cancelada: mantienes el acceso hasta la fecha indicada.',
  'pago-pendiente': 'Hay un problema con el último cobro.',
  cancelada: 'Suscripción cancelada.',
} as const;

/** Campo de correo: cristal con borde suave, 16 px para no provocar zoom en iOS. */
const FIELD =
  'min-h-12 w-full rounded-xl bg-canvas/60 px-3.5 text-base text-ink ring-1 ring-inset ring-ink/15';

/** Entrada escalonada de cada bloque. */
function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <div className="animate-fade-up" style={style}>
      {children}
    </div>
  );
}

export default function Account() {
  useDocumentMeta({
    title: 'Cuenta',
    description: 'Tu plan, tu cuenta y tus datos.',
  });
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const authStatus = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const initAuth = useAuthStore((state) => state.init);
  const view = useBillingView();
  const snapshot = useBillingStore((state) => state.snapshot);
  const billingError = useBillingStore((state) => state.error);
  const refreshBilling = useBillingStore((state) => state.refresh);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'cancelar' | 'desistir' | 'borrar' | null>(null);
  const state = useAppStore.getState;

  useEffect(() => {
    initAuth();
    void refreshBilling();
  }, [initAuth, refreshBilling]);

  const run = async (action: () => Promise<void>, success?: string) => {
    setBusy(true);
    try {
      await action();
      if (success) toast.show(success);
      await refreshBilling();
    } catch (error) {
      toast.show(error instanceof Error ? error.message : COPY.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : COPY.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const cerrarSesion = async () => {
    setBusy(true);
    try {
      await cerrarSesionDeAcceso();
      await useAuthStore.getState().refrescar();
      void navigate('/entrar', { replace: true });
    } catch {
      toast.show('No pudimos cerrar la sesión. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const exportData = () => {
    downloadText(`${MARCA_ARCHIVO}-mis-datos-${toDateKey(now)}.json`, buildExport(state(), now));
  };

  const plan = snapshot.plan ? PLANS[snapshot.plan] : null;
  const premium = view.entitlement === 'premium';

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="pixel-accent">Cuenta</span>}
        lead="Tu plan, tus pagos y tus datos."
      />

      <Enter delay={80}>
        <Card variant="hero" labelledBy="plan-titulo">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="plan-titulo" className="text-2xl">
                Tu plan
              </h2>
              <Badge tone={premium ? 'premium' : 'neutral'} dot={premium}>
                {premium ? 'Premium' : 'Gratuito'}
              </Badge>
            </div>

            <p className="text-lg text-ink">{PHASE_TEXT[view.phase]}</p>

            {billingError && (
              <Notice tone="accent" title="No pudimos leer tu suscripción.">
                {billingError}
              </Notice>
            )}

            {view.phase === 'prueba' || view.phase === 'prueba-por-terminar' ? (
              <p>
                Prueba: {view.trialDaysLeft} {view.trialDaysLeft === 1 ? 'día' : 'días'} restantes.
                {view.nextChargeAt && view.nextChargeCents !== null && (
                  <>
                    {' '}
                    Primer cobro: {formatUSD(view.nextChargeCents)} el{' '}
                    {formatFullDate(view.nextChargeAt)}.
                  </>
                )}
              </p>
            ) : null}

            {view.phase === 'activa' && view.nextChargeAt && view.nextChargeCents !== null && (
              <p>
                Próximo cobro: {formatUSD(view.nextChargeCents)} el{' '}
                {formatFullDate(view.nextChargeAt)}.
              </p>
            )}

            {view.accessUntil &&
              (view.phase === 'cancelando' || view.phase === 'pago-pendiente') && (
                <p>Acceso hasta el {formatFullDate(view.accessUntil)}.</p>
              )}

            {plan && snapshot.plan && (
              <p className="text-base text-ink-soft">
                Plan {plan.label.toLowerCase()}: {formatUSD(plan.cents)} {plan.periodLabel}
                {snapshot.plan === 'annual' &&
                  ` (${formatUSD(monthlyEquivalentCents('annual'))} al mes, ${ANNUAL_BONUS})`}
                .
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {view.entitlement !== 'premium' && (
                <LinkButton to="/precios" variant="premium">
                  Ver planes Premium
                </LinkButton>
              )}

              {billing.mode === 'demo' &&
                view.phase === 'prueba' &&
                billing.simulateFirstCharge && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      void run(
                        () =>
                          billing.simulateFirstCharge?.(snapshot.plan ?? 'monthly') ??
                          Promise.resolve(),
                        'Tu prueba terminó y tu plan ya está activo.',
                      );
                    }}
                  >
                    Simular el primer cobro (demo)
                  </Button>
                )}

              {view.canResume && (
                <Button
                  disabled={busy}
                  onClick={() => {
                    void run(() => billing.resume(), 'Tu suscripción vuelve a renovarse.');
                  }}
                >
                  Reactivar
                </Button>
              )}

              {view.canCancel && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setConfirm('cancelar');
                  }}
                >
                  Cancelar suscripción
                </Button>
              )}

              {billing.mode === 'stripe' && snapshot.status !== 'none' && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    void run(() => billing.openPortal());
                  }}
                >
                  Método de pago y facturas
                </Button>
              )}

              {view.canWithdraw && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() => {
                    setConfirm('desistir');
                  }}
                >
                  Desistir del contrato
                </Button>
              )}
            </div>

            {billing.mode === 'stripe' ? (
              <p className="border-t border-line pt-5 text-base text-ink-soft">
                Cancelar detiene la renovación: mantienes el acceso hasta el final del periodo ya
                pagado. Desistir es distinto: devuelve el importe dentro de los 14 días desde el
                primer cobro.{' '}
                <Link
                  className="py-3.5 font-medium text-brand underline-offset-4 hover:underline"
                  to="/legal/desistimiento"
                >
                  Más información
                </Link>
                .
              </p>
            ) : (
              <p className="border-t border-line pt-5 text-base text-ink-soft">
                {COPY.pagosHotmart} {GARANTIA}: si no te convence, pides el reembolso en ese plazo.{' '}
                <Link
                  className="py-3.5 font-medium text-brand underline-offset-4 hover:underline"
                  to="/legal/desistimiento"
                >
                  Más información
                </Link>
                .
              </p>
            )}
          </div>
        </Card>
      </Enter>

      <Enter delay={160}>
        <Card labelledBy="cuenta-titulo">
          <div className="space-y-5">
            <h2 id="cuenta-titulo" className="text-xl">
              Tu cuenta
            </h2>

            {authStatus === 'sin-backend' && (
              <Notice title="Guardado en este dispositivo">{COPY.localMode}</Notice>
            )}

            {authStatus === 'cargando' && (
              <p className="text-base text-ink-soft">Cargando tu cuenta…</p>
            )}

            {authStatus === 'anonimo' && !sent && (
              <form
                onSubmit={(event) => {
                  void submitEmail(event);
                }}
                className="space-y-4"
              >
                <p className="text-ink-soft">
                  Solo puedes entrar si tienes una compra con este correo. Te enviamos un enlace,
                  sin contraseñas.
                </p>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Correo electrónico
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                    }}
                    className={FIELD}
                  />
                </label>
                <Button type="submit" disabled={busy || email.trim() === ''}>
                  Enviarme el enlace
                </Button>
              </form>
            )}

            {authStatus === 'anonimo' && sent && (
              <Notice tone="success" title="Revisa tu correo.">
                Te hemos enviado un enlace de acceso. Puede tardar un minuto.
              </Notice>
            )}

            {authStatus === 'conectado' && user && (
              <div className="space-y-5">
                <p>
                  Conectada como <span className="font-semibold">{user.email ?? 'tu cuenta'}</span>.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      void cerrarSesion();
                    }}
                  >
                    Cerrar sesión
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setConfirm('borrar');
                    }}
                  >
                    Eliminar mi cuenta
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Enter>

      <Enter delay={240}>
        <Card labelledBy="datos-titulo">
          <div className="space-y-4">
            <h2 id="datos-titulo" className="text-xl">
              Tus datos
            </h2>
            <p className="text-ink-soft">
              Puedes descargarlos o borrarlos en cualquier momento, sin coste.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="secondary" onClick={exportData}>
                Descargar mis datos
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  void navigate('/ajustes');
                }}
              >
                Ir a Ajustes
              </Button>
            </div>
          </div>
        </Card>
      </Enter>

      <Dialog
        open={confirm === 'cancelar'}
        onClose={() => {
          setConfirm(null);
        }}
        title="¿Cancelar tu suscripción?"
      >
        <p className="text-ink-soft">
          No se te cobrará más a partir de la próxima fecha. Mantienes el acceso hasta entonces.
          Puedes reactivarla cuando quieras.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirm(null);
            }}
          >
            Seguir con mi plan
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setConfirm(null);
              void run(
                () => billing.cancel(),
                'Suscripción cancelada. Mantienes el acceso hasta la fecha indicada.',
              );
            }}
          >
            Cancelar suscripción
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={confirm === 'desistir'}
        onClose={() => {
          setConfirm(null);
        }}
        title="Desistir del contrato"
      >
        <p className="text-ink-soft">
          Desistes y te devolvemos el importe del último cobro por el mismo medio de pago. Te
          enviaremos un correo de confirmación con la fecha y la hora en que lo hemos recibido.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirm(null);
            }}
          >
            Volver
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() => {
              setConfirm(null);
              void run(
                () => billing.withdraw(),
                'Desistimiento registrado. Te enviaremos la confirmación por correo.',
              );
            }}
          >
            Confirmar desistimiento
          </Button>
        </div>
      </Dialog>

      <DialogoBorrarCuenta
        open={confirm === 'borrar'}
        busy={busy || !isCloudEnabled()}
        onClose={() => {
          setConfirm(null);
        }}
        onConfirm={() => {
          setConfirm(null);
          void run(async () => {
            // Solo la base, con la sesión de la persona (a través del servidor). Ningún proveedor de cobros interviene.
            await borrarMiCuenta();
            await signOut();
            await useAuthStore.getState().refrescar();
            // Igual que en Ajustes: si el borrado en la nube falla, no se toca nada en el dispositivo.
            useAppStore.getState().deleteAllData();
            void navigate('/', { replace: true });
          }, 'Tu cuenta y tus datos se han eliminado.');
        }}
      />
    </div>
  );
}
