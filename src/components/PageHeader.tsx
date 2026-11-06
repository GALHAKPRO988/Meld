import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { GlassButton, GlassPill } from "@/components/glass/Glass";
import { OverlapSquaresIcon } from "@/components/icons";
import { MainMenu } from "@/components/MainMenu";

type Primary = { label: string; onClick: () => void };

/**
 * Header for section screens. Mobile: menu button row + large title below (primary action is a floating button).
 * Desktop (lg+): title and actions share one toolbar row and the primary action appears as a labelled button.
 */
export function PageHeader({ title, actions, subtitle, primary }: { title: string; subtitle?: ReactNode; actions?: ReactNode; primary?: Primary }) {
  const [menu, setMenu] = useState(false);
  return (
    <>
      <header className="pt-safe sticky top-0 z-30 px-[17px] lg:px-8">
        <div className="flex items-center justify-between gap-3 pt-[10px] lg:pt-6">
          <GlassButton size="md" aria-label="Abrir menú" className="lg:hidden" onClick={() => setMenu(true)}>
            <OverlapSquaresIcon size={20} />
          </GlassButton>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="hidden min-w-0 lg:block">
            <h1 className="truncate text-[30px] font-bold leading-tight tracking-tight">{title}</h1>
            {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
          </motion.div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {primary && (
              <GlassPill className="glass-strong hidden h-11 rounded-full px-4 font-medium lg:inline-flex" onClick={primary.onClick}>
                <Plus className="h-4 w-4" /> {primary.label}
              </GlassPill>
            )}
          </div>
        </div>
      </header>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-3 pt-4 lg:hidden">
        <h1 className="text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
      </motion.div>
      <div className="hidden h-4 lg:block" />
      <MainMenu open={menu} onClose={() => setMenu(false)} />
    </>
  );
}
