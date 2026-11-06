import { useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { GlassDropdown, GlassPill, GlassSegmented } from "@/components/glass/Glass";
import { ProviderLogo } from "@/components/icons";
import { PROVIDERS, PROVIDER_ORDER, type ProviderId } from "@/lib/ai/providers";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function AiSelector({ placement }: { placement: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  const provider = useSettings((s) => s.provider);
  const models = useSettings((s) => s.models);
  const apiKeys = useSettings((s) => s.apiKeys);
  const setProvider = useSettings((s) => s.setProvider);
  const setModel = useSettings((s) => s.setModel);
  const [viewing, setViewing] = useState<ProviderId>(provider);

  const info = PROVIDERS[viewing];
  const selectedModel = models[viewing];
  const customModel = !info.models.some((m) => m.id === selectedModel) ? selectedModel : null;

  return (
    <div>
      <GlassPill
        aria-label="Elegir IA"
        aria-expanded={open}
        active={open}
        onClick={() => {
          setViewing(provider);
          setOpen((o) => !o);
        }}
        className="overflow-hidden pl-1.5"
      >
        <span className="relative grid h-7 w-8 place-items-center">
          {provider === "anthropic" && (
            <span className="absolute inset-[-6px] rounded-full bg-coral/25 blur-md" aria-hidden />
          )}
          <motion.span key={provider} initial={{ scale: 0.4, rotate: -40, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} className="relative">
            <ProviderLogo provider={provider} size={26} />
          </motion.span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5" strokeWidth={1.8} />
        </motion.span>
      </GlassPill>

      <GlassDropdown open={open} onClose={() => setOpen(false)} placement={placement} align="center">
        <div className="no-scrollbar overflow-x-auto px-1 pb-2 pt-1">
          <GlassSegmented
            layoutId="provider-tab"
            size="sm"
            value={viewing}
            onChange={setViewing}
            options={PROVIDER_ORDER.map((p) => ({ value: p, label: PROVIDERS[p].label }))}
          />
        </div>
        <div className="flex flex-col">
          {[...info.models, ...(customModel ? [{ id: customModel, label: customModel }] : [])].map((m, i) => {
            const selected = provider === viewing && models[viewing] === m.id;
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  setProvider(viewing);
                  setModel(viewing, m.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-[15px] transition-colors",
                  selected ? "bg-accent" : "hover:bg-muted",
                )}
              >
                <ProviderLogo provider={viewing} size={20} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.id}</span>
                </span>
                {selected && <Check className="h-4 w-4 shrink-0 text-coral" />}
              </motion.button>
            );
          })}
        </div>
        {!apiKeys[viewing] && (
          <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">Sin clave de {info.label}. Añádela en Ajustes.</p>
        )}
      </GlassDropdown>
    </div>
  );
}
