import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Segmented, Switch } from '../../components/ui/Controls';
import { Card, PageHeader } from '../../components/ui/Surfaces';
import { useToast } from '../../components/ui/Toast';
import { LEGAL_DOCUMENTS } from '../../content/legal';
import { plantilla } from '../../config/plantilla';
import { env } from '../../config/env';
import { buildExport, parseExport } from '../../data/exportData';
import { useAppStore } from '../../store/appStore';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';
import { useNow } from '../../hooks/useNow';
import { downloadText } from '../../lib/download';
import { deleteRemoteSessions } from '../../services/sync';
import { toDateKey } from '../../domain/dates';
import { normalizeDisplayName } from '../../domain/model';

/** Campo de texto y hora: cristal con borde suave, 16 px para no provocar zoom en iOS. */
const FIELD =
  'min-h-12 rounded-xl bg-canvas/60 px-3.5 text-base text-ink ring-1 ring-inset ring-ink/15';

/** Entrada escalonada de cada grupo de ajustes. */
function Enter({ delay, children }: { delay: number; children: ReactNode }) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <div className="animate-fade-up" style={style}>
      {children}
    </div>
  );
}

const LINK_ROW =
  'flex min-h-12 items-center justify-between gap-3 py-3 font-medium text-ink underline-offset-4 hover:underline';

export default function Settings() {
  useDocumentMeta({
    title: 'Ajustes',
    description: 'Apariencia, accesibilidad y datos de tu copia de Foco Mente.',
  });
  const navigate = useNavigate();
  const toast = useToast();
  const now = useNow();
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const displayName = useAppStore((state) => state.displayName);
  const setDisplayName = useAppStore((state) => state.setDisplayName);
  const replaceData = useAppStore((state) => state.replaceData);
  const deleteAllData = useAppStore((state) => state.deleteAllData);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseExport> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  // El campo guarda lo que escribe la persona (con espacios) y la tienda, la versión normalizada.
  const [nameDraft, setNameDraft] = useState(displayName ?? '');

  // Si el nombre cambia desde fuera (al importar un archivo), el campo lo muestra. Lo que escribe la persona no se pisa.
  if (normalizeDisplayName(nameDraft) !== normalizeDisplayName(displayName ?? '')) {
    setNameDraft(displayName ?? '');
  }

  const exportData = () => {
    const state = useAppStore.getState();
    const file = buildExport(state, now);
    downloadText(`foco-mente-mis-datos-${toDateKey(now)}.json`, file);
    toast.show('Tus datos se han descargado.');
  };

  // Con cuenta, el borrado también se aplica en la nube; si falla, no se borra nada en local para poder reintentarlo.
  const deleteEverything = async () => {
    try {
      await deleteRemoteSessions();
    } catch {
      toast.show(
        'No hemos podido borrar tus datos de la nube. Revisa tu conexión e inténtalo de nuevo.',
      );
      return;
    }
    deleteAllData();
    setDeleteOpen(false);
    setDeleteText('');
    void navigate('/', { replace: true });
  };

  const onFileChosen = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = parseExport(await file.text());
      setPendingImport(data);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'No se pudo leer el archivo.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="pixel-accent">Ajustes</span>}
        lead="Todo lo que cambies aquí se guarda en este dispositivo."
      />

      <Enter delay={80}>
        <Card labelledBy="apariencia">
          <div className="space-y-7">
            <h2 id="apariencia" className="text-xl">
              Apariencia y lectura
            </h2>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Cómo quieres que te saludemos
              <input
                type="text"
                value={nameDraft}
                maxLength={40}
                autoComplete="given-name"
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setDisplayName(event.target.value);
                }}
                onBlur={() => {
                  setNameDraft(displayName ?? '');
                }}
                className={FIELD}
              />
            </label>
            <Segmented
              legend="Tema"
              columns={3}
              value={settings.theme}
              onChange={(theme) => {
                updateSettings({ theme });
              }}
              options={[
                { value: 'sistema', label: 'Sistema' },
                { value: 'claro', label: 'Claro' },
                { value: 'oscuro', label: 'Oscuro' },
              ]}
            />
            <Segmented
              legend="Tamaño del texto"
              columns={2}
              value={settings.textSize}
              onChange={(textSize) => {
                updateSettings({ textSize });
              }}
              options={[
                { value: 'normal', label: 'Normal' },
                {
                  value: 'grande',
                  label: 'Grande',
                  description: 'Un 12 % más grande en toda la app.',
                },
              ]}
            />
            <Segmented
              legend="Animaciones"
              columns={3}
              value={settings.reduceMotion}
              onChange={(reduceMotion) => {
                updateSettings({ reduceMotion });
              }}
              options={[
                { value: 'sistema', label: 'Sistema' },
                { value: 'si', label: 'Reducidas' },
                { value: 'no', label: 'Completas' },
              ]}
            />
          </div>
        </Card>
      </Enter>

      <Enter delay={140}>
        <Card labelledBy="entrenamiento">
          <h2 id="entrenamiento" className="text-xl">
            Entrenamiento
          </h2>
          <div className="mt-2 divide-y divide-line">
            <Switch
              checked={settings.calmMode}
              onChange={(calmMode) => {
                updateSettings({ calmMode });
              }}
              label="Modo sin prisa"
              description="Sin límite de tiempo en los juegos y estímulos más lentos. La sesión dura unos dos minutos más."
            />
            <Switch
              checked={settings.sinColor}
              onChange={(sinColor) => {
                updateSettings({ sinColor });
              }}
              label="Modo sin colores"
              description="Sustituye los juegos que dependen del color por otros con formas y texto."
            />
            <Switch
              checked={settings.haptics}
              onChange={(haptics) => {
                updateSettings({ haptics });
              }}
              label="Vibración al fallar"
              description="Solo en móviles que lo permiten."
            />
          </div>
        </Card>
      </Enter>

      <Enter delay={260}>
        <Card labelledBy="datos">
          <h2 id="datos" className="text-xl">
            Mis datos
          </h2>
          <p className="mt-2 text-ink-soft">
            Son tuyos. Puedes descargarlos en un archivo legible o borrarlos por completo, gratis y
            cuando quieras.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" onClick={exportData}>
              Descargar mis datos (JSON)
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                fileInput.current?.click();
              }}
            >
              Importar un archivo
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                void onFileChosen(event.target.files?.[0]);
              }}
            />
          </div>
        </Card>
      </Enter>

      <Enter delay={320}>
        <section
          aria-labelledby="zona-peligro"
          className="relative overflow-hidden rounded-card border border-danger/30 bg-danger/[0.06] p-5 sm:p-6"
        >
          <div className="space-y-4">
            <h2 id="zona-peligro" className="text-xl text-danger-text">
              Zona de peligro
            </h2>
            <p className="text-ink-soft">
              Borrar es definitivo. Si quieres conservar tus datos, descárgalos antes.
            </p>
            <Button
              variant="danger"
              onClick={() => {
                setDeleteOpen(true);
              }}
            >
              Borrar todos mis datos
            </Button>
          </div>
        </section>
      </Enter>

      <Enter delay={380}>
        <Card labelledBy="ayuda">
          <h2 id="ayuda" className="text-xl">
            Ayuda y legal
          </h2>
          <ul className="mt-2 divide-y divide-line">
            <li>
              <Link className={LINK_ROW} to="/ciencia">
                Qué dice la ciencia
                <ArrowRightIcon
                  size={18}
                  weight="bold"
                  className="shrink-0 text-brand"
                  aria-hidden="true"
                />
              </Link>
            </li>
            <li>
              <Link className={LINK_ROW} to="/pacto">
                El Pacto Sin Trampas
                <ArrowRightIcon
                  size={18}
                  weight="bold"
                  className="shrink-0 text-brand"
                  aria-hidden="true"
                />
              </Link>
            </li>
            {LEGAL_DOCUMENTS.map((document) => (
              <li key={document.slug}>
                <Link className={LINK_ROW} to={`/legal/${document.slug}`}>
                  {document.title}
                  <ArrowRightIcon
                    size={18}
                    weight="bold"
                    className="shrink-0 text-brand"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
            {env.supportEmail && (
              <li>
                <a className={LINK_ROW} href={`mailto:${env.supportEmail}`}>
                  Escribir a soporte
                  <ArrowRightIcon
                    size={18}
                    weight="bold"
                    className="shrink-0 text-brand"
                    aria-hidden="true"
                  />
                </a>
              </li>
            )}
          </ul>
          <p className="mt-4 text-xs text-ink-soft">
            {plantilla.nombre} · Sin anuncios · Sin cookies de terceros
          </p>
        </Card>
      </Enter>

      <Dialog
        open={pendingImport !== null}
        onClose={() => {
          setPendingImport(null);
        }}
        title="¿Reemplazar tus datos?"
      >
        <p className="text-ink-soft">
          Vas a sustituir todo lo que hay en este dispositivo por el contenido del archivo. Lo
          actual se pierde.
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setPendingImport(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (pendingImport) replaceData(pendingImport);
              setPendingImport(null);
              toast.show('Datos importados.');
            }}
          >
            Importar
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteText('');
        }}
        title="Borrar todo"
      >
        <p className="text-ink-soft">
          Se borran tus sesiones, tu progreso y tus preferencias de este dispositivo y, si tienes
          cuenta, también de la nube. No se puede deshacer. Si quieres conservarlos, descárgalos
          antes.
        </p>
        <label className="flex flex-col gap-2 text-sm font-medium">
          Escribe BORRAR para confirmar
          <input
            value={deleteText}
            onChange={(event) => {
              setDeleteText(event.target.value);
            }}
            className={FIELD}
            autoComplete="off"
          />
        </label>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setDeleteOpen(false);
              setDeleteText('');
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={deleteText !== 'BORRAR'}
            onClick={() => {
              void deleteEverything();
            }}
          >
            Borrar todo
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
