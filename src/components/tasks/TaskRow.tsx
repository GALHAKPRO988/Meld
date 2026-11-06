import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { CalendarClock, Check, ListTree, Pin, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { MouseEvent } from "react";
import { TaskCheckbox } from "./TaskCheckbox";
import { db, type Tag, type Task } from "@/lib/db";
import { formatDue } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export const PRIO_COLOR: Record<Task["priority"], string> = {
  1: "var(--prio-1)",
  2: "var(--prio-2)",
  3: "var(--prio-3)",
  4: "var(--prio-4)",
};

export function TaskRow({
  task,
  onToggle,
  onDelete,
  onOpen,
  index,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onOpen: () => void;
  index: number;
}) {
  const x = useMotionValue(0);
  const leftBg = useTransform(x, [0, 90], [0, 1]);
  const rightBg = useTransform(x, [-90, 0], [1, 0]);
  const tags = useLiveQuery(async (): Promise<(Tag | undefined)[]> => (task.tagIds.length ? db.tags.bulkGet(task.tagIds) : []), [task.tagIds.join(",")]) ?? [];
  const done = task.status === "done";
  const due = formatDue(task);
  const overdue = !done && task.due !== null && task.due < Date.now() && (task.hasTime || new Date(task.due).toDateString() !== new Date().toDateString());
  const subDone = task.subtasks.filter((s) => s.done).length;
  const togglePinned = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await db.tasks.update(task.id, { pinned: !task.pinned, updatedAt: Date.now() });
      toast(task.pinned ? "Tarea desfijada" : "Tarea fijada arriba 📌");
    } catch {
      toast.error("No se pudo cambiar la fijación de la tarea.");
    }
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, height: 0, marginTop: 0, transition: { duration: 0.25 } }}
      transition={{ delay: Math.min(index, 12) * 0.025, type: "spring", stiffness: 400, damping: 32 }}
      className="relative overflow-hidden rounded-3xl"
    >
      <motion.div style={{ opacity: leftBg }} className="absolute inset-0 flex items-center rounded-3xl bg-success/25 pl-5 text-success">
        <Check className="h-5 w-5" strokeWidth={2.6} />
      </motion.div>
      <motion.div style={{ opacity: rightBg }} className="absolute inset-0 flex items-center justify-end rounded-3xl bg-destructive/25 pr-5 text-destructive">
        <Trash2 className="h-5 w-5" />
      </motion.div>
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.5}
        style={{ x }}
        onDragEnd={(_, info) => {
          if (info.offset.x > 90) onToggle();
          else if (info.offset.x < -90) onDelete();
          void animate(x, 0, { type: "spring", stiffness: 500, damping: 35 });
        }}
        onClick={onOpen}
        className="glass group relative flex cursor-pointer items-start gap-3 rounded-3xl px-3.5 py-3"
      >
        <div className="relative z-10 pt-px">
          <TaskCheckbox checked={done} onToggle={onToggle} color={PRIO_COLOR[task.priority]} label={`Completar ${task.title}`} />
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <div className="relative inline-block max-w-full">
            <span className={cn("flex items-center gap-1.5 truncate text-[15px] transition-colors duration-300", done && "text-muted-foreground")}>
              <span className="truncate">{task.title}</span>
              {task.pinned && (
                <button
                  type="button"
                  aria-label="Desfijar tarea"
                  title="Desfijar tarea"
                  onClick={(event) => void togglePinned(event)}
                  className="shrink-0"
                >
                  <Pin className="h-3 w-3 fill-coral/30 text-coral" />
                </button>
              )}
              {!task.pinned && (
                <button
                  type="button"
                  aria-label="Fijar tarea arriba"
                  title="Fijar tarea arriba"
                  onClick={(event) => void togglePinned(event)}
                  className="shrink-0 text-muted-foreground/60 transition-colors hover:text-coral"
                >
                  <Pin className="h-3 w-3" />
                </button>
              )}
            </span>
            <motion.span
              className="absolute left-0 top-1/2 h-[1.5px] bg-muted-foreground"
              initial={false}
              animate={{ width: done ? "100%" : "0%" }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          {(due || tags.length > 0 || task.subtasks.length > 0 || task.repeat !== "none") && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
              {due && (
                <span className={cn("inline-flex items-center gap-1", overdue && "text-destructive")}>
                  <CalendarClock className="h-3 w-3" />
                  {due}
                </span>
              )}
              {task.repeat !== "none" && <Repeat className="h-3 w-3" />}
              {task.subtasks.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ListTree className="h-3 w-3" />
                  {subDone}/{task.subtasks.length}
                </span>
              )}
              {tags.map(
                (t) =>
                  t && (
                    <span key={t.id} className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </span>
                  ),
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.li>
  );
}
