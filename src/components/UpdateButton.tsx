import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { GlassSheet } from "@/components/glass/Glass";
import { APP_VERSION, checkForUpdate, loadChangelog, UPDATE_AVAILABLE_EVENT, type UpdateInfo } from "@/lib/updater";

/** Subtle top pill shown only when a newer GitHub release exists; changelog opens on tap. */
export function UpdateButton() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [electronUpdater, setElectronUpdater] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    checkForUpdate()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  useEffect(() => {
    setElectronUpdater(typeof window.meldUpdater !== "undefined");
    return window.meldUpdater?.onDownloadProgress(({ percent }) => setDownloadProgress(percent));
  }, []);

  useEffect(() => {
    const showUpdate = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const updateInfo = event.detail as UpdateInfo;
      setInfo(updateInfo);
      setOpen(true);
      void loadChangelog().then(setNotes);
    };
    window.addEventListener(UPDATE_AVAILABLE_EVENT, showUpdate);
    return () => window.removeEventListener(UPDATE_AVAILABLE_EVENT, showUpdate);
  }, []);

  if (!info) return null;

  const installLatest = async () => {
    if (!window.meldUpdater || installing) return;
    setInstalling(true);
    setDownloadProgress(0);
    try {
      const started = await window.meldUpdater.installLatest();
      if (!started) toast.info("No se encontró una nueva actualización de Windows.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo instalar la actualización.");
    } finally {
      setInstalling(false);
    }
  };

  const actionLabel = info.platform === "ios" ? "Ver release" : info.platform === "android" ? "Descargar APK" : "Descargar actualización";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          void loadChangelog().then(setNotes);
        }}
        className="glass fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+10px)] z-50 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full px-4 text-sm font-medium"
      >
        <span className="relative z-10 flex items-center gap-2">
          <Download className="h-4 w-4 text-coral" /> Nueva versión
        </span>
      </button>
      <GlassSheet open={open} onClose={() => setOpen(false)} title={`Meld ${info.version}`}>
        <p className="mb-3 text-xs text-muted-foreground">Tienes la {APP_VERSION}. Tus datos se conservan al actualizar.</p>
        {info.platform === "ios" && (
          <p className="mb-3 text-xs text-muted-foreground">En iOS, las actualizaciones se distribuyen mediante App Store o TestFlight; no se puede instalar un IPA desde GitHub.</p>
        )}
        {info.platform === "android" && <p className="mb-3 text-xs text-muted-foreground">Tras descargar el APK, Android te pedirá confirmar la instalación.</p>}
        {installing && <p className="mb-3 text-xs text-muted-foreground">Descargando actualización de Windows: {Math.round(downloadProgress)}%</p>}
        <div className="prose prose-sm mb-4 max-h-[50vh] overflow-y-auto text-sm text-foreground dark:prose-invert">
          <ReactMarkdown>{notes || "Cargando…"}</ReactMarkdown>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium">
            Más tarde
          </button>
          {electronUpdater && info.platform === "windows" ? (
            <button
              type="button"
              onClick={() => void installLatest()}
              disabled={installing}
              className="h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {installing ? "Descargando…" : "Descargar e instalar"}
            </button>
          ) : (
            <a href={info.url} target="_blank" rel="noreferrer" className="grid h-11 flex-1 place-items-center rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
              {actionLabel}
            </a>
          )}
        </div>
      </GlassSheet>
    </>
  );
}
