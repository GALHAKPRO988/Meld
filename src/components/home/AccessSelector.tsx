import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { GlassDropdown, GlassPill } from "@/components/glass/Glass";
import { WrenchIcon } from "@/components/icons";
import { AccessList } from "@/components/AccessList";

export function AccessSelector({ placement }: { placement: "top" | "bottom" }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <GlassPill aria-label="Acceso de la IA" aria-expanded={open} active={open} onClick={() => setOpen((o) => !o)} className="pl-2.5">
        <span className="grid h-7 w-7 place-items-center">
          <WrenchIcon size={22} />
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}>
          <ChevronDown className="h-5 w-5" strokeWidth={1.8} />
        </motion.span>
      </GlassPill>
      <GlassDropdown open={open} onClose={() => setOpen(false)} placement={placement} align="center" className="w-[320px]">
        <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Acceso de la IA</p>
        <AccessList />
      </GlassDropdown>
    </div>
  );
}
