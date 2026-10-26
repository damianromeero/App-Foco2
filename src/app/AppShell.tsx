import { useEffect, type ComponentType, type ReactNode } from 'react';
import {
  BooksIcon,
  BrainIcon,
  BookOpenTextIcon,
  ChartLineUpIcon,
  GearIcon,
  HouseIcon,
  PlayIcon,
  TargetIcon,
  TimerIcon,
  UserCircleIcon,
  type IconProps,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router';
import { Logo } from '../components/brand/Logo';
import { billing } from '../services/billing';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useBillingStore } from '../store/billingStore';
import { useBillingView } from '../hooks/useBillingView';
import { useNextAction } from '../hooks/useNextAction';
import { useSessionSync } from '../hooks/useSessionSync';

type IconComponent = ComponentType<IconProps>;

interface NavItem {
  to: string;
  label: string;
  icon: IconComponent;
}

const NAV: NavItem[] = [
  { to: '/hoy', label: 'Hoy', icon: HouseIcon },
  { to: '/sesion', label: 'Sesión', icon: TimerIcon },
  { to: '/progreso', label: 'Progreso', icon: ChartLineUpIcon },
  { to: '/biblioteca', label: 'Biblioteca', icon: BooksIcon },
  { to: '/retos', label: 'Retos', icon: TargetIcon },
  { to: '/lecciones', label: 'Lecciones', icon: BookOpenTextIcon },
  { to: '/enfoque', label: 'Modo foco', icon: BrainIcon },
  { to: '/cuenta', label: 'Cuenta', icon: UserCircleIcon },
  { to: '/ajustes', label: 'Ajustes', icon: GearIcon },
];

/** Dock del móvil: cuatro destinos a los lados y la sesión en el centro, siempre al alcance del pulgar. */
const DOCK_LEFT: NavItem[] = [
  { to: '/hoy', label: 'Hoy', icon: HouseIcon },
  { to: '/progreso', label: 'Progreso', icon: ChartLineUpIcon },
];
const DOCK_RIGHT: NavItem[] = [
  { to: '/retos', label: 'Retos', icon: TargetIcon },
  { to: '/cuenta', label: 'Cuenta', icon: UserCircleIcon },
];

/** Rutas a pantalla completa: sin dock ni menú, para que el entrenamiento ocupe toda la atención. */
const IMMERSIVE_PREFIXES = ['/sesion', '/resultado'];

/** Solo entra en la app quien ha completado el inicio. Si no, se le lleva a Empezar. */
export function RequireOnboarding({ children }: { children: ReactNode }) {
  const onboarded = useAppStore((state) => state.onboardedAt !== null);
  const location = useLocation();
  if (!onboarded) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }
  return children;
}

function DockTab({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      viewTransition
      className="pressable relative flex h-full flex-col items-center justify-center gap-1 rounded-2xl"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="dock-active"
              className="glass absolute inset-x-2 inset-y-1 rounded-2xl"
              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            />
          )}
          <span className="relative">
            <Icon
              size={24}
              weight={isActive ? 'fill' : 'duotone'}
              className={isActive ? 'icon-aurora' : 'text-ink-soft'}
              aria-hidden="true"
            />
          </span>
          <span
            className={`relative text-[0.68rem] font-medium tracking-tight ${isActive ? 'text-ink' : 'text-ink-soft'}`}
          >
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function Dock() {
  const next = useNextAction();
  return (
    <nav
      aria-label="Principal móvil"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 md:hidden"
    >
      <ul className="glass-dock ring-gradient relative mx-auto grid h-[4.5rem] max-w-md grid-cols-5 items-center rounded-dock shadow-lift backdrop-blur-2xl">
        {DOCK_LEFT.map((item) => (
          <li key={item.to} className="h-full">
            <DockTab item={item} />
          </li>
        ))}
        <li className="flex h-full items-center justify-center">
          <NavLink
            to={next.to}
            viewTransition
            aria-label={`${next.label}: ${next.detail}`}
            className="pressable sheen fill-brand -mt-9 flex size-16 shrink-0 items-center justify-center rounded-full text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.55),var(--shadow-glow)] ring-4 ring-canvas"
          >
            <PlayIcon size={26} weight="fill" aria-hidden="true" />
          </NavLink>
        </li>
        {DOCK_RIGHT.map((item) => (
          <li key={item.to} className="h-full">
            <DockTab item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppShell() {
  const location = useLocation();
  const refreshBilling = useBillingStore((state) => state.refresh);
  const initAuth = useAuthStore((state) => state.init);
  const view = useBillingView();
  const immersive = IMMERSIVE_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));
  useSessionSync();

  useEffect(() => {
    void refreshBilling();
    initAuth();
  }, [refreshBilling, initAuth]);

  return (
    <div className="min-h-dvh overflow-x-clip">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
      >
        Saltar al contenido
      </a>

      {!immersive && (
        <aside
          aria-label="Navegación"
          className="fixed inset-y-4 left-4 z-30 hidden w-64 flex-col rounded-[2rem] p-5 md:flex glass-dock ring-gradient shadow-lift backdrop-blur-2xl"
        >
          <div className="px-2 pt-1">
            <Logo />
          </div>
          <nav aria-label="Principal" className="mt-10 flex flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  viewTransition
                  className="pressable relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium"
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="side-active"
                          className="glass absolute inset-0 rounded-xl"
                          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                        />
                      )}
                      <Icon
                        size={20}
                        weight={isActive ? 'fill' : 'duotone'}
                        className={`relative shrink-0 ${isActive ? 'icon-aurora' : 'text-ink-soft'}`}
                        aria-hidden="true"
                      />
                      <span
                        className={`relative flex-1 ${isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'}`}
                      >
                        {item.label}
                      </span>
                      {item.to === '/enfoque' && view.entitlement !== 'premium' && (
                        <span className="fill-gold relative rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-medium tracking-wider text-premium-ink uppercase">
                          Premium
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </aside>
      )}

      <div className={immersive ? '' : 'md:pl-[19rem]'}>
        {/* Solo para el alumno en desarrollo: el cliente nunca ve este aviso. */}
        {import.meta.env.DEV && billing.mode === 'demo' && (
          <div
            role="status"
            data-captura="oculto"
            className="glass mx-4 mt-3 rounded-2xl px-4 py-2 text-center text-sm font-medium text-accent-text"
          >
            Modo demo: la prueba es simulada y no hay cobros reales.
          </div>
        )}

        <main
          id="contenido"
          className={
            immersive
              ? 'min-h-dvh'
              : 'mx-auto w-full max-w-xl px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-44 md:max-w-4xl md:px-12 md:pb-16 md:pt-12'
          }
        >
          <Outlet />
        </main>
      </div>

      {!immersive && (
        // Un velo bajo el dock: el texto que pasa por debajo se desvanece en lugar de cortarse de golpe.
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-28 md:hidden"
          style={{ background: 'linear-gradient(to top, var(--c-canvas) 30%, transparent)' }}
        />
      )}
      {!immersive && <Dock />}
    </div>
  );
}
