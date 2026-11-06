import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Pin, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassButton, GlassSegmented } from "@/components/glass/Glass";
import { db, newPage, type Page } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/paginas/")({
  head: () => ({
    meta: [
      { title: "Páginas · Meld" },
      { name: "description", content: "Tus notas y documentos en Meld, guardados en tu dispositivo." },
      { property: "og:title", content: "Páginas · Meld" },
      { property: "og:description", content: "Notas y documentos guardados en local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagesList,
});

const rel = (ms: number) => {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

const preview = (md: string) =>
  md
    .replace(/<[^>]+>/g, "")
    .replace(/[#*_`>\-[\]|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

function PagesList() {
  const pages = useLiveQuery(() => db.pages.toArray(), []);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "alpha">("recent");
  const [view, setView] = useState<"list" | "cards">("cards");
  const navigate = useNavigate();

  const list = useMemo(() => {
    const ql = q.toLowerCase();
    const filtered = (pages ?? []).filter((p) => !ql || p.title.toLowerCase().includes(ql) || p.markdown.toLowerCase().includes(ql));
    filtered.sort((a, b) =>
      b.pinned - a.pinned || (sort === "recent" ? b.updatedAt - a.updatedAt : (a.title || "￿").localeCompare(b.title || "￿", "es")),
    );
    return filtered;
  }, [pages, q, sort]);

  const create = async () => {
    const p = newPage();
    await db.pages.add(p);
    void navigate({ to: "/paginas/$pageId", params: { pageId: p.id } });
  };

  const togglePin = (p: Page) => db.pages.update(p.id, { pinned: p.pinned ? 0 : 1 });

  return (
    <div className="pb-safe min-h-dvh pb-28">
      <PageHeader
        primary={{ label: "Nueva página", onClick: () => void create() }}
        title="Páginas"
        subtitle={pages ? `${pages.length} ${pages.length === 1 ? "página" : "páginas"}` : " "}
        actions={
          <GlassButton size="md" aria-label={view === "cards" ? "Vista de lista" : "Vista de tarjetas"} onClick={() => setView((v) => (v === "cards" ? "list" : "cards"))}>
            {view === "cards" ? <List className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
          </GlassButton>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        <div className="glass flex items-center gap-2 rounded-2xl px-3">
          <Search className="relative z-10 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar páginas…"
            className="relative z-10 h-11 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <GlassSegmented
          layoutId="pages-sort"
          size="sm"
          value={sort}
          onChange={setSort}
          options={[
            { value: "recent", label: "Recientes" },
            { value: "alpha", label: "A–Z" },
          ]}
        />

        {pages === undefined ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="py-16 text-center">
            <div className="mb-2 text-4xl">📝</div>
            <p className="text-muted-foreground">{q ? "Nada coincide con tu búsqueda." : "Aún no tienes páginas."}</p>
          </motion.div>
        ) : (
          <motion.ul layout className={cn(view === "cards" ? "grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-2")}>
            <AnimatePresence>
              {list.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: Math.min(i, 10) * 0.03, type: "spring", stiffness: 380, damping: 30 }}
                  className="relative"
                >
                  <Link
                    to="/paginas/$pageId"
                    params={{ pageId: p.id }}
                    className={cn(
                      "glass block rounded-3xl p-3.5 transition-transform active:scale-[0.98]",
                      view === "cards" ? "h-36" : "flex items-center gap-3",
                    )}
                  >
                    <div className={cn("relative z-10", view === "list" && "flex min-w-0 flex-1 items-center gap-3")}>
                      <div className={cn("text-2xl", view === "cards" && "mb-1.5")}>{p.icon}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate pr-6 text-[15px] font-semibold">{p.title || "Sin título"}</div>
                        {view === "cards" ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{preview(p.markdown) || "Vacía"}</p>
                        ) : (
                          <p className="truncate text-xs text-muted-foreground">{rel(p.updatedAt)}</p>
                        )}
                      </div>
                    </div>
                    {view === "cards" && <div className="relative z-10 mt-1 text-[11px] text-muted-foreground">{rel(p.updatedAt)}</div>}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void togglePin(p)}
                    aria-label={p.pinned ? "Desfijar" : "Fijar"}
                    className={cn("absolute right-2.5 top-2.5 z-20 rounded-full p-1.5", p.pinned ? "text-coral" : "text-muted-foreground/50")}
                  >
                    <Pin className="h-3.5 w-3.5" fill={p.pinned ? "currentColor" : "none"} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <div className="pb-safe app-col fixed inset-x-0 bottom-0 z-30 flex lg:hidden justify-end px-5 pb-5">
        <GlassButton aria-label="Nueva página" onClick={() => void create()} className="glass-strong">
          <Plus className="h-7 w-7" />
        </GlassButton>
      </div>
    </div>
  );
}
