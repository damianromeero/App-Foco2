import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { ADMIN_APP } from '../../admin/config';
import { cerrarSesionAdmin, estadoAdmin, type EstadoAdmin } from '../../admin/sesion';
import { ErrorCarga } from '../../components/admin/ErrorCarga';
import { EstadoCarga } from '../../components/admin/EstadoCarga';

type Estado = EstadoAdmin | 'cargando';

const ContextoAdmin = createContext<() => void>(() => undefined);

/** Vuelve a comprobar el acceso (por ejemplo, tras verificar el segundo factor). Mantiene la pantalla visible. */
export function useRecargarEstadoAdmin(): () => void {
  return useContext(ContextoAdmin);
}

const SECCIONES = [
  { href: '/admin', texto: 'Hoy', fin: true },
  { href: '/admin/ventas', texto: 'Ventas', fin: false },
  { href: '/admin/uso', texto: 'Uso de la app', fin: false },
  { href: '/admin/seguridad', texto: 'Seguridad', fin: false },
] as const;

const RUTA_SEGURIDAD = '/admin/seguridad';

/** Marco común de las pantallas del panel. La meta noindex la sube React al encabezado del documento. */
function Marco({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6">
      <meta name="robots" content="noindex" />
      {children}
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <section className="glass ring-gradient rounded-card p-5 sm:p-6">
      <h1 className="text-xl font-semibold text-ink">{titulo}</h1>
      {texto ? <p className="mt-2 text-base text-ink-soft">{texto}</p> : null}
    </section>
  );
}

/** Marco del panel: comprueba el acceso antes de mostrar nada. Sin nube no muestra datos ni hace peticiones. */
export default function AdminLayout() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [version, setVersion] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const [errorSalir, setErrorSalir] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let vigente = true;
    void estadoAdmin().then(
      (nuevo) => {
        if (vigente) setEstado(nuevo);
      },
      () => {
        if (vigente) setEstado('error');
      },
    );
    return () => {
      vigente = false;
    };
  }, [version]);

  const recargarEstado = useCallback(() => {
    setVersion((actual) => actual + 1);
  }, []);

  const reintentar = () => {
    setEstado('cargando');
    setVersion((actual) => actual + 1);
  };

  async function salir() {
    setSaliendo(true);
    setErrorSalir(null);
    try {
      await cerrarSesionAdmin();
      void navigate('/admin/entrar', { replace: true });
    } catch (error: unknown) {
      setErrorSalir(error instanceof Error ? error.message : 'No pudimos cerrar la sesión.');
      setSaliendo(false);
    }
  }

  if (estado === 'cargando') {
    return (
      <Marco>
        <EstadoCarga texto="Comprobando el acceso…" />
      </Marco>
    );
  }

  if (estado === 'sin-backend') {
    return (
      <Marco>
        <Aviso titulo={ADMIN_APP.nombre} texto="El panel necesita Supabase configurado" />
      </Marco>
    );
  }

  if (estado === 'sin-sesion') {
    return <Navigate to="/admin/entrar" replace />;
  }

  if (estado === 'sin-permiso') {
    return (
      <Marco>
        <Aviso titulo="No hay nada aquí" />
      </Marco>
    );
  }

  if (estado === 'error') {
    return (
      <Marco>
        <ErrorCarga
          mensaje="No pudimos comprobar tu acceso. Revisa tu conexión y vuelve a intentarlo."
          alReintentar={reintentar}
        />
      </Marco>
    );
  }

  // Con segundo factor pendiente solo se puede estar en Seguridad, donde se configura.
  if (estado === 'segundo-factor-pendiente' && location.pathname !== RUTA_SEGURIDAD) {
    return <Navigate to={RUTA_SEGURIDAD} replace />;
  }

  return (
    <ContextoAdmin.Provider value={recargarEstado}>
      <Marco>
        <header className="flex flex-col gap-4">
          <p className="text-lg font-semibold text-ink">
            {ADMIN_APP.nombre}{' '}
            <span className="text-base font-normal text-ink-soft">{ADMIN_APP.etiqueta}</span>
          </p>
          <nav
            aria-label="Secciones del panel"
            className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          >
            {SECCIONES.map((seccion) => (
              <NavLink
                key={seccion.href}
                to={seccion.href}
                end={seccion.fin}
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-base font-medium transition-colors ${
                    isActive
                      ? 'fill-brand text-brand-ink'
                      : 'glass ring-gradient text-ink hover:brightness-125'
                  }`
                }
              >
                {seccion.texto}
              </NavLink>
            ))}
            <button
              type="button"
              onClick={() => {
                void salir();
              }}
              disabled={saliendo}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl px-4 text-base font-medium text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </button>
          </nav>
          {errorSalir ? (
            <p role="alert" className="text-base text-danger-text">
              {errorSalir}
            </p>
          ) : null}
        </header>
        <Outlet />
      </Marco>
    </ContextoAdmin.Provider>
  );
}
