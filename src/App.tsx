import { lazy, Suspense, type ReactNode } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
  useLocation,
} from 'react-router';
import { AppShell, RequireOnboarding } from './app/AppShell';
import { PublicLayout } from './app/PublicLayout';
import { RequireAcceso } from './app/RequireAcceso';
import { ThemeSync } from './app/ThemeSync';
import { ToastProvider } from './components/ui/Toast';
import { Ambient, GradientDefs, MotionRoot } from './components/ui/Atmosphere';
import Landing from './pages/marketing/Landing';

const Onboarding = lazy(() => import('./pages/onboarding/Onboarding'));
const Paywall = lazy(() => import('./pages/onboarding/Paywall'));
const Pricing = lazy(() => import('./pages/marketing/Pricing'));
const Science = lazy(() => import('./pages/marketing/Science'));
const Pact = lazy(() => import('./pages/marketing/Pact'));
const Legal = lazy(() => import('./pages/marketing/Legal'));
const Entrar = lazy(() => import('./pages/acceso/Entrar'));
const EntrarConfirmar = lazy(() => import('./pages/acceso/EntrarConfirmar'));
const SinCompra = lazy(() => import('./pages/acceso/SinCompra'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminEntrar = lazy(() => import('./pages/admin/Entrar'));
const AdminConfirmar = lazy(() => import('./pages/admin/Confirmar'));
const AdminHoy = lazy(() => import('./pages/admin/Hoy'));
const AdminVentas = lazy(() => import('./pages/admin/Ventas'));
const AdminUso = lazy(() => import('./pages/admin/Uso'));
const AdminSeguridad = lazy(() => import('./pages/admin/Seguridad'));
const Today = lazy(() => import('./pages/app/Today'));
const Session = lazy(() => import('./pages/app/Session'));
const Result = lazy(() => import('./pages/app/Result'));
const Progress = lazy(() => import('./pages/app/Progress'));
const Library = lazy(() => import('./pages/app/Library'));
const Practice = lazy(() => import('./pages/app/Practice'));
const Challenges = lazy(() => import('./pages/app/Challenges'));
const Focus = lazy(() => import('./pages/app/Focus'));
const Lessons = lazy(() => import('./pages/app/Lessons'));
const LessonDetail = lazy(() => import('./pages/app/LessonDetail'));
const Settings = lazy(() => import('./pages/app/Settings'));
const Account = lazy(() => import('./pages/app/Account'));
const Checkout = lazy(() => import('./pages/app/Checkout'));
const NotFound = lazy(() => import('./pages/app/NotFound'));

function Fallback() {
  return (
    <div className="mx-auto flex min-h-[50dvh] max-w-md items-center justify-center" role="status">
      <p className="text-ink-soft">Cargando…</p>
    </div>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>;
}

/** La ruta antigua del inicio sigue funcionando: lleva a /onboarding con la misma búsqueda (por ejemplo, ?modo=base). */
function RedirigirAlOnboarding() {
  const { search } = useLocation();
  return <Navigate to={`/onboarding${search}`} replace />;
}

/** Lo que vive en todas las rutas: tema, degradados y fondo animado. */
function RootLayout() {
  return (
    <>
      <ThemeSync />
      <GradientDefs />
      <Ambient />
      <Outlet />
    </>
  );
}

// Router de datos: permite bloquear la salida de una sesión a mitad de camino (useBlocker).
const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route
          path="precios"
          element={
            <Lazy>
              <Pricing />
            </Lazy>
          }
        />
        <Route
          path="ciencia"
          element={
            <Lazy>
              <Science />
            </Lazy>
          }
        />
        <Route
          path="pacto"
          element={
            <Lazy>
              <Pact />
            </Lazy>
          }
        />
        <Route
          path="legal/:slug"
          element={
            <Lazy>
              <Legal />
            </Lazy>
          }
        />
        <Route path="login" element={<Navigate to="/entrar" replace />} />
      </Route>

      {/* Embudo de venta: portada (/) → onboarding (/onboarding) → paywall (/paywall) → compra en Hotmart. */}
      <Route
        path="onboarding"
        element={
          <Lazy>
            <Onboarding />
          </Lazy>
        }
      />
      <Route path="empezar" element={<RedirigirAlOnboarding />} />
      <Route
        path="paywall"
        element={
          <Lazy>
            <Paywall />
          </Lazy>
        }
      />

      {/* Acceso de compradores: enlace al correo de compra, confirmación y pantalla sin compra. */}
      <Route
        path="entrar"
        element={
          <Lazy>
            <Entrar />
          </Lazy>
        }
      />
      <Route
        path="entrar/confirmar"
        element={
          <Lazy>
            <EntrarConfirmar />
          </Lazy>
        }
      />
      <Route
        path="sin-compra"
        element={
          <Lazy>
            <SinCompra />
          </Lazy>
        }
      />

      {/* Panel de administración: solo para la persona que vende. Sin Supabase no muestra datos. */}
      <Route
        path="admin/entrar"
        element={
          <Lazy>
            <AdminEntrar />
          </Lazy>
        }
      />
      <Route
        path="admin/confirmar"
        element={
          <Lazy>
            <AdminConfirmar />
          </Lazy>
        }
      />
      <Route
        path="admin"
        element={
          <Lazy>
            <AdminLayout />
          </Lazy>
        }
      >
        <Route
          index
          element={
            <Lazy>
              <AdminHoy />
            </Lazy>
          }
        />
        <Route
          path="ventas"
          element={
            <Lazy>
              <AdminVentas />
            </Lazy>
          }
        />
        <Route
          path="uso"
          element={
            <Lazy>
              <AdminUso />
            </Lazy>
          }
        />
        <Route
          path="seguridad"
          element={
            <Lazy>
              <AdminSeguridad />
            </Lazy>
          }
        />
      </Route>

      <Route
        element={
          <RequireAcceso>
            <RequireOnboarding>
              <AppShell />
            </RequireOnboarding>
          </RequireAcceso>
        }
      >
        <Route
          path="hoy"
          element={
            <Lazy>
              <Today />
            </Lazy>
          }
        />
        <Route
          path="sesion"
          element={
            <Lazy>
              <Session />
            </Lazy>
          }
        />
        <Route
          path="resultado"
          element={
            <Lazy>
              <Result />
            </Lazy>
          }
        />
        <Route
          path="progreso"
          element={
            <Lazy>
              <Progress />
            </Lazy>
          }
        />
        <Route
          path="biblioteca"
          element={
            <Lazy>
              <Library />
            </Lazy>
          }
        />
        <Route
          path="practica/:gameId"
          element={
            <Lazy>
              <Practice />
            </Lazy>
          }
        />
        <Route
          path="retos"
          element={
            <Lazy>
              <Challenges />
            </Lazy>
          }
        />
        <Route
          path="enfoque"
          element={
            <Lazy>
              <Focus />
            </Lazy>
          }
        />
        <Route
          path="lecciones"
          element={
            <Lazy>
              <Lessons />
            </Lazy>
          }
        />
        <Route
          path="lecciones/:id"
          element={
            <Lazy>
              <LessonDetail />
            </Lazy>
          }
        />
        <Route
          path="ajustes"
          element={
            <Lazy>
              <Settings />
            </Lazy>
          }
        />
        <Route
          path="cuenta"
          element={
            <Lazy>
              <Account />
            </Lazy>
          }
        />
        <Route
          path="checkout"
          element={
            <Lazy>
              <Checkout />
            </Lazy>
          }
        />
      </Route>

      <Route
        path="*"
        element={
          <Lazy>
            <NotFound />
          </Lazy>
        }
      />
    </Route>,
  ),
);

export function App() {
  return (
    <MotionRoot>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </MotionRoot>
  );
}
