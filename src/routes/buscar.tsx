import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { BookHeart, CalendarDays, CheckSquare, FileText, Search, Tag } from "lucide-react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { db } from "@/lib/db";
import { useSettings } from "@/lib/settings";

export const Route = createFileRoute("/buscar")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Buscar · Meld" },
      { name: "description", content: "Búsqueda instantánea en páginas, tareas, eventos, tags y diario." },
      { property: "og:title", content: "Buscar · Meld" },
      { property: "og:description", content: "Búsqueda global en Meld." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchScreen,
});

function Group({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="mb-1.5 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </h2>
      <div className="glass rounded-3xl p-1.5">
        <div className="relative z-10 flex flex-col">{children}</div>
      </div>
    </motion.section>
  );
}

const rowCls = "block truncate rounded-2xl px-3 py-2.5 text-[15px] hover:bg-muted";

function SearchScreen() {
  const { q: initial } = Route.useSearch();
  const [q, setQ] = useState(initial ?? "");
  const journalEnabled = useSettings((s) => s.journalEnabled);
  const query = q.trim().toLowerCase();

  const results = useLiveQuery(async () => {
    if (!query) return null;
    const has = (s: string) => s.toLowerCase().includes(query);
    const [pages, tasks, events, tags, journal] = await Promise.all([
      db.pages.toArray(),
      db.tasks.toArray(),
      db.events.toArray(),
      db.tags.toArray(),
      journalEnabled ? db.journal.toArray() : Promise.resolve([]),
    ]);
    return {
      pages: pages.filter((p) => has(p.title) || has(p.markdown)).slice(0, 10),
      tasks: tasks.filter((t) => has(t.title) || has(t.notes)).slice(0, 10),
      events: events.filter((e) => has(e.title) || has(e.description)).slice(0, 10),
      tags: tags.filter((t) => has(t.name)).slice(0, 10),
      journal: journal.filter((j) => has(j.markdown)).slice(0, 10),
    };
  }, [query, journalEnabled]);

  const empty = results && Object.values(results).every((r) => r.length === 0);

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader title="Buscar" />
      <div className="px-4">
        <div className="glass mb-5 flex items-center gap-2 rounded-2xl px-3">
          <Search className="relative z-10 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca en todo…"
            className="relative z-10 h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-col gap-5">
          {results?.pages.length ? (
            <Group title="Páginas" icon={<FileText className="h-3.5 w-3.5" />}>
              {results.pages.map((p) => (
                <Link key={p.id} to="/paginas/$pageId" params={{ pageId: p.id }} className={rowCls}>
                  {p.icon} {p.title || "Sin título"}
                </Link>
              ))}
            </Group>
          ) : null}
          {results?.tasks.length ? (
            <Group title="Tareas" icon={<CheckSquare className="h-3.5 w-3.5" />}>
              {results.tasks.map((t) => (
                <Link key={t.id} to="/tareas" className={rowCls}>
                  {t.status === "done" ? "✓ " : ""}
                  {t.title}
                </Link>
              ))}
            </Group>
          ) : null}
          {results?.events.length ? (
            <Group title="Eventos" icon={<CalendarDays className="h-3.5 w-3.5" />}>
              {results.events.map((e) => (
                <Link key={e.id} to="/calendario" className={rowCls}>
                  {e.title} · {new Date(e.start).toLocaleDateString("es-ES")}
                </Link>
              ))}
            </Group>
          ) : null}
          {results?.tags.length ? (
            <Group title="Tags" icon={<Tag className="h-3.5 w-3.5" />}>
              {results.tags.map((t) => (
                <Link key={t.id} to="/tags" className={rowCls}>
                  #{t.name}
                </Link>
              ))}
            </Group>
          ) : null}
          {results?.journal.length ? (
            <Group title="Diario" icon={<BookHeart className="h-3.5 w-3.5" />}>
              {results.journal.map((j) => (
                <Link key={j.id} to="/diario" className={rowCls}>
                  {j.id}
                </Link>
              ))}
            </Group>
          ) : null}
          {empty && <p className="py-10 text-center text-muted-foreground">Sin resultados para “{q}”.</p>}
        </div>
      </div>
    </div>
  );
}
