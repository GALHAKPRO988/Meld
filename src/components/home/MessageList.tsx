import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, Check, Copy, Loader2, RotateCw, RotateCcw, Sparkle, X } from "lucide-react";
import { toast } from "sonner";
import { useChat, type ChatMessage } from "@/lib/ai/chat-store";
import { ProviderLogo } from "@/components/icons";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

function ActionCard({ actionId }: { actionId: string }) {
  const action = useChat((s) => s.actions[actionId]);
  const undo = useChat((s) => s.undo);
  if (!action) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="glass glass-refract my-1.5 flex items-center gap-3 rounded-2xl p-3"
    >
      <span
        className={cn(
          "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full",
          action.undone ? "bg-muted text-muted-foreground" : "bg-success/20 text-success",
        )}
      >
        {action.undone ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={2.6} />}
      </span>
      <div className="relative z-10 min-w-0 flex-1">
        <div className={cn("text-sm font-semibold", action.undone && "line-through opacity-60")}>{action.title}</div>
        <div className="truncate text-xs text-muted-foreground">{action.detail}</div>
      </div>
      <motion.button
        whileTap={{ scale: 0.94 }}
        disabled={action.undone}
        onClick={() => void undo(actionId)}
        className="relative z-10 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
      >
        {action.undone ? "Deshecho" : "Deshacer"}
      </motion.button>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2" aria-label="La IA está escribiendo">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function Message({ m, isLast }: { m: ChatMessage; isLast: boolean }) {
  const status = useChat((s) => s.status);
  const reload = useChat((s) => s.reload);
  const provider = useSettings((s) => s.provider);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantText = m.parts
    .filter((part): part is Extract<ChatMessage["parts"][number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  if (m.role === "user") {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="flex justify-end"
      >
        <div className="max-w-[85%] whitespace-pre-wrap rounded-[22px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] text-primary-foreground">
          {text}
        </div>
      </motion.div>
    );
  }
  const waiting = isLast && status !== "idle" && m.parts.length === 0 && !m.error;
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2.5">
      <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center">
        <ProviderLogo provider={provider} size={20} />
      </div>
      <div className="min-w-0 flex-1">
        {waiting && <TypingDots />}
        {m.parts.map((p, i) => {
          if (p.type === "text")
            return (
              <div key={i} className="prose-meld">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.text}</ReactMarkdown>
              </div>
            );
          if (p.type === "tool")
            return (
              <div key={p.id} className="my-1.5 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {p.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : p.status === "done" ? (
                  <Sparkle className="h-3 w-3 text-coral" />
                ) : (
                  <X className="h-3 w-3 text-destructive" />
                )}
                {p.label}
              </div>
            );
          return <ActionCard key={p.actionId} actionId={p.actionId} />;
        })}
        {m.error && (
          <div className="mt-1 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{m.error}</span>
          </div>
        )}
        {assistantText && status === "idle" && (
          <div className="mt-2 flex items-center gap-1">
            <motion.button
              type="button"
              title="Copiar texto"
              aria-label="Copiar texto"
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                void (async () => {
                  try {
                    await navigator.clipboard.writeText(assistantText);
                    setCopied(true);
                    if (copyTimer.current) clearTimeout(copyTimer.current);
                    copyTimer.current = setTimeout(() => setCopied(false), 1500);
                    toast.success("Copiado al portapapeles");
                  } catch (error) {
                    console.error("No se pudo copiar la respuesta.", error);
                    toast.error("No se pudo copiar el texto.");
                  }
                })();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </motion.button>
            {isLast && (
              <motion.button
                type="button"
                title="Regenerar respuesta"
                aria-label="Regenerar respuesta"
                whileTap={{ scale: 0.9 }}
                onClick={() => void reload()}
                className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                <RotateCw className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function MessageList() {
  const messages = useChat((s) => s.messages);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4 pt-28">
      <div className="flex flex-col gap-5">
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <Message key={m.id} m={m} isLast={i === messages.length - 1} />
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  );
}
