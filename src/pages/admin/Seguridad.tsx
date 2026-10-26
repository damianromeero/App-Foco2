// Segundo factor (TOTP) según Supabase Auth (auth-js 2.118.0). Las llamadas las hace el servidor (/api/admin/mfa), con la
// cookie httpOnly de la administradora; el navegador no recibe tokens. Detalle de cada endpoint en src/admin/mfa.ts.
//   enroll (alta)        → POST /auth/v1/factors. Devuelve id, totp.qr_code y totp.secret. Confirmado en auth-js.
//   challenge (reto)     → POST /auth/v1/factors/{id}/challenge. Devuelve el id del reto. Confirmado en auth-js.
//   verify (verificar)   → POST /auth/v1/factors/{id}/verify. Devuelve sesión nueva con nivel aal2; el servidor la guarda.
//   listFactors          → factores del usuario, en GET /auth/v1/user (campo factors), como hace la librería.
//   nivel de seguridad   → claim `aal` del token (aal1 o aal2). Lo lee el servidor en /api/admin/sesion.
import { useEffect, useState, type SyntheticEvent } from 'react';
import { useNavigate } from 'react-router';
import { formatearFecha } from '../../admin/formato';
import {
  darDeAltaFactor,
  listarFactores,
  pedirReto,
  verificarCodigo as comprobarCodigo,
  type Enrolamiento,
  type FactorAdmin,
} from '../../admin/mfa';
import { cerrarSesionAdmin, estadoAdmin } from '../../admin/sesion';
import { EstadoCarga } from '../../components/admin/EstadoCarga';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Surfaces';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useRecargarEstadoAdmin } from './AdminLayout';

interface Estado {
  conSegundoFactor: boolean;
  factores: FactorAdmin[];
}

const MENSAJE_CODIGO = 'El código no es correcto. Revisa tu app y escribe el código actual.';

async function leerEstado(): Promise<Estado> {
  const [nivel, factores] = await Promise.all([estadoAdmin(), listarFactores()]);
  if (nivel === 'error' || nivel === 'sin-backend' || nivel === 'sin-sesion') {
    throw new Error('No pudimos leer tus factores de seguridad.');
  }
  return { conSegundoFactor: nivel === 'listo', factores };
}

/** Seguridad: la sesión, el segundo factor (código QR, TOTP) y cerrar sesión. Nada de esto se guarda en el navegador. */
export default function Seguridad() {
  useDocumentMeta({ title: 'Seguridad' });
  const navigate = useNavigate();
  const recargarEstado = useRecargarEstadoAdmin();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [enrolamiento, setEnrolamiento] = useState<Enrolamiento | null>(null);
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    void leerEstado().then(
      (nuevo) => {
        if (vigente) setEstado(nuevo);
      },
      () => {
        if (vigente) setError('No pudimos leer tus factores de seguridad. Vuelve a intentarlo.');
      },
    );
    return () => {
      vigente = false;
    };
  }, [version]);

  const verificado = estado?.factores.find((factor) => factor.verificado && factor.tipo === 'totp');
  const conSegundoFactor = estado?.conSegundoFactor === true;

  async function prepararEnrolamiento() {
    setOcupado(true);
    setError(null);
    try {
      const nuevo = await darDeAltaFactor(`Autenticador ${Date.now().toString(36)}`);
      setEnrolamiento(nuevo);
    } catch {
      setError('No pudimos preparar el segundo factor. Vuelve a intentarlo.');
    } finally {
      setOcupado(false);
    }
  }

  async function verificarCodigo(evento: SyntheticEvent<HTMLFormElement>) {
    evento.preventDefault();
    const factorId = enrolamiento?.id ?? verificado?.id;
    if (!factorId || codigo.length !== 6) return;
    setOcupado(true);
    setError(null);
    try {
      const challengeId = await pedirReto(factorId);
      const resultado = await comprobarCodigo(factorId, challengeId, codigo);
      if (resultado === 'codigo-incorrecto') {
        setCodigo('');
        setError(MENSAJE_CODIGO);
        return;
      }
      setEnrolamiento(null);
      setCodigo('');
      recargarEstado();
      setVersion((actual) => actual + 1);
    } catch {
      setError('No pudimos comprobar el código. Vuelve a intentarlo.');
    } finally {
      setOcupado(false);
    }
  }

  async function copiarSecreto(secreto: string) {
    try {
      await navigator.clipboard.writeText(secreto);
      setCopiado(true);
    } catch {
      setCopiado(false);
      setError('No pudimos copiar el código. Selecciónalo y cópialo a mano.');
    }
  }

  async function salir() {
    setSaliendo(true);
    setError(null);
    try {
      await cerrarSesionAdmin();
      void navigate('/admin/entrar', { replace: true });
    } catch {
      setError('No pudimos cerrar la sesión. Vuelve a intentarlo.');
      setSaliendo(false);
    }
  }

  if (!estado) {
    return error ? (
      <p role="alert" className="text-base text-danger-text">
        {error}
      </p>
    ) : (
      <EstadoCarga texto="Cargando la seguridad…" />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Seguridad</h1>
        <p className="mt-1 text-base text-ink-soft">
          Tu sesión y el segundo factor que se pide al entrar. Conviene tener un segundo teléfono.
        </p>
      </div>

      <Card as="section" labelledBy="titulo-sesion" className="flex flex-col gap-3">
        <h2 id="titulo-sesion" className="text-lg font-semibold text-ink">
          Tu sesión
        </h2>
        <p className="text-base text-ink">
          Nivel de seguridad:{' '}
          <span className="font-medium">
            {conSegundoFactor ? 'con segundo factor' : 'solo con el enlace'}
          </span>
        </p>
        <div>
          <Button
            variant="secondary"
            onClick={() => {
              void salir();
            }}
            disabled={saliendo}
          >
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </div>
      </Card>

      <Card as="section" labelledBy="titulo-factor" className="flex flex-col gap-4">
        <h2 id="titulo-factor" className="text-lg font-semibold text-ink">
          Segundo factor
        </h2>

        {verificado ? <p className="text-base text-ink">Segundo factor activo.</p> : null}

        {verificado && !conSegundoFactor ? (
          <CodigoFactor
            codigo={codigo}
            ocupado={ocupado}
            alCambiar={setCodigo}
            alEnviar={(evento) => {
              void verificarCodigo(evento);
            }}
            texto="Escribe el código de tu app para confirmar tu acceso."
          />
        ) : null}

        {!verificado && !enrolamiento ? (
          <div className="flex flex-col gap-3">
            <p className="text-base text-ink-soft">
              Aún no tienes un segundo factor. Con una app de autenticación, escanea el código y
              escribe el primer código de 6 dígitos.
            </p>
            <div>
              <Button
                onClick={() => {
                  void prepararEnrolamiento();
                }}
                disabled={ocupado}
              >
                Mostrar el código QR
              </Button>
            </div>
          </div>
        ) : null}

        {!verificado && enrolamiento ? (
          <div className="flex flex-col gap-4">
            <figure className="flex flex-col items-start gap-3">
              <img
                src={enrolamiento.qr}
                alt="Código QR para añadir el segundo factor a tu app de autenticación"
                width={200}
                height={200}
                className="size-52 rounded-2xl bg-white p-2"
              />
              <figcaption className="text-base text-ink-soft">
                Si no puedes escanearlo, escribe este código en tu app:{' '}
                <code className="break-all font-mono text-ink">{enrolamiento.secreto}</code>
              </figcaption>
            </figure>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  void copiarSecreto(enrolamiento.secreto);
                }}
              >
                Copiar código
              </Button>
              {copiado ? (
                <span role="status" className="text-base text-ink-soft">
                  Copiado
                </span>
              ) : null}
            </div>
            <CodigoFactor
              codigo={codigo}
              ocupado={ocupado}
              alCambiar={setCodigo}
              alEnviar={(evento) => {
                void verificarCodigo(evento);
              }}
              texto="Escribe el código de 6 dígitos que muestra tu app."
            />
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="text-base text-danger-text">
            {error}
          </p>
        ) : null}
      </Card>

      <Card as="section" labelledBy="titulo-lista" className="flex flex-col gap-3">
        <h2 id="titulo-lista" className="text-lg font-semibold text-ink">
          Factores registrados
        </h2>
        {estado.factores.length === 0 ? (
          <p className="text-base text-ink-soft">Todavía no hay factores registrados.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {estado.factores.map((factor) => (
              <li key={factor.id} className="flex flex-col gap-1 py-3">
                <span className="text-base text-ink">{factor.nombre}</span>
                <span className="text-base text-ink-soft">
                  {factor.verificado ? 'Activo' : 'Pendiente de confirmar'} · Añadido el{' '}
                  {formatearFecha(factor.creadoEn)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function CodigoFactor({
  codigo,
  ocupado,
  alCambiar,
  alEnviar,
  texto,
}: {
  codigo: string;
  ocupado: boolean;
  alCambiar: (valor: string) => void;
  alEnviar: (evento: SyntheticEvent<HTMLFormElement>) => void;
  texto: string;
}) {
  return (
    <form className="flex flex-col gap-4" onSubmit={alEnviar}>
      <div className="flex flex-col gap-2">
        <label htmlFor="codigo-factor" className="text-base text-ink">
          Código de 6 dígitos
        </label>
        <p className="text-base text-ink-soft">{texto}</p>
        <input
          id="codigo-factor"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(evento) => {
            alCambiar(evento.target.value.replace(/\D/g, '').slice(0, 6));
          }}
          disabled={ocupado}
          className="min-h-12 w-full max-w-xs rounded-2xl px-4 font-mono text-lg tracking-[0.3em] text-ink glass ring-1 ring-inset ring-line"
        />
      </div>
      <div>
        <Button type="submit" disabled={ocupado || codigo.length !== 6}>
          {ocupado ? 'Comprobando…' : 'Verificar código'}
        </Button>
      </div>
    </form>
  );
}
