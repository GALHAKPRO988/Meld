import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, Search } from "lucide-react";
import { SECTION_ICONS } from "@/components/AccessList";
import { SECTION_LABELS, SECTION_ORDER, type SectionId } from "@/lib/settings";

export const SECTION_ROUTES: Record<SectionId, "/calendario" | "/paginas" | "/tareas" | "/carpetas" | "/tags" | "/diario"> = {
  calendario: "/calendario",
  paginas: "/paginas",
  tareas: "/tareas",
  carpetas: "/carpetas",
  tags: "/tags",
  diario: "/diario",
};

/** Main menu that melts out of the top-left button. */
export function MainMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setQ("");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="bg-scrim fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.nav
            aria-label="Menú principal"
            initial={{ opacity: 0, scale: 0.18, borderRadius: 40, filter: "blur(12px)" }}
            animate={{ opacity: 1, scale: 1, borderRadius: 30, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.2, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            style={{ transformOrigin: "32px 32px" }}
            className="glass glass-solid glass-refract absolute lg:hidden left-[17px] top-[calc(env(safe-area-inset-top)+10px)] z-50 w-[calc(100%-34px)] max-w-[396px] p-3"
          >
            <div className="relative z-10">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onClose();
                  void navigate({ to: "/buscar", search: { q } });
                }}
                className="mb-3 flex items-center gap-2 rounded-2xl bg-muted px-3"
              >
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar en todo…"
                  aria-label="Búsqueda global"
                  className="h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
              </form>
              <div className="grid grid-cols-3 gap-2">
                {SECTION_ORDER.map((s, i) => {
                  const Icon = SECTION_ICONS[s];
                  return (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.05 + i * 0.035, type: "spring", stiffness: 400, damping: 28 }}
                    >
                      <Link
                        to={SECTION_ROUTES[s]}
                        onClick={onClose}
                        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl bg-muted text-[13px] font-medium transition-transform active:scale-95"
                      >
                        <Icon className="h-6 w-6" strokeWidth={1.7} />
                        {SECTION_LABELS[s]}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
              <Link
                to="/"
                onClick={onClose}
                className="mt-2 flex items-center justify-center gap-2 rounded-2xl py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageCircle className="h-4 w-4" /> Volver al chat
              </Link>
            </div>
          </motion.nav>
        </>
      )}
    </AnimatePresence>
  );
}
