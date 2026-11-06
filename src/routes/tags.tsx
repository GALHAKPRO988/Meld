import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Merge, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassButton, GlassSheet } from "@/components/glass/Glass";
import { EventItem, PageItem, SectionTitle, TaskItem } from "@/components/ItemRows";
import { TaskEditSheet } from "@/components/tasks/TaskSheets";
import { db, ensureTag, TAG_COLORS, type Tag, type Task } from "@/lib/db";
import { mergeTags, removeTag } from "@/lib/tags";
import { cn } from "@/lib/utils";

interface TagSearch {
  tag?: string;
}

export const Route = createFileRoute("/tags")({
  validateSearch: (s: Record<string, unknown>): TagSearch => (typeof s["tag"] === "string" && s["tag"] ? { tag: s["tag"] } : {}),
  head: () => ({
    meta: [
      { title: "Tags · Meld" },
      { name: "description", content: "Crea, fusiona y filtra tus tags en Meld." },
      { property: "og:title", content: "Tags · Meld" },
      { property: "og:description", content: "Gestión y filtrado de tags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TagsRoute,
});

function TagsRoute() {
  const { tag } = Route.useSearch();
  return tag ? <TagDetail tagId={tag} /> : <TagsScreen />;
}

function TagRow({ tag, uses, onMerge }: { tag: Tag; uses: number; onMerge: () => void }) {
  const [name, setName] = useState(tag.name);
  const [picking, setPicking] = useState(false);
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="glass rounded-3xl px-3 py-2.5">
      <div className="relative z-10 flex items-center gap-2.5">
        <button type="button" aria-label="Cambiar color" onClick={() => setPicking((v) => !v)} className="h-6 w-6 shrink-0 rounded-full" style={{ background: tag.color }} />
        <span className="text-muted-foreground">#</span>
        <input
          aria-label="Nombre del tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={async () => {
            const clean = name.trim().replace(/^#/, "");
            if (!clean || clean === tag.name) return setName(tag.name);
            try {
              await db.tags.update(tag.id, { name: clean });
            } catch {
              toast.error("Ya existe un tag con ese nombre. Usa Fusionar para unirlos.");
              setName(tag.name);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none"
        />
        <button type="button" aria-label={`Fusionar ${tag.name}`} onClick={onMerge} className="p-1 text-muted-foreground">
          <Merge className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Eliminar tag" onClick={() => void removeTag(tag)} className="p-1 text-muted-foreground">
          <Trash2 className="h-4 w-4" />
        </button>
        <Link to="/tags" search={{ tag: tag.id }} aria-label={`Ver contenido de ${tag.name}`} className="flex items-center gap-0.5 rounded-full bg-muted py-1 pl-2.5 pr-1.5 text-xs text-muted-foreground">
          {uses}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <AnimatePresence>
        {picking && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="relative z-10 overflow-hidden">
            <div className="flex gap-2 pt-2.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label="Color"
                  onClick={() => {
                    void db.tags.update(tag.id, { color: c });
                    setPicking(false);
                  }}
                  className={cn("h-7 w-7 rounded-full", tag.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                  style={{ background: c }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function TagsScreen() {
  const data = useLiveQuery(async () => {
    const [tags, pages, tasks, events] = await Promise.all([db.tags.toArray(), db.pages.toArray(), db.tasks.toArray(), db.events.toArray()]);
    const all = [...pages, ...tasks, ...events];
    return tags.sort((a, b) => a.name.localeCompare(b.name, "es")).map((t) => ({ tag: t, uses: all.filter((x) => x.tagIds.includes(t.id)).length }));
  }, []);
  const [name, setName] = useState("");
  const [merging, setMerging] = useState<Tag | null>(null);

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader title="Tags" subtitle={data ? `${data.length} tags` : " "} />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await ensureTag(name);
          setName("");
        }}
        className="mx-4 mb-3 flex gap-2"
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nuevo tag…" className="h-11 flex-1 rounded-2xl bg-muted px-3.5 text-[15px] outline-none placeholder:text-muted-foreground" />
        <button type="submit" aria-label="Crear tag" className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </form>
      <ul className="flex flex-col gap-2 px-4">
        <AnimatePresence>
          {(data ?? []).map(({ tag, uses }) => (
            <TagRow key={tag.id} tag={tag} uses={uses} onMerge={() => setMerging(tag)} />
          ))}
        </AnimatePresence>
      </ul>
      {data?.length === 0 && <p className="py-12 text-center text-muted-foreground">Crea tags aquí o escribiendo #tag en cualquier sitio.</p>}

      <GlassSheet open={merging !== null} onClose={() => setMerging(null)} title={merging ? `Fusionar #${merging.name} con…` : "Fusionar"}>
        <p className="mb-3 text-sm text-muted-foreground">Todo lo que tenga #{merging?.name} pasará al tag que elijas, y #{merging?.name} desaparecerá.</p>
        <div className="flex max-h-[45vh] flex-col overflow-y-auto">
          {(data ?? [])
            .filter(({ tag }) => tag.id !== merging?.id)
            .map(({ tag, uses }) => (
              <button
                key={tag.id}
                type="button"
                onClick={async () => {
                  if (!merging) return;
                  const src = merging;
                  await mergeTags(src.id, tag.id);
                  setMerging(null);
                  toast(`#${src.name} fusionado con #${tag.name}`);
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-muted"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: tag.color }} />
                <span className="flex-1 text-[15px]">#{tag.name}</span>
                <span className="text-xs text-muted-foreground">{uses}</span>
              </button>
            ))}
          {(data ?? []).length < 2 && <p className="py-6 text-center text-sm text-muted-foreground">Necesitas al menos otro tag.</p>}
        </div>
      </GlassSheet>
    </div>
  );
}

function TagDetail({ tagId }: { tagId: string }) {
  const [editing, setEditing] = useState<Task | null>(null);
  const data = useLiveQuery(async () => {
    const tag = await db.tags.get(tagId);
    if (!tag) return { tag: null };
    const [pages, tasks, events] = await Promise.all([
      db.pages.where("tagIds").equals(tagId).toArray(),
      db.tasks.where("tagIds").equals(tagId).toArray(),
      db.events.where("tagIds").equals(tagId).toArray(),
    ]);
    return {
      tag,
      pages: pages.sort((a, b) => b.updatedAt - a.updatedAt),
      tasks: tasks.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.order - b.order),
      events: events.sort((a, b) => b.start - a.start),
    };
  }, [tagId]);

  const back = (
    <Link to="/tags" aria-label="Volver a tags">
      <GlassButton size="md" tabIndex={-1}>
        <ArrowLeft className="h-5 w-5" />
      </GlassButton>
    </Link>
  );

  if (data && !data.tag)
    return (
      <div className="min-h-dvh">
        <PageHeader title="Tags" actions={back} />
        <p className="px-6 py-16 text-center text-muted-foreground">Este tag ya no existe.</p>
      </div>
    );

  const total = data?.tag ? data.pages.length + data.tasks.length + data.events.length : 0;

  return (
    <div className="min-h-dvh pb-16">
      <PageHeader
        title={data?.tag ? `#${data.tag.name}` : " "}
        subtitle={
          data?.tag && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: data.tag.color }} />
              {total} {total === 1 ? "elemento" : "elementos"}
            </span>
          )
        }
        actions={back}
      />
      {data?.tag && (
        <div className="px-4">
          {data.pages.length > 0 && (
            <>
              <SectionTitle>Páginas</SectionTitle>
              <ul className="flex flex-col gap-2">
                {data.pages.map((p, i) => (
                  <PageItem key={p.id} page={p} index={i} />
                ))}
              </ul>
            </>
          )}
          {data.tasks.length > 0 && (
            <>
              <SectionTitle>Tareas</SectionTitle>
              <ul className="flex flex-col gap-2">
                {data.tasks.map((t, i) => (
                  <TaskItem key={t.id} task={t} index={i} onOpen={() => setEditing(t)} />
                ))}
              </ul>
            </>
          )}
          {data.events.length > 0 && (
            <>
              <SectionTitle>Eventos</SectionTitle>
              <ul className="flex flex-col gap-2">
                {data.events.map((e, i) => (
                  <EventItem key={e.id} event={e} index={i} />
                ))}
              </ul>
            </>
          )}
          {total === 0 && <p className="py-16 text-center text-muted-foreground">Nada usa este tag todavía.</p>}
        </div>
      )}
      <TaskEditSheet task={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
