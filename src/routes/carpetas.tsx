import type React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, FolderInput, FolderPlus, LayoutGrid, ListTree, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassButton, GlassSheet } from "@/components/glass/Glass";
import { FolderTreeSheet } from "@/components/FolderPicker";
import { IconPicker } from "@/components/IconPicker";
import { DRAG_MIME, PageItem, SectionTitle, TaskItem } from "@/components/ItemRows";
import { TaskEditSheet } from "@/components/tasks/TaskSheets";
import { db, uid, type Folder, type Id, type Task } from "@/lib/db";
import { childrenOf, deleteFolder, descendantIds, flattenTree, folderPath, moveFolder } from "@/lib/folders";
import { cn } from "@/lib/utils";

interface FolderSearch {
  id?: string;
}

export const Route = createFileRoute("/carpetas")({
  validateSearch: (s: Record<string, unknown>): FolderSearch => (typeof s["id"] === "string" && s["id"] ? { id: s["id"] } : {}),
  head: () => ({
    meta: [
      { title: "Carpetas · Meld" },
      { name: "description", content: "Organiza páginas y tareas en carpetas anidadas en Meld." },
      { property: "og:title", content: "Carpetas · Meld" },
      { property: "og:description", content: "Carpetas anidadas con páginas y tareas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Folders,
});

type Moving = { kind: "page" | "task" | "folder"; id: Id; current: Id | null } | null;

function Folders() {
  const { id } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [tree, setTree] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<Id>>(new Set());
  const [creating, setCreating] = useState(false);
  const [options, setOptions] = useState(false);
  const [moving, setMoving] = useState<Moving>(null);
  const [editing, setEditing] = useState<Task | null>(null);

  const data = useLiveQuery(async () => {
    const [folders, pages, tasks] = await Promise.all([db.folders.toArray(), db.pages.toArray(), db.tasks.toArray()]);
    return { folders, pages, tasks };
  }, []);

  const folders = data?.folders ?? [];
  const current = id ? folders.find((f) => f.id === id) : undefined;
  const currentId = current?.id ?? null;
  const path = folderPath(folders, currentId);

  const counts = useMemo(() => {
    const m = new Map<Id | null, number>();
    for (const x of [...(data?.pages ?? []), ...(data?.tasks ?? [])]) m.set(x.folderId, (m.get(x.folderId) ?? 0) + 1);
    for (const f of folders) if (f.parentId) m.set(f.parentId, (m.get(f.parentId) ?? 0) + 1);
    return m;
  }, [data, folders]);

  const subfolders = childrenOf(folders, currentId);
  const pages = (data?.pages ?? []).filter((p) => p.folderId === currentId).sort((a, b) => b.updatedAt - a.updatedAt);
  const tasks = (data?.tasks ?? []).filter((t) => t.folderId === currentId).sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.order - b.order);
  const open = (fid: Id | null) => void navigate({ search: fid ? { id: fid } : {} });

  const doMove = async (target: Id | null) => {
    if (!moving) return;
    try {
      if (moving.kind === "folder") await moveFolder(moving.id, target);
      else if (moving.kind === "page") await db.pages.update(moving.id, { folderId: target, updatedAt: Date.now() });
      else await db.tasks.update(moving.id, { folderId: target, updatedAt: Date.now() });
      const name = target ? folders.find((f) => f.id === target)?.name : "Sin carpeta";
      toast(`Movido a ${name}`, { action: { label: "Deshacer", onClick: () => void undoMove(moving) } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo mover");
    }
  };
  const undoMove = async (m: NonNullable<Moving>) => {
    if (m.kind === "folder") await db.folders.update(m.id, { parentId: m.current });
    else if (m.kind === "page") await db.pages.update(m.id, { folderId: m.current });
    else await db.tasks.update(m.id, { folderId: m.current });
  };

  const [over, setOver] = useState<Id | null>(null);
  const dropProps = (target: Id) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (over !== target) setOver(target);
    },
    onDragLeave: () => setOver((o) => (o === target ? null : o)),
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      const [kind, itemId] = e.dataTransfer.getData(DRAG_MIME).split(":") as ["page" | "task", Id];
      if (!itemId) return;
      const m = { kind, id: itemId, current: currentId } as NonNullable<Moving>;
      if (kind === "page") await db.pages.update(itemId, { folderId: target, updatedAt: Date.now() });
      else await db.tasks.update(itemId, { folderId: target, updatedAt: Date.now() });
      toast(`Movido a ${folders.find((f) => f.id === target)?.name ?? "carpeta"}`, { action: { label: "Deshacer", onClick: () => void undoMove(m) } });
    },
  });

  const moveBtn = (kind: "page" | "task", itemId: Id) => (
    <button type="button" aria-label="Mover a otra carpeta" onClick={() => setMoving({ kind, id: itemId, current: currentId })} className="p-1.5 text-muted-foreground">
      <FolderInput className="h-4 w-4" />
    </button>
  );

  if (id && data && !current)
    return (
      <div className="min-h-dvh">
        <PageHeader title="Carpetas" />
        <div className="px-6 py-16 text-center">
          <p className="mb-4 text-muted-foreground">Esta carpeta ya no existe.</p>
          <button type="button" onClick={() => open(null)} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Ver carpetas
          </button>
        </div>
      </div>
    );

  return (
    <div className="min-h-dvh pb-16">
      <PageHeader
        title={current ? `${current.icon} ${current.name}` : "Carpetas"}
        subtitle={
          current ? (
            <nav className="flex flex-wrap items-center gap-1" aria-label="Ruta de carpetas">
              <Link to="/carpetas" className="hover:text-foreground">
                Carpetas
              </Link>
              {path.slice(0, -1).map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <Link to="/carpetas" search={{ id: f.id }} className="hover:text-foreground">
                    {f.name}
                  </Link>
                </span>
              ))}
            </nav>
          ) : (
            `${folders.length} ${folders.length === 1 ? "carpeta" : "carpetas"}`
          )
        }
        actions={
          <>
            {!current && (
              <GlassButton size="md" aria-label={tree ? "Vista de cuadrícula" : "Vista de árbol"} onClick={() => setTree((v) => !v)}>
                {tree ? <LayoutGrid className="h-5 w-5" /> : <ListTree className="h-5 w-5" />}
              </GlassButton>
            )}
            {current && (
              <GlassButton size="md" aria-label="Opciones de carpeta" onClick={() => setOptions(true)}>
                <MoreHorizontal className="h-5 w-5" />
              </GlassButton>
            )}
            <GlassButton size="md" aria-label={current ? "Nueva subcarpeta" : "Nueva carpeta"} onClick={() => setCreating(true)}>
              <FolderPlus className="h-5 w-5" />
            </GlassButton>
          </>
        }
      />

      <div className="px-4">
        {tree && !current ? (
          <ul className="glass flex flex-col rounded-3xl p-1.5">
            {flattenTree(folders, collapsed).map(({ folder, depth, hasChildren }) => (
              <li key={folder.id} {...dropProps(folder.id)} className={cn("relative z-10 flex items-center rounded-2xl", over === folder.id && "bg-primary/15 ring-1 ring-primary/50")} style={{ paddingLeft: depth * 18 }}>
                <button
                  type="button"
                  aria-label={collapsed.has(folder.id) ? "Expandir" : "Contraer"}
                  onClick={() =>
                    setCollapsed((s) => {
                      const n = new Set(s);
                      if (n.has(folder.id)) n.delete(folder.id);
                      else n.add(folder.id);
                      return n;
                    })
                  }
                  className={cn("grid h-9 w-7 place-items-center text-muted-foreground", !hasChildren && "invisible")}
                >
                  <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed.has(folder.id) && "rotate-90")} />
                </button>
                <button type="button" onClick={() => open(folder.id)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl px-2 py-2 text-left hover:bg-muted">
                  <span className="text-lg">{folder.icon}</span>
                  <span className="flex-1 truncate text-[15px]">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">{counts.get(folder.id) ?? 0}</span>
                </button>
              </li>
            ))}
            {folders.length === 0 && <li className="relative z-10 py-8 text-center text-sm text-muted-foreground">Aún no hay carpetas.</li>}
          </ul>
        ) : (
          <>
            {subfolders.length > 0 && (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {subfolders.map((f, i) => (
                    <motion.li
                      key={f.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: i * 0.03 }}
                      className="relative"
                      {...dropProps(f.id)}
                    >
                      <button
                        type="button"
                        onClick={() => open(f.id)}
                        className={cn(
                          "glass block w-full rounded-3xl p-4 text-left transition-all active:scale-[0.97]",
                          over === f.id && "scale-[1.03] ring-2 ring-primary/60 shadow-[0_0_32px_-4px_var(--primary)]",
                        )}
                      >
                        <div className="relative z-10">
                          <div className="mb-2 text-3xl">{f.icon}</div>
                          <div className="truncate pr-6 font-semibold">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {counts.get(f.id) ?? 0} {(counts.get(f.id) ?? 0) === 1 ? "elemento" : "elementos"}
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Mover ${f.name}`}
                        onClick={() => setMoving({ kind: "folder", id: f.id, current: f.parentId })}
                        className="absolute right-2.5 top-2.5 z-20 rounded-full p-1.5 text-muted-foreground"
                      >
                        <FolderInput className="h-4 w-4" />
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}

            {!current && (pages.length > 0 || tasks.length > 0) && <SectionTitle>Sin carpeta</SectionTitle>}
            {pages.length > 0 && (
              <>
                {current && <SectionTitle>Páginas</SectionTitle>}
                <ul className="flex flex-col gap-2">
                  <AnimatePresence>
                    {pages.map((p, i) => (
                      <PageItem key={p.id} page={p} index={i} action={moveBtn("page", p.id)} dragData={`page:${p.id}`} />
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            )}
            {tasks.length > 0 && (
              <>
                {current ? <SectionTitle>Tareas</SectionTitle> : <div className="h-2" />}
                <ul className="flex flex-col gap-2">
                  <AnimatePresence>
                    {tasks.map((t, i) => (
                      <TaskItem key={t.id} task={t} index={i} onOpen={() => setEditing(t)} action={moveBtn("task", t.id)} dragData={`task:${t.id}`} />
                    ))}
                  </AnimatePresence>
                </ul>
              </>
            )}
            {data && subfolders.length === 0 && pages.length === 0 && tasks.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-16 text-center">
                <div className="mb-2 text-4xl">🗂️</div>
                <p className="text-muted-foreground">{current ? "Carpeta vacía. Mueve aquí páginas o tareas." : "Crea tu primera carpeta con el botón de arriba."}</p>
              </motion.div>
            )}
          </>
        )}
      </div>

      <FolderSheet open={creating} onClose={() => setCreating(false)} parentId={currentId} />
      {current && (
        <FolderOptions
          folder={current}
          open={options}
          onClose={() => setOptions(false)}
          onMove={() => setMoving({ kind: "folder", id: current.id, current: current.parentId })}
          onDeleted={() => open(current.parentId)}
        />
      )}
      <FolderTreeSheet
        open={moving !== null}
        onClose={() => setMoving(null)}
        value={moving?.current ?? null}
        onPick={(target) => void doMove(target)}
        rootLabel={moving?.kind === "folder" ? "Carpetas (raíz)" : "Sin carpeta"}
        disabled={moving?.kind === "folder" ? new Set([moving.id, ...descendantIds(folders, moving.id)]) : new Set()}
      />
      <TaskEditSheet task={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function FolderSheet({ open, onClose, parentId }: { open: boolean; onClose: () => void; parentId: Id | null }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📁");
  return (
    <GlassSheet open={open} onClose={onClose} title={parentId ? "Nueva subcarpeta" : "Nueva carpeta"}>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          await db.folders.add({ id: uid(), name: name.trim(), icon, color: "oklch(0.72 0.15 40)", parentId, createdAt: Date.now() });
          setName("");
          setIcon("📁");
          onClose();
        }}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-muted text-2xl">{icon}</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la carpeta" className="h-11 flex-1 rounded-2xl bg-muted px-3.5 text-[15px] outline-none" />
        </div>
        <IconPicker value={icon} onPick={setIcon} />
        <button type="submit" disabled={!name.trim()} className="h-12 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-40">
          Crear
        </button>
      </form>
    </GlassSheet>
  );
}

function FolderOptions({ folder, open, onClose, onMove, onDeleted }: { folder: Folder; open: boolean; onClose: () => void; onMove: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(folder.name);
  const [confirm, setConfirm] = useState(false);
  const rename = async () => {
    const clean = name.trim();
    if (clean && clean !== folder.name) await db.folders.update(folder.id, { name: clean });
    else setName(folder.name);
  };
  return (
    <GlassSheet
      open={open}
      onClose={() => {
        void rename();
        setConfirm(false);
        onClose();
      }}
      title="Carpeta"
    >
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-2xl bg-muted px-3.5">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <input aria-label="Nombre" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => void rename()} className="h-11 flex-1 bg-transparent text-[15px] outline-none" />
        </label>
        <IconPicker value={folder.icon} onPick={(icon) => void db.folders.update(folder.id, { icon })} />
        <button
          type="button"
          onClick={() => {
            onClose();
            onMove();
          }}
          className="flex h-11 items-center gap-2 rounded-2xl bg-muted px-3.5 text-[15px]"
        >
          <FolderInput className="h-4 w-4" /> Mover a otra carpeta
        </button>
        {confirm ? (
          <div className="flex flex-col gap-2 rounded-2xl bg-destructive/10 p-3">
            <p className="text-sm">Se eliminará la carpeta. Su contenido pasará a la carpeta superior.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirm(false)} className="h-10 flex-1 rounded-xl bg-muted text-sm font-medium">
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const undo = await deleteFolder(folder.id);
                  onClose();
                  onDeleted();
                  toast("Carpeta eliminada", { action: { label: "Deshacer", onClick: () => void undo() } });
                }}
                className="h-10 flex-1 rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirm(true)} className="flex h-11 items-center gap-2 rounded-2xl px-3.5 text-[15px] text-destructive hover:bg-destructive/10">
            <Trash2 className="h-4 w-4" /> Eliminar carpeta
          </button>
        )}
      </div>
    </GlassSheet>
  );
}
