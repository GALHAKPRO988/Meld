import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, KeyRound, Square } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useChat } from "@/lib/ai/chat-store";
import { PROVIDERS } from "@/lib/ai/providers";
import { useSettings } from "@/lib/settings";
import { spring } from "@/components/glass/Glass";

export function Composer() {
  const [value, setValue] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const send = useChat((s) => s.send);
  const stop = useChat((s) => s.stop);
  const status = useChat((s) => s.status);
  const provider = useSettings((s) => s.provider);
  const hasKey = useSettings((s) => !!s.apiKeys[s.provider]);
  const busy = status !== "idle";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(() => {
    if (hasKey) setNeedsKey(false);
  }, [hasKey]);

  useEffect(() => {
    if (status === "idle" && ref.current && document.activeElement?.tagName !== "INPUT") ref.current.focus({ preventScroll: true });
  }, [status]);

  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    if (!hasKey) {
      setNeedsKey(true);
      return;
    }
    setValue("");
    void send(text);
  };

  return (
    <div className="relative">
      <AnimatePresence>
        {needsKey && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.9, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={spring}
            className="glass glass-strong glass-refract absolute bottom-full left-0 right-0 mb-3 flex items-center gap-3 rounded-3xl p-3"
          >
            <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-coral/20 text-coral">
              <KeyRound className="h-4 w-4" />
            </span>
            <div className="relative z-10 min-w-0 flex-1">
              <div className="text-sm font-semibold">Conecta tu IA</div>
              <div className="text-xs text-muted-foreground">Añade tu clave de {PROVIDERS[provider].label}. Se guarda solo en este dispositivo.</div>
            </div>
            <Link
              to="/ajustes"
              className="relative z-10 shrink-0 rounded-full bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground"
            >
              Configurar
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass glass-tint glass-refract flex min-h-16 items-end rounded-[32px]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Pregunta a la IA..."
          aria-label="Pregunta a la IA"
          enterKeyHint="send"
          className="no-scrollbar relative z-10 max-h-40 flex-1 resize-none self-center bg-transparent py-[21px] pl-[14px] pr-2 text-[15px] leading-[22px] text-foreground outline-none placeholder:text-foreground/85"
        />
        <AnimatePresence>
          {(value.trim() || busy) && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 0.9 }}
              transition={spring}
              onClick={busy ? stop : submit}
              aria-label={busy ? "Detener" : "Enviar"}
              className="relative z-10 m-[10px] grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              {busy ? <Square className="h-4 w-4" fill="currentColor" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.4} />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
