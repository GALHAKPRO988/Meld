import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, SlidersHorizontal } from "lucide-react";
import { GlassPill } from "@/components/glass/Glass";
import { PageHeader } from "@/components/PageHeader";
import { GlassButton, GlassSegmented } from "@/components/glass/Glass";
import { TaskRow } from "@/components/tasks/TaskRow";
import { QuickAddSheet, TaskEditSheet } from "@/components/tasks/TaskSheets";
import { db, type Task } from "@/lib/db";
import { EMPTY_FILTER, applyTaskFilter, filterTasks, isFilterActive, persistOrder, sortTasks, toggleTask, type TaskFilter, type TaskSort, type TaskView } from "@/lib/tasks";

export const Route = createFileRoute("/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas · Meld" },
      { name: "description", content: "Tus tareas de hoy, próximas y completadas en Meld." },
      { property: "og:title", content: "Tareas · Meld" },
      { property: "og:description", content: "Gestiona tus tareas en local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TasksScreen,
});

const EMPTY: Record<TaskView, string> = {
  hoy: "Nada para hoy. Disfruta ☀️",
  proximas: "Sin tareas programadas.",
  todas: "Añade tu primera tarea con +",
  completadas: "Aún no has completado nada.",
};

function TasksScreen() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const [view, setView] = useState<TaskView>("hoy");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<TaskSort>("manual");
  const [showFilters, setShowFilters] = useState(false);
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const folders = useLiveQuery(() => db.folders.toArray(), []) ?? [];
  const list = useMemo(() => (tasks ? sortTasks(applyTaskFilter(filterTasks(tasks, view), filter), sort) : []), [tasks, view, filter, sort]);
  const todayProgress = useMemo(() => {
    if (!tasks) return { total: 0, done: 0, percent: 0 };
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const s = startOfDay.getTime();
    const e = endOfDay.getTime();

    const pendingToday = tasks.filter((t) => t.status !== "done" && t.due !== null && t.due <= e);
    const doneToday = tasks.filter((t) => t.status === "done" && t.completedAt && t.completedAt >= s && t.completedAt <= e);

    const total = pendingToday.length + doneToday.length;
    const done = doneToday.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, percent };
  }, [tasks]);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    void persistOrder(next);
  };
  const toggleIn = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const todayCount = useMemo(() => (tasks ? filterTasks(tasks, "hoy").length : 0), [tasks]);

  const onToggle = async (t: Task) => {
    const undo = await toggleTask(t);
    if (t.status !== "done") toast("Tarea completada", { action: { label: "Deshacer", onClick: () => void undo() } });
  };
  const onDelete = async (t: Task) => {
    await db.tasks.delete(t.id);
    toast("Tarea eliminada", { action: { label: "Deshacer", onClick: () => void db.tasks.put(t) } });
  };

  return (
    <div className="pb-safe min-h-dvh pb-28">
      <PageHeader
        primary={{ label: "Nueva tarea", onClick: () => setAdding(true) }}
        title="Tareas"
        subtitle={`${todayCount} para hoy`}
        actions={
          <GlassButton size="md" aria-label="Filtros y orden" className={showFilters || isFilterActive(filter) ? "text-coral" : undefined} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-5 w-5" />
          </GlassButton>
        }
      />
      <div className="no-scrollbar overflow-x-auto px-4 pb-3">
        <GlassSegmented
          layoutId="task-view"
          value={view}
          onChange={setView}
          options={[
            { value: "hoy", label: "Hoy" },
            { value: "proximas", label: "Próximas" },
            { value: "todas", label: "Todas" },
            { value: "completadas", label: "Completadas" },
          ]}
        />
      </div>

      {view === "hoy" && todayProgress.total > 0 && (
        <div className="mx-4 mb-3 rounded-2xl border border-white/10 bg-surface/30 p-3 backdrop-blur-md">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Progreso del día</span>
            <span className="text-foreground">
              {todayProgress.done} de {todayProgress.total} completadas ({todayProgress.percent}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-coral to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${todayProgress.percent}%` }}
              transition={{ type: "spring", stiffness: 180, damping: 20 }}
            />
          </div>
        </div>
      )}

      {showFilters && (
        <div className="flex flex-col gap-2 px-4 pb-3 text-sm">
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-muted-foreground">Orden</span>
            {(["manual", "fecha", "prioridad"] as TaskSort[]).map((o) => (
              <GlassPill key={o} active={sort === o} onClick={() => setSort(o)}>
                {o === "manual" ? "Manual" : o === "fecha" ? "Fecha" : "Prioridad"}
              </GlassPill>
            ))}
          </div>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-muted-foreground">Prioridad</span>
            {([1, 2, 3, 4] as Task["priority"][]).map((p) => (
              <GlassPill key={p} active={filter.priorities.includes(p)} onClick={() => setFilter({ ...filter, priorities: toggleIn(filter.priorities, p) })}>
                P{p}
              </GlassPill>
            ))}
          </div>
          {tags.length > 0 && (
            <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-muted-foreground">Tags</span>
              {tags.map((t) => (
                <GlassPill key={t.id} active={filter.tagIds.includes(t.id)} onClick={() => setFilter({ ...filter, tagIds: toggleIn(filter.tagIds, t.id) })}>
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} /> {t.name}
                </GlassPill>
              ))}
            </div>
          )}
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <span className="shrink-0 text-muted-foreground">Carpeta</span>
            <GlassPill active={filter.folderId === null} onClick={() => setFilter({ ...filter, folderId: null })}>Todas</GlassPill>
            <GlassPill active={filter.folderId === "none"} onClick={() => setFilter({ ...filter, folderId: "none" })}>Sin carpeta</GlassPill>
            {folders.map((f) => (
              <GlassPill key={f.id} active={filter.folderId === f.id} onClick={() => setFilter({ ...filter, folderId: f.id })}>{f.name}</GlassPill>
            ))}
          </div>
          {isFilterActive(filter) && (
            <button className="self-start text-coral" onClick={() => setFilter(EMPTY_FILTER)}>Quitar filtros</button>
          )}
        </div>
      )}

      <div className="px-4">
        {tasks === undefined ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {list.length === 0 ? (
              <motion.p key={`empty-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16 text-center text-muted-foreground">
                {EMPTY[view]}
              </motion.p>
            ) : (
              <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2">
                <AnimatePresence>
                  {list.map((t, i) => (
                    <div key={t.id} className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <ul>
                          <TaskRow task={t} index={i} onToggle={() => void onToggle(t)} onDelete={() => void onDelete(t)} onOpen={() => setEditing(t)} />
                        </ul>
                      </div>
                      {sort === "manual" && showFilters && (
                        <div className="flex shrink-0 flex-col">
                          <button aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                          <button aria-label="Bajar" disabled={i === list.length - 1} onClick={() => move(i, 1)} className="p-1 text-muted-foreground disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        {list.length > 0 && <p className="mt-4 text-center text-xs text-muted-foreground">Desliza → para completar, ← para eliminar</p>}
      </div>

      <div className="pb-safe app-col fixed inset-x-0 bottom-0 z-30 flex lg:hidden justify-end px-5 pb-5">
        <GlassButton aria-label="Nueva tarea" onClick={() => setAdding(true)} className="glass-strong">
          <Plus className="h-7 w-7" />
        </GlassButton>
      </div>

      <QuickAddSheet open={adding} onClose={() => setAdding(false)} defaultToday={view === "hoy"} />
      <TaskEditSheet task={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
