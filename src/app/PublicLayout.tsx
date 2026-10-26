import { ListIcon, XIcon } from '@phosphor-icons/react';
import { useEffect, useId, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { Logo } from '../components/brand/Logo';
import { LinkButton } from '../components/ui/Button';
import { plantilla } from '../config/plantilla';
import { env } from '../config/env';
import { LEGAL_DOCUMENTS } from '../content/legal';

/** Cuánto hay que bajar antes de que la cabecera móvil reciba sombra para separarse del contenido. */
const SHADOW_AFTER_PX = 8;

const SITE_LINKS = [
  { to: '/precios', label: 'Precios', end: true },
  { to: '/ciencia', label: 'Ciencia', end: false },
  { to: '/pacto', label: 'Pacto', end: false },
  { to: '/login', label: 'Entrar', end: false },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return `pressable inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-3.5 transition-colors ${isActive ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:text-ink'}`;
}

function menuLinkClass({ isActive }: { isActive: boolean }): string {
  return `pressable flex min-h-12 items-center rounded-xl px-4 text-base font-medium transition-colors ${isActive ? 'text-brand' : 'text-ink hover:text-brand'}`;
}

/**
 * Cabecera de las páginas públicas. En móvil queda fija arriba con solo el logo y un botón de menú;
 * sin fondo, con sombra cuando la página ya se ha movido. En escritorio, la barra de siempre.
 */
function PublicHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(() => window.scrollY > SHADOW_AFTER_PX);
  const menuId = useId();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > SHADOW_AFTER_PX);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
  };

  return (
    <header
      className={`sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] transition-[background-color] duration-200 sm:px-6 ${scrolled ? 'bg-canvas/90 backdrop-blur-xl md:bg-transparent md:backdrop-blur-none' : ''}`}
    >
      <div
        className={`mx-auto max-w-6xl transition-[filter] duration-300 md:glass-dock md:ring-gradient md:rounded-dock md:px-4 md:py-2 ${scrolled ? 'drop-shadow-[0_2px_14px_rgb(0_0_0/0.55)]' : ''}`}
      >
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <button
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
            onClick={() => {
              setOpen((value) => !value);
            }}
            className="pressable grid size-11 place-items-center rounded-full text-ink md:hidden"
          >
            {open ? (
              <XIcon size={24} aria-hidden="true" />
            ) : (
              <ListIcon size={24} aria-hidden="true" />
            )}
          </button>
          <nav
            aria-label="Principal"
            className="hidden items-center gap-1 text-sm font-medium md:ml-auto md:flex"
          >
            {SITE_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={navClass}>
                {link.label}
              </NavLink>
            ))}
          </nav>
          {/* El contenedor oculta el botón en móvil: las clases del botón fijan su propio "display". */}
          <div className="hidden md:block">
            <LinkButton
              to="/onboarding"
              size="md"
              className="min-h-11 px-4 text-sm whitespace-nowrap"
              id="cta-cabecera"
              data-evento="inicio-gratis"
            >
              Empezar gratis
            </LinkButton>
          </div>
        </div>

        {open && (
          <nav
            id={menuId}
            aria-label="Menú"
            className="animate-fade-up mt-3 rounded-card bg-surface p-2 shadow-lift ring-gradient md:hidden"
          >
            <ul>
              {SITE_LINKS.map((link) => (
                <li key={link.to}>
                  <NavLink to={link.to} end={link.end} onClick={close} className={menuLinkClass}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <LinkButton to="/onboarding" size="lg" className="mt-2 w-full" onClick={close}>
              Empezar gratis
            </LinkButton>
          </nav>
        )}
      </div>
    </header>
  );
}

/** Marco de las páginas públicas: marketing, precios, ciencia, pacto y legal. */
export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
      >
        Saltar al contenido
      </a>

      {/* La clave por ruta cierra el menú al cambiar de página, también con el botón atrás. */}
      <PublicHeader key={pathname} />

      <main id="contenido" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="ring-gradient glass relative mx-3 mb-3 mt-14 overflow-hidden rounded-card sm:mx-6 sm:mt-16">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px fill-aurora opacity-70"
        />
        <div className="grid gap-10 px-5 py-10 sm:px-8 md:grid-cols-3">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
              Entrena tu atención en 5 minutos. Sin culpa, sin trampas, sin prisa.
            </p>
            <p className="eyebrow">Sin anuncios · Sin cookies de terceros</p>
          </div>
          <nav aria-label="Producto" className="space-y-2 text-sm">
            <p className="eyebrow mb-2">Producto</p>
            <ul className="text-ink-soft">
              <li>
                <Link className="flex min-h-11 items-center hover:text-ink" to="/precios">
                  Precios
                </Link>
              </li>
              <li>
                <Link className="flex min-h-11 items-center hover:text-ink" to="/ciencia">
                  Ciencia
                </Link>
              </li>
              <li>
                <Link className="flex min-h-11 items-center hover:text-ink" to="/pacto">
                  El Pacto Sin Trampas
                </Link>
              </li>
              <li>
                <Link className="flex min-h-11 items-center hover:text-ink" to="/onboarding">
                  Empezar
                </Link>
              </li>
              <li>
                <Link className="flex min-h-11 items-center hover:text-ink" to="/login">
                  Entrar
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Legal" className="space-y-2 text-sm">
            <p className="eyebrow mb-2">Legal</p>
            <ul className="text-ink-soft">
              {LEGAL_DOCUMENTS.map((document) => (
                <li key={document.slug}>
                  <Link
                    className="flex min-h-11 items-center hover:text-ink"
                    to={`/legal/${document.slug}`}
                  >
                    {document.title}
                  </Link>
                </li>
              ))}
              {env.supportEmail && (
                <li>
                  <a
                    className="flex min-h-11 items-center hover:text-ink"
                    href={`mailto:${env.supportEmail}`}
                  >
                    Contacto
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
        <p className="border-t border-line px-5 py-5 text-center text-sm leading-relaxed text-ink-soft sm:px-8">
          © {new Date().getFullYear()} {plantilla.nombre}. Aplicación de entrenamiento de la
          atención. No es un dispositivo médico ni sustituye la consulta médica.
        </p>
      </footer>
    </div>
  );
}
