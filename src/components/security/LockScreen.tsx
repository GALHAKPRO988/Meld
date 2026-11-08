import { Fingerprint, Delete } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings";
import { authenticateBiometric, verifyPin } from "@/lib/security";

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const settings = useSettings();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  const vibrate = () => {
    if ("vibrate" in navigator) navigator.vibrate(12);
  };

  const submit = async (value: string) => {
    if (value.length !== 4 || busy) return;
    setBusy(true);
    try {
      if (settings.pinHash && (await verifyPin(value, settings.pinHash))) {
        setPin("");
        onUnlock();
      } else {
        setPin("");
        setShake((current) => current + 1);
        vibrate();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo verificar el PIN");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (value: string) => {
    vibrate();
    const next = `${pin}${value}`.slice(0, 4);
    setPin(next);
    if (next.length === 4) void submit(next);
  };

  const biometric = async () => {
    if (!settings.biometricCredentialId || busy) return;
    setBusy(true);
    try {
      if (await authenticateBiometric(settings.biometricCredentialId)) onUnlock();
      else toast.error("La verificación biométrica no coincide.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo verificar la biometría");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-background/80 px-5 py-8 backdrop-blur-2xl">
      <motion.div
        key={shake}
        initial={shake ? { x: 0 } : false}
        animate={shake ? { x: [0, -12, 12, -8, 8, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
        className="glass-strong relative z-10 w-full max-w-sm rounded-[2rem] p-6 text-center shadow-2xl"
      >
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-semibold">Meld está bloqueado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Introduce tu PIN para continuar</p>
        <div
          className="my-6 flex justify-center gap-3"
          aria-label={`${pin.length} de 4 dígitos introducidos`}
        >
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-3 w-3 rounded-full border border-foreground/30 ${pin.length > index ? "bg-foreground" : "bg-transparent"}`}
            />
          ))}
        </div>
        <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, "biometric", 0, "delete"].map((key) => {
            if (key === "biometric" && !settings.biometricEnabled)
              return <span key={String(key)} />;
            return (
              <button
                key={String(key)}
                type="button"
                disabled={busy}
                aria-label={
                  key === "delete"
                    ? "Borrar último dígito"
                    : key === "biometric"
                      ? "Desbloquear con biometría"
                      : `Dígito ${key}`
                }
                onClick={() =>
                  key === "biometric"
                    ? void biometric()
                    : key === "delete"
                      ? (vibrate(), setPin((current) => current.slice(0, -1)))
                      : press(String(key))
                }
                className={`glass grid aspect-square place-items-center rounded-full text-xl font-medium transition-transform active:scale-90 disabled:opacity-50 ${key === "biometric" ? "text-primary" : ""}`}
              >
                <span className="relative z-10">
                  {key === "biometric" ? (
                    <Fingerprint className="h-6 w-6" />
                  ) : key === "delete" ? (
                    <Delete className="h-5 w-5" />
                  ) : (
                    key
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
