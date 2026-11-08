import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileArchive,
  FileText,
  Fingerprint,
  Github,
  LockKeyhole,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  GlassButton,
  GlassSegmented,
  GlassSheet,
  GlassSurface,
  GlassSwitch,
} from "@/components/glass/Glass";
import { ProviderLogo } from "@/components/icons";
import { AccessList } from "@/components/AccessList";
import { PROVIDERS, PROVIDER_ORDER, type ProviderId } from "@/lib/ai/providers";
import { useSettings } from "@/lib/settings";
import { downloadJson, downloadZip, importJson, wipeAll } from "@/lib/backup";
import { cn } from "@/lib/utils";
import { notify } from "@/hooks/use-reminders";
import { warnText } from "@/lib/reminders";
import { APP_VERSION, checkForUpdate, UPDATE_AVAILABLE_EVENT } from "@/lib/updater";
import { hashPin, hasPlatformAuthenticator, registerBiometric } from "@/lib/security";
import { SyncModal } from "@/components/sync/SyncModal";
import { db } from "@/lib/db";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes · Meld" },
      {
        name: "description",
        content: "Configura tu IA, apariencia, diario y tus datos locales en Meld.",
      },
      { property: "og:title", content: "Ajustes · Meld" },
      { property: "og:description", content: "Configura tu IA, apariencia y datos locales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Settings,
});

function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 30 }}
    >
      <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <GlassSurface className="p-2">{children}</GlassSurface>
    </motion.section>
  );
}

function NotificationsSection() {
  const hours = useSettings((s) => s.taskWarnHours);
  const setHours = useSettings((s) => s.setTaskWarnHours);
  const supported = typeof Notification !== "undefined";
  const [perm, setPerm] = useState<string>(supported ? Notification.permission : "unsupported");
  const enable = async () => {
    if (!supported) {
      toast.error("Este dispositivo no admite notificaciones");
      return;
    }
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p === "granted") {
      toast.success("Notificaciones activadas");
      notify("Meld", warnText("Ejemplo de tarea", hours || 2));
    } else toast.error("Permiso denegado. Actívalo desde los ajustes del navegador.");
  };
  return (
    <Section title="Notificaciones" delay={0.14}>
      <Row
        label="Notificaciones del sistema"
        hint={
          perm === "granted"
            ? "Activadas"
            : perm === "denied"
              ? "Bloqueadas en el navegador"
              : "Recibe avisos aunque no mires la app"
        }
      >
        <button
          type="button"
          onClick={() => void enable()}
          className="glass rounded-full px-4 py-1.5 text-sm font-medium"
        >
          <span className="relative z-10">{perm === "granted" ? "Probar" : "Activar"}</span>
        </button>
      </Row>
      <Row label="Aviso antes de una tarea" hint={hours ? warnText("…", hours) : "Desactivado"}>
        <GlassSegmented
          value={String(hours)}
          onChange={(v) => setHours(Number(v))}
          layoutId="warn-hours"
          size="sm"
          options={[
            { value: "0", label: "No" },
            { value: "1", label: "1h" },
            { value: "2", label: "2h" },
            { value: "24", label: "1d" },
          ]}
        />
      </Row>
    </Section>
  );
}

function SecuritySection() {
  const s = useSettings();
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    void hasPlatformAuthenticator()
      .then(setBiometricAvailable)
      .catch(() => setBiometricAvailable(false));
  }, []);

  const savePin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error("El PIN debe tener exactamente 4 dígitos.");
      return;
    }
    if (pin !== confirmation) {
      toast.error("Los PIN no coinciden.");
      return;
    }
    try {
      s.setPinHash(await hashPin(pin));
      s.setLockEnabled(true);
      setPin("");
      setConfirmation("");
      toast.success("PIN guardado en este dispositivo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar el PIN");
    }
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (!enabled) {
      s.setBiometric(false, null);
      return;
    }
    if (!s.pinHash) {
      toast.error("Configura primero un PIN de 4 dígitos.");
      return;
    }
    try {
      const credentialId = await registerBiometric(s.deviceId);
      s.setBiometric(true, credentialId);
      toast.success("Biometría configurada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo configurar la biometría");
    }
  };

  return (
    <Section title="Seguridad y privacidad" delay={0.14}>
      <Row
        label="Bloquear aplicación con PIN / Biometría"
        hint={
          s.pinHash
            ? "PIN configurado en este dispositivo"
            : "Configura un PIN para activar el bloqueo"
        }
      >
        <GlassSwitch
          checked={s.lockEnabled}
          onChange={(enabled) => {
            if (enabled && !s.pinHash) toast.error("Configura primero un PIN de 4 dígitos.");
            else s.setLockEnabled(enabled);
          }}
          label="Bloquear aplicación con PIN o biometría"
        />
      </Row>
      <div className="space-y-3 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LockKeyhole className="h-4 w-4 text-primary" />
          Configurar PIN de 4 dígitos
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Nuevo PIN"
            aria-label="Nuevo PIN de 4 dígitos"
            className="h-11 rounded-2xl bg-muted px-3 text-center tracking-[0.4em] outline-none"
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Repetir PIN"
            aria-label="Repetir PIN"
            className="h-11 rounded-2xl bg-muted px-3 text-center tracking-[0.4em] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void savePin()}
          disabled={pin.length !== 4 || confirmation.length !== 4}
          className="h-10 w-full rounded-2xl bg-muted text-sm font-medium disabled:opacity-50"
        >
          {s.pinHash ? "Cambiar PIN" : "Guardar PIN"}
        </button>
      </div>
      <Row label="Alcance del bloqueo" hint="El modo Diario solo protege esa sección">
        <GlassSegmented
          layoutId="lock-scope"
          size="sm"
          value={s.lockScope}
          onChange={s.setLockScope}
          options={[
            { value: "app", label: "Toda la app" },
            { value: "journal", label: "Solo Diario" },
          ]}
        />
      </Row>
      <Row
        label="Permitir huella / Face ID"
        hint={
          biometricAvailable
            ? "El autenticador del dispositivo está disponible"
            : "No se detectó un autenticador biométrico"
        }
      >
        <GlassSwitch
          checked={s.biometricEnabled}
          onChange={(enabled) => void toggleBiometric(enabled)}
          label="Permitir biometría"
        />
      </Row>
      {s.biometricEnabled && (
        <p className="px-3 pb-2 text-xs text-muted-foreground">
          <Fingerprint className="mr-1 inline h-3.5 w-3.5" />
          La verificación biométrica se procesa en el dispositivo y no se envía a Meld.
        </p>
      )}
      <Row label="Temporizador de auto-bloqueo">
        <GlassSegmented
          layoutId="auto-lock"
          size="sm"
          value={s.autoLock}
          onChange={s.setAutoLock}
          options={[
            { value: "immediate", label: "Inmediato" },
            { value: "1", label: "1 min" },
            { value: "5", label: "5 min" },
          ]}
        />
      </Row>
    </Section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function ApiSection() {
  const s = useSettings();
  const [tab, setTab] = useState<ProviderId>(s.provider);
  const [show, setShow] = useState(false);
  const info = PROVIDERS[tab];
  const model = s.models[tab];
  const isCustom = !info.models.some((m) => m.id === model);

  return (
    <div className="flex flex-col gap-3 p-2">
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <GlassSegmented
          layoutId="settings-provider"
          size="sm"
          value={tab}
          onChange={setTab}
          options={PROVIDER_ORDER.map((p) => ({ value: p, label: PROVIDERS[p].label }))}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between px-1 text-sm font-medium">
          Clave API de {info.label}
          <a
            href={info.keyUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-coral"
          >
            Obtener clave <ExternalLink className="h-3 w-3" />
          </a>
        </span>
        <div className="flex items-center gap-2 rounded-2xl bg-muted pr-2">
          <input
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={s.apiKeys[tab] ?? ""}
            onChange={(e) => s.setApiKey(tab, e.target.value)}
            placeholder={info.keyHint}
            className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar clave" : "Mostrar clave"}
            className="p-1.5 text-muted-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <span className="px-1 text-xs text-muted-foreground">
          Se guarda solo en este dispositivo y únicamente se envía a {info.label}.
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="px-1 text-sm font-medium">Modelo</span>
        <div className="flex flex-col">
          {info.models.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => s.setModel(tab, m.id)}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2 text-left",
                model === m.id ? "bg-accent" : "hover:bg-muted",
              )}
            >
              <ProviderLogo provider={tab} size={18} />
              <span className="flex-1 text-sm">{m.label}</span>
              <span className="text-xs text-muted-foreground">{m.id}</span>
            </button>
          ))}
        </div>
        <input
          value={isCustom ? model : ""}
          onChange={(e) => s.setModel(tab, e.target.value.trim() || (info.models[0]?.id ?? ""))}
          placeholder="ID de modelo personalizado…"
          className="h-10 rounded-2xl bg-muted px-3 font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>

      <button
        type="button"
        onClick={() => {
          s.setProvider(tab);
          toast.success(`${info.label} es ahora tu IA por defecto`);
        }}
        disabled={s.provider === tab}
        className="h-11 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
      >
        {s.provider === tab ? "Proveedor por defecto" : `Usar ${info.label} por defecto`}
      </button>
    </div>
  );
}

function Settings() {
  const s = useSettings();
  const trashCount = useLiveQuery(async () => {
    const [pages, tasks] = await Promise.all([
      db.pages.filter((page) => !!page.deletedAt).count(),
      db.tasks.filter((task) => !!task.deletedAt).count(),
    ]);
    return pages + tasks;
  }, []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);

  const searchUpdates = async () => {
    if (checkingUpdates) return;
    setCheckingUpdates(true);
    try {
      const info = await checkForUpdate(true);
      if (!info) {
        toast.info("Estás en la última versión de Meld");
        return;
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(UPDATE_AVAILABLE_EVENT, { detail: info }));
      }
    } catch {
      toast.error("No se pudieron comprobar las actualizaciones");
    } finally {
      setCheckingUpdates(false);
    }
  };

  return (
    <div className="pb-safe min-h-dvh pb-10">
      <header className="pt-safe sticky top-0 z-30 px-[17px]">
        <div className="flex items-center gap-3 pt-[10px]">
          <Link to="/" aria-label="Volver">
            <GlassButton size="md" tabIndex={-1}>
              <ArrowLeft className="h-5 w-5" />
            </GlassButton>
          </Link>
        </div>
      </header>
      <h1 className="px-5 pb-4 pt-4 text-[34px] font-bold tracking-tight">Ajustes</h1>

      <div className="px-4">
        <Section title="Sincronización entre dispositivos">
          <SyncModal />
        </Section>
      </div>

      <div className="mt-6 grid grid-cols-1 items-start gap-6 px-4 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Section title="Inteligencia artificial">
            <ApiSection />
          </Section>

          <Section title="Permisos por defecto de la IA" delay={0.04}>
            <AccessList target="defaults" />
            <div className="px-2 pb-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  s.resetAccessToDefault();
                  toast.success("Permisos aplicados");
                }}
                className="h-10 w-full rounded-2xl bg-muted text-sm font-medium"
              >
                Aplicar ahora al chat
              </button>
            </div>
          </Section>

          <Section title="Apariencia" delay={0.08}>
            <Row label="Tema">
              <GlassSegmented
                layoutId="theme"
                size="sm"
                value={s.theme}
                onChange={s.setTheme}
                options={[
                  { value: "dark", label: "Oscuro" },
                  { value: "light", label: "Claro" },
                ]}
              />
            </Row>
            <Row label="Reducir animaciones" hint="Menos movimiento en toda la app">
              <GlassSwitch
                checked={s.reduceMotion}
                onChange={s.setReduceMotion}
                label="Reducir animaciones"
              />
            </Row>
            <Row label="Idioma">
              <span className="text-sm text-muted-foreground">Español</span>
            </Row>
          </Section>
        </div>

        <div className="flex flex-col gap-6">
          <SecuritySection />

          <NotificationsSection />

          <Section title="Diario" delay={0.12}>
            <Row
              label="Activar diario"
              hint={
                s.journalEnabled
                  ? "Visible en la app y en el acceso de la IA"
                  : "Tus entradas se conservan aunque lo desactives"
              }
            >
              <GlassSwitch
                checked={s.journalEnabled}
                onChange={s.setJournalEnabled}
                label="Activar diario"
              />
            </Row>
            <Row
              label="Bloquear entradas pasadas"
              hint="Protege las entradas de días anteriores frente a modificaciones accidentales."
            >
              <GlassSwitch
                checked={s.lockPastJournalEntries}
                onChange={s.setLockPastJournalEntries}
                label="Bloquear entradas pasadas"
              />
            </Row>
          </Section>

          <Section title="Tus datos" delay={0.16}>
            <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">
              Todo se guarda en este dispositivo. Haz copias de vez en cuando.
            </p>
            <Link
              to="/papelera"
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-[15px] font-medium">Papelera de reciclaje</span>
              <span className="text-sm text-muted-foreground">{trashCount ?? 0}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div className="grid grid-cols-2 gap-2 p-1">
              <DataButton
                icon={<Download className="h-4 w-4" />}
                label="Exportar JSON"
                onClick={() => void downloadJson()}
              />
              <DataButton
                icon={<FileArchive className="h-4 w-4" />}
                label="Exportar ZIP (.md)"
                onClick={() => void downloadZip()}
              />
              <DataButton
                icon={<Upload className="h-4 w-4" />}
                label="Importar JSON"
                onClick={() => fileRef.current?.click()}
              />
              <DataButton
                icon={<Trash2 className="h-4 w-4" />}
                label="Borrar todo"
                danger
                onClick={() => setConfirmWipe(true)}
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  await importJson(f);
                  toast.success("Datos importados");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "No se pudo importar");
                }
              }}
            />
          </Section>
        </div>
      </div>

      <div className="mt-6 px-4">
        <Section title="Acerca de" delay={0.2}>
          <div className="grid gap-3 p-1 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-muted/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tu espacio
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-lg font-semibold tracking-tight">Meld</span>
                <span className="rounded-full bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Organización personal con IA, privada y en local.
              </p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-muted/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Privacidad y ayuda
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Tus datos permanecen en el dispositivo. Consulta cómo funciona Meld o ponte en
                contacto con soporte.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <button
                  type="button"
                  onClick={() => setShowPrivacy(true)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Ver política
                </button>
                <a
                  href="mailto:soporte@seacraft2.net"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Contactar soporte
                </a>
              </div>
            </div>

            <div className="rounded-2xl border border-white/5 bg-muted/35 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Comunidad y actualizaciones
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href="https://github.com/GALHAKPRO988/Meld"
                  target="_blank"
                  rel="noreferrer"
                  className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:text-coral"
                >
                  <Github className="h-4 w-4" />
                  GitHub
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => void searchUpdates()}
                  disabled={checkingUpdates}
                  className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:text-coral disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={cn("h-4 w-4", checkingUpdates && "animate-spin")} />
                  {checkingUpdates ? "Buscando..." : "Buscar actualizaciones"}
                </button>
                <a
                  href="/changelog/latest.md"
                  target="_blank"
                  rel="noreferrer"
                  className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:text-coral"
                >
                  <FileText className="h-4 w-4" />
                  Changelog v{APP_VERSION}
                </a>
              </div>
            </div>
          </div>
          <p className="mx-1 mb-1 flex items-center gap-2 rounded-2xl bg-sage/10 px-3 py-2.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sage" />
            Datos locales · Solo se transfieren a otro dispositivo si inicias P2P
          </p>
        </Section>
      </div>

      <GlassSheet
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="¿Borrar todos los datos?"
      >
        <p className="mb-4 text-sm text-muted-foreground">
          Se eliminarán páginas, tareas, eventos, carpetas, tags y diario de este dispositivo. No se
          puede deshacer.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmWipe(false)}
            className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              await wipeAll();
              setConfirmWipe(false);
              toast.success("Datos borrados");
            }}
            className="h-11 flex-1 rounded-2xl bg-destructive text-sm font-semibold text-destructive-foreground"
          >
            Borrar todo
          </button>
        </div>
      </GlassSheet>
      <GlassSheet
        open={showPrivacy}
        onClose={() => setShowPrivacy(false)}
        title="Privacidad y datos locales"
      >
        <div className="text-sm text-muted-foreground space-y-3.5 leading-relaxed">
          <p>
            <strong className="font-medium text-foreground">Arquitectura Local-First:</strong> Todos
            tus datos (páginas, tareas, diario, eventos y adjuntos) se guardan en IndexedDB de tu
            dispositivo. Meld no opera una base de datos en la nube. La sincronización P2P es
            opcional: usa un servicio público para intercambiar metadatos de conexión y un servidor
            STUN para establecer la conexión; el contenido viaja cifrado directamente entre los
            dispositivos y esos servicios no lo reciben ni lo almacenan.
          </p>
          <p>
            <strong className="font-medium text-foreground">Sin telemetría:</strong> La app no
            recopila métricas, cookies de análisis ni datos de uso.
          </p>
          <p>
            <strong className="font-medium text-foreground">Inteligencia Artificial:</strong> Las
            claves API se guardan en tu equipo y las llamadas van directamente desde tu dispositivo
            a tu proveedor de IA (Anthropic, OpenAI, Google u OpenRouter). Meld jamás intercepta tus
            consultas ni tus claves.
          </p>
          <p>
            <strong className="font-medium text-foreground">Actualizaciones:</strong> Meld consulta
            periódicamente las releases públicas de GitHub (
            <span className="font-mono">api.github.com</span>) para avisarte de nuevas versiones.
          </p>
          <p>
            <strong className="font-medium text-foreground">Titularidad y Contacto:</strong>{" "}
            Proyecto independiente operado bajo el dominio{" "}
            <span className="font-mono">seacraft2.net</span>. Para cualquier consulta o sugerencia:{" "}
            <a href="mailto:soporte@seacraft2.net" className="text-primary hover:underline">
              soporte@seacraft2.net
            </a>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPrivacy(false)}
          className="mt-4 h-11 w-full rounded-2xl bg-muted text-sm font-medium text-foreground"
        >
          Entendido
        </button>
      </GlassSheet>
    </div>
  );
}

function DataButton({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={cn(
        "flex h-12 items-center justify-center gap-2 rounded-2xl bg-muted text-sm font-medium",
        danger && "text-destructive",
      )}
    >
      {icon}
      {label}
    </motion.button>
  );
}
