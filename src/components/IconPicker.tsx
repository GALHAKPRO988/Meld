import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  {
    name: "Trabajo y Estudio",
    icons: [
      "📁",
      "💼",
      "📚",
      "💻",
      "📊",
      "🎓",
      "📝",
      "🗂️",
      "📎",
      "📌",
      "📈",
      "🔬",
      "📐",
      "📖",
      "🗃️",
    ],
  },
  {
    name: "Metas y Proyectos",
    icons: ["🎯", "🚀", "⭐", "🔥", "🏆", "💡", "⚡", "🛠️", "🧭", "🏁", "🥇", "🎖️", "🔮", "🗝️"],
  },
  {
    name: "Vida y Hogar",
    icons: [
      "🏠",
      "🍳",
      "🛒",
      "☕",
      "🌱",
      "🐾",
      "🛋️",
      "🧹",
      "🪴",
      "📦",
      "🔑",
      "🚗",
      "🚲",
      "🍕",
      "🍎",
    ],
  },
  {
    name: "Celebración y Regalos",
    icons: ["🎁", "🎉", "🎈", "🎂", "🍾", "🎊", "🎀", "💌", "💐", "🎪", "🎟️"],
  },
  {
    name: "Salud y Deporte",
    icons: ["💪", "🧘", "🏃", "🚴", "🥗", "❤️", "🥑", "🧗", "⚽", "🥊", "🏊", "🏋️", "🎾", "🩺"],
  },
  {
    name: "Ocio y Creatividad",
    icons: ["🎨", "🎵", "📷", "🎮", "✈️", "🎬", "🎸", "🎲", "🏖️", "🏕️", "🎧", "🎤", "🕹️", "🎭"],
  },
  {
    name: "Símbolos y Clima",
    icons: ["✨", "💎", "🏷️", "💬", "🧩", "🔔", "⏳", "📅", "☀️", "🌙", "⚡", "🌧️", "🌈", "🔒"],
  },
] as const;

const COLS = 6;
const ROWS = 3;
const PER_PAGE = COLS * ROWS;
/** Every category split into pages of exactly 3 rows. */
const PAGES = CATEGORIES.flatMap((c) => {
  const icons = [...new Set(c.icons as readonly string[])];
  const n = Math.ceil(icons.length / PER_PAGE);
  return Array.from({ length: n }, (_, k) => ({ name: c.name, icons: icons.slice(k * PER_PAGE, (k + 1) * PER_PAGE) }));
});

export function IconPicker({
  value,
  onPick,
  className,
}: {
  value: string;
  onPick: (icon: string) => void;
  className?: string;
}) {
  const [page, setPage] = useState(() => Math.max(0, PAGES.findIndex((p) => p.icons.includes(value))));
  const cur = PAGES[page] ?? PAGES[0]!;
  const go = (d: number) => setPage((p) => (p + d + PAGES.length) % PAGES.length);
  const navBtn = "glass grid h-8 w-8 shrink-0 place-items-center rounded-full";
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Iconos anteriores" onClick={() => go(-1)} className={navBtn}>
          <ChevronLeft className="relative z-10 h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-medium">{cur.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {page + 1} / {PAGES.length}
          </div>
        </div>
        <button type="button" aria-label="Más iconos" onClick={() => go(1)} className={navBtn}>
          <ChevronRight className="relative z-10 h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-6 grid-rows-3 gap-1" aria-label={cur.name}>
        {Array.from({ length: PER_PAGE }, (_, i) => cur.icons[i]).map((icon, i) =>
          icon ? (
            <button
              key={icon}
              type="button"
              onClick={() => onPick(icon)}
              aria-label={`Seleccionar ${icon}`}
              aria-pressed={value === icon}
              className={cn(
                "grid h-11 place-items-center rounded-xl text-xl transition-colors",
                value === icon ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-muted",
              )}
            >
              {icon}
            </button>
          ) : (
            <span key={`e${i}`} className="h-11" />
          ),
        )}
      </div>
    </div>
  );
}
