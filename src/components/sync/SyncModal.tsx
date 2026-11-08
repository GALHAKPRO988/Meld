import { Peer, type DataConnection } from "peerjs";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef, useState } from "react";
import { Copy, Radio, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSettings, type LinkedDevice } from "@/lib/settings";
import {
  createMergedSnapshot,
  createSyncSnapshot,
  replaceDatabase,
  sendSyncPacket,
  SyncPacketAssembler,
  type SyncDeviceInfo,
  type SyncPacket,
  type SyncStrategy,
} from "@/lib/sync-p2p";

type Role = "host" | "join";

const peerOptions = {
  config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
  debug: 0 as const,
};

function isDeviceInfo(value: unknown): value is SyncDeviceInfo {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SyncDeviceInfo).id === "string" &&
    (value as SyncDeviceInfo).id.length > 0 &&
    (value as SyncDeviceInfo).id.length <= 128 &&
    typeof (value as SyncDeviceInfo).name === "string" &&
    (value as SyncDeviceInfo).name.trim().length > 0 &&
    (value as SyncDeviceInfo).name.length <= 40 &&
    typeof (value as SyncDeviceInfo).peerId === "string" &&
    /^[\w-]{4,80}$/.test((value as SyncDeviceInfo).peerId),
  );
}

export function SyncModal() {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<Role>("host");
  const [strategy, setStrategy] = useState<SyncStrategy>("merge");
  const [joinCode, setJoinCode] = useState("");
  const [hostCode, setHostCode] = useState("");
  const [working, setWorking] = useState(false);
  const [connected, setConnected] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connections = useRef<Set<DataConnection>>(new Set());
  const assembler = useRef(new SyncPacketAssembler());

  const localDevice: SyncDeviceInfo = {
    id: settings.deviceId,
    name: settings.deviceName,
    peerId: settings.peerId,
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("meld-peer");
    if (code) {
      setRole("join");
      setJoinCode(code);
      setOpen(true);
    }
  }, []);

  const remember = (device: SyncDeviceInfo) => {
    if (device.id === settings.deviceId) return;
    const record: LinkedDevice = { ...device, lastSyncedAt: Date.now() };
    settings.saveLinkedDevice(record);
  };

  const handlePacket = async (
    connection: DataConnection,
    packet: Exclude<SyncPacket, { type: "chunk" }>,
    packetRole: Role,
  ) => {
    if (packet.type === "hello" && packetRole === "host") {
      if (!isDeviceInfo(packet.device)) throw new Error("No se reconoce el dispositivo emisor.");
      const remote = packet.device;
      remember(remote);
      const selectedStrategy = packet.strategy;
      if (!["copy", "overwrite", "merge"].includes(selectedStrategy))
        throw new Error("La estrategia de sincronización no es válida.");
      if (selectedStrategy === "overwrite") {
        if (!packet.snapshot) throw new Error("El dispositivo no envió su copia local.");
        await replaceDatabase(packet.snapshot);
        await sendSyncPacket(connection, { type: "done", device: localDevice });
        toast.success(`Datos actualizados desde ${remote.name}`);
        return;
      }
      const snapshot =
        selectedStrategy === "merge"
          ? await createMergedSnapshot(
              packet.snapshot as Awaited<ReturnType<typeof createSyncSnapshot>>,
            )
          : await createSyncSnapshot();
      if (selectedStrategy === "merge") await replaceDatabase(snapshot);
      await sendSyncPacket(connection, { type: "sync", device: localDevice, snapshot });
      return;
    }

    if (packet.type === "sync" && packetRole === "join") {
      if (!isDeviceInfo(packet.device)) throw new Error("No se reconoce el dispositivo vinculado.");
      const snapshot = packet.snapshot as Awaited<ReturnType<typeof createSyncSnapshot>>;
      await replaceDatabase(snapshot);
      remember(packet.device);
      await sendSyncPacket(connection, { type: "done", device: localDevice });
      setConnected(true);
      setWorking(false);
      toast.success(strategy === "copy" ? "Copia recibida" : "Dispositivos sincronizados");
      return;
    }

    if (packet.type === "done") {
      if (!isDeviceInfo(packet.device)) throw new Error("No se reconoce el dispositivo vinculado.");
      remember(packet.device);
      setConnected(true);
      setWorking(false);
      toast.success("Sincronización completada");
      return;
    }
    throw new Error("Se recibió una respuesta inesperada durante la sincronización.");
  };

  const bindConnection = (connection: DataConnection, packetRole: Role) => {
    connections.current.add(connection);
    connection.on("open", () => {
      setConnected(true);
      setWorking(false);
      if (packetRole === "join") {
        void (async () => {
          const snapshot = strategy === "copy" ? undefined : await createSyncSnapshot();
          await sendSyncPacket(connection, {
            type: "hello",
            strategy,
            device: localDevice,
            ...(snapshot ? { snapshot } : {}),
          });
        })().catch((error: unknown) =>
          toast.error(
            error instanceof Error ? error.message : "No se pudo iniciar la sincronización",
          ),
        );
      }
    });
    connection.on("data", (data) => {
      try {
        const packet = assembler.current.add(data);
        if (packet)
          void handlePacket(connection, packet, packetRole).catch((error: unknown) => {
            toast.error(error instanceof Error ? error.message : "No se pudo sincronizar");
            setWorking(false);
          });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Se recibió información no válida");
        setWorking(false);
      }
    });
    connection.on("error", (error) => {
      toast.error(`Error de conexión P2P: ${error.message}`);
      setWorking(false);
    });
    connection.on("close", () => {
      connections.current.delete(connection);
      setConnected(false);
    });
  };

  const startHost = () => {
    peerRef.current?.destroy();
    setHostCode("");
    setWorking(true);
    setConnected(false);
    const peer = new Peer(settings.peerId, peerOptions);
    peerRef.current = peer;
    peer.on("open", (id) => {
      setHostCode(id);
      setWorking(false);
      toast.success("Sesión P2P lista para vincular");
    });
    peer.on("connection", (connection) => bindConnection(connection, "host"));
    peer.on("error", (error) => {
      setWorking(false);
      toast.error(
        error.type === "unavailable-id"
          ? "Este ID ya está conectado en otro lugar. Cierra la otra sesión e inténtalo de nuevo."
          : `No se pudo iniciar la conexión: ${error.message}`,
      );
    });
  };

  const startJoin = () => {
    const code = joinCode
      .trim()
      .replace(/^.*[?&]meld-peer=/, "")
      .replace(/\/$/, "");
    if (!/^[\w-]{4,80}$/.test(code)) {
      toast.error("Introduce un código de dispositivo válido.");
      return;
    }
    setWorking(true);
    setConnected(false);
    const peer = new Peer(peerOptions);
    peerRef.current = peer;
    peer.on("open", () => {
      const connection = peer.connect(code, { reliable: true });
      bindConnection(connection, "join");
    });
    peer.on("error", (error) => {
      setWorking(false);
      toast.error(`No se pudo conectar: ${error.message}`);
    });
  };

  const close = () => {
    for (const connection of connections.current) connection.close();
    connections.current.clear();
    peerRef.current?.destroy();
    peerRef.current = null;
    setHostCode("");
    setConnected(false);
    setWorking(false);
    setOpen(false);
  };

  const copyLink = async () => {
    try {
      const link = `${window.location.origin}/ajustes?meld-peer=${encodeURIComponent(hostCode)}`;
      await navigator.clipboard.writeText(link);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const connectLinkedDevice = (device: LinkedDevice) => {
    setRole("join");
    setStrategy("merge");
    setJoinCode(device.peerId);
    setOpen(true);
    window.setTimeout(() => {
      setWorking(true);
      const peer = new Peer(peerOptions);
      peerRef.current = peer;
      peer.on("open", () =>
        bindConnection(peer.connect(device.peerId, { reliable: true }), "join"),
      );
      peer.on("error", (error) => {
        setWorking(false);
        toast.error(`No se pudo conectar: ${error.message}`);
      });
    }, 100);
  };

  return (
    <>
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Sincronizar dispositivos</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Vincula tu PC, móvil o portátil directamente.
            </p>
            <button
              type="button"
              onClick={() => {
                setRole("host");
                setOpen(true);
              }}
              className="mt-3 h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <span className="inline-flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Vincular dispositivo
              </span>
            </button>
          </div>
        </div>
      </div>
      {settings.linkedDevices.length > 0 && (
        <div className="space-y-1 px-2 pb-2">
          <h3 className="px-3 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dispositivos vinculados
          </h3>
          {settings.linkedDevices.map((device) => (
            <div key={device.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{device.name}</div>
                <div className="text-xs text-muted-foreground">
                  Última sincronización: {new Date(device.lastSyncedAt).toLocaleString("es-ES")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => connectLinkedDevice(device)}
                className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium"
              >
                Sincronizar ahora
              </button>
              <button
                type="button"
                aria-label={`Desvincular ${device.name}`}
                onClick={() => settings.removeLinkedDevice(device.id)}
                className="p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto rounded-3xl border-border/70 bg-background/90 backdrop-blur-2xl">
          <DialogTitle className="pr-8 text-2xl">Sincronizar dispositivos</DialogTitle>
          <DialogDescription>
            Vinculación directa mediante una conexión WebRTC cifrada.
          </DialogDescription>
          <div className="grid gap-6 py-2 md:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4">
              <label className="block text-sm font-medium">
                Nombre de este dispositivo
                <input
                  value={settings.deviceName}
                  maxLength={40}
                  onChange={(event) => settings.setDeviceName(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-2xl bg-muted px-3 outline-none"
                />
              </label>
              <div className="space-y-3">
                {[
                  "Abre Meld en tus dos dispositivos y conéctalos a internet.",
                  "En el dispositivo anfitrión, muestra el código QR; en el nuevo, escanéalo o copia el código.",
                  "Elige si copiar, sobrescribir el emisor o fusionar los datos.",
                ].map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRole("host")}
                  className={`h-10 flex-1 rounded-full text-sm font-medium ${role === "host" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Anfitrión
                </button>
                <button
                  type="button"
                  onClick={() => setRole("join")}
                  className={`h-10 flex-1 rounded-full text-sm font-medium ${role === "join" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  Unirme
                </button>
              </div>
              {role === "host" ? (
                <button
                  type="button"
                  disabled={working}
                  onClick={startHost}
                  className="h-10 w-full rounded-full bg-muted text-sm font-semibold disabled:opacity-50"
                >
                  {working
                    ? "Conectando…"
                    : hostCode
                      ? "Volver a mostrar código"
                      : "Generar código de vinculación"}
                </button>
              ) : (
                <>
                  <label className="block text-sm font-medium">
                    Código o enlace del anfitrión
                    <input
                      value={joinCode}
                      onChange={(event) => setJoinCode(event.target.value)}
                      placeholder="ID o enlace de invitación"
                      className="mt-1.5 h-10 w-full rounded-2xl bg-muted px-3 font-mono text-sm outline-none"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Estrategia de sincronización
                    <select
                      value={strategy}
                      onChange={(event) => setStrategy(event.target.value as SyncStrategy)}
                      className="mt-1.5 h-10 w-full rounded-2xl bg-muted px-3 outline-none"
                    >
                      <option value="copy">Copiar datos desde el dispositivo emisor</option>
                      <option value="overwrite">Sobrescribir datos del dispositivo emisor</option>
                      <option value="merge">Fusionar ambos dispositivos</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={working || !joinCode.trim()}
                    onClick={startJoin}
                    className="h-10 w-full rounded-full bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {working ? "Sincronizando…" : "Conectar y sincronizar"}
                  </button>
                </>
              )}
              {connected && (
                <p className="text-sm font-medium text-emerald-500">Conexión P2P activa.</p>
              )}
            </div>
            <div className="flex flex-col items-center justify-center rounded-3xl bg-muted/50 p-5 text-center">
              {role === "host" && hostCode ? (
                <>
                  <QRCodeSVG
                    value={`${window.location.origin}/ajustes?meld-peer=${encodeURIComponent(hostCode)}`}
                    size={192}
                    level="M"
                    includeMargin
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Escanea el QR o comparte el código
                  </p>
                  <code className="mt-2 break-all rounded-xl bg-background/70 px-3 py-2 text-sm">
                    {hostCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-background px-4 text-sm"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar enlace manual
                  </button>
                </>
              ) : (
                <div className="max-w-xs text-sm text-muted-foreground">
                  {role === "host"
                    ? "Genera un código para mostrar aquí el QR de vinculación."
                    : "Pide al anfitrión que genere el QR y escanéalo con la cámara del dispositivo."}
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">
              Requiere conexión a internet para conectar ambos dispositivos. Ningún dato pasa por
              ningún servidor: la transferencia viaja directamente de dispositivo a dispositivo de
              forma cifrada (Peer-to-Peer).
            </strong>
            <p className="mt-1">
              El servicio de señalización intercambia únicamente información temporal de conexión;
              la red STUN puede ver las direcciones IP públicas. El contenido se transmite por un
              canal WebRTC cifrado y no se almacena en esos servicios.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
