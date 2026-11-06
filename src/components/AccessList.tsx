import { motion } from "framer-motion";
import { BookHeart, CalendarDays, CheckSquare, FileText, Folder, Tag, type LucideIcon } from "lucide-react";
import { GlassSegmented, GlassSwitch } from "@/components/glass/Glass";
import { SECTION_LABELS, SECTION_ORDER, useSettings, type AccessMap, type SectionId, type SectionAccess } from "@/lib/settings";
import { cn } from "@/lib/utils";

export const SECTION_ICONS: Record<SectionId, LucideIcon> = {
  calendario: CalendarDays,
  paginas: FileText,
  tareas: CheckSquare,
  carpetas: Folder,
  tags: Tag,
  diario: BookHeart,
};

/** Per-section AI access switches. Edits live access by default, or the defaults when `target="defaults"`. */
export function AccessList({ target = "live" }: { target?: "live" | "defaults" }) {
  const journalEnabled = useSettings((s) => s.journalEnabled);
  const access: AccessMap = useSettings((s) => (target === "live" ? s.access : s.defaultAccess));
  const setAccess = useSettings((s) => (target === "live" ? s.setAccess : s.setDefaultAccess));
  const sections = SECTION_ORDER.filter((s) => s !== "diario" || journalEnabled);

  return (
    <ul className="flex flex-col">
      {sections.map((s, i) => {
        const Icon = SECTION_ICONS[s];
        const a: SectionAccess = access[s];
        return (
          <motion.li
            key={s}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.035 }}
            className="flex items-center gap-3 rounded-2xl px-3 py-2"
          >
            <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-colors", a.enabled ? "text-foreground" : "text-muted-foreground")} />
            <div className="min-w-0 flex-1">
              <div className={cn("text-[15px] font-medium transition-colors", !a.enabled && "text-muted-foreground")}>{SECTION_LABELS[s]}</div>
              <motion.div
                initial={false}
                animate={{ height: a.enabled ? "auto" : 0, opacity: a.enabled ? 1 : 0 }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <GlassSegmented
                    size="sm"
                    layoutId={`mode-${target}-${s}`}
                    value={a.mode}
                    onChange={(mode) => setAccess(s, { mode })}
                    options={[
                      { value: "read", label: "Solo lectura" },
                      { value: "write", label: "Lectura y escritura" },
                    ]}
                  />
                </div>
              </motion.div>
            </div>
            <GlassSwitch checked={a.enabled} onChange={(enabled) => setAccess(s, { enabled })} label={`Acceso a ${SECTION_LABELS[s]}`} />
          </motion.li>
        );
      })}
    </ul>
  );
}
