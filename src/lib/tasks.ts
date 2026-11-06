import { db, newTask, type Repeat, type Task } from "./db";
import { fireConfetti } from "./confetti";
import { haptic } from "./haptics";
import { toast } from "sonner";

export function nextDue(due: number, repeat: Repeat, everyDays = 1): number {
  const d = new Date(due);
  if (repeat === "daily") d.setDate(d.getDate() + 1);
  else if (repeat === "weekly") d.setDate(d.getDate() + 7);
  else if (repeat === "monthly") {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  } else if (repeat === "custom") d.setDate(d.getDate() + Math.max(1, everyDays));
  return d.getTime();
}

export type TaskView = "hoy" | "proximas" | "todas" | "completadas";

export function filterTasks(tasks: Task[], view: TaskView, now = new Date()): Task[] {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const e = end.getTime();
  const list = tasks.filter((t) => {
    if (view === "completadas") return t.status === "done";
    if (t.status === "done") return false;
    if (view === "hoy") return t.due !== null && t.due <= e;
    if (view === "proximas") return t.due !== null && t.due > e;
    return true;
  });
  if (view === "completadas") return list.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
  return list.sort((a, b) => a.order - b.order);
}

/** Completes a task; repeating tasks spawn their next occurrence. Returns an undo function. */
export async function toggleTask(task: Task): Promise<() => Promise<void>> {
  const done = task.status !== "done";
  await db.tasks.update(task.id, { status: done ? "done" : "todo", completedAt: done ? Date.now() : null, updatedAt: Date.now() });
  if (done && typeof window !== "undefined") haptic(15);

  let spawned: string | null = null;
  if (done && task.repeat !== "none" && task.due) {
    const { id: _id, ...rest } = task;
    const created = newTask({
      ...rest,
      status: "todo",
      completedAt: null,
      due: nextDue(task.due, task.repeat, task.repeatEveryDays),
      subtasks: task.subtasks.map((s) => ({ ...s, done: false })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await db.tasks.add(created);
    spawned = created.id;
  }

  if (done && typeof window !== "undefined" && task.due !== null) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setHours(23, 59, 59, 999);
    if (task.due >= startOfDay.getTime() && task.due <= endOfDay.getTime()) {
      const todayTasks = await db.tasks.where("due").between(startOfDay.getTime(), endOfDay.getTime(), true, true).toArray();
      if (todayTasks.length > 0 && todayTasks.every((todayTask) => todayTask.status === "done")) {
        fireConfetti();
        toast("¡Todas las tareas de hoy completadas! 🎉", { duration: 3500 });
      }
    }
  }

  return async () => {
    await db.tasks.put(task);
    if (spawned) await db.tasks.delete(spawned);
  };
}

export const PRIORITY_LABELS: Record<Task["priority"], string> = {
  1: "Urgente",
  2: "Alta",
  3: "Media",
  4: "Sin prioridad",
};

export function formatDue(t: Pick<Task, "due" | "hasTime">, now = new Date()): string | null {
  if (!t.due) return null;
  const d = new Date(t.due);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 864e5);
  const label =
    diff === 0
      ? "Hoy"
      : diff === 1
        ? "Mañana"
        : diff === -1
          ? "Ayer"
          : diff > 1 && diff < 7
            ? d.toLocaleDateString("es-ES", { weekday: "long" })
            : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const time = t.hasTime ? ` ${d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "";
  return label.charAt(0).toUpperCase() + label.slice(1) + time;
}

export interface TaskFilter {
  tagIds: string[];
  /** null = any folder, "none" = tasks without a folder */
  folderId: string | "none" | null;
  priorities: Task["priority"][];
}

export const EMPTY_FILTER: TaskFilter = { tagIds: [], folderId: null, priorities: [] };

export const isFilterActive = (f: TaskFilter) => f.tagIds.length > 0 || f.folderId !== null || f.priorities.length > 0;

/** Keeps tasks that have every selected tag, are in the chosen folder and match one of the chosen priorities. */
export function applyTaskFilter(tasks: Task[], f: TaskFilter): Task[] {
  return tasks.filter(
    (t) =>
      f.tagIds.every((id) => t.tagIds.includes(id)) &&
      (f.folderId === null || (f.folderId === "none" ? t.folderId === null : t.folderId === f.folderId)) &&
      (f.priorities.length === 0 || f.priorities.includes(t.priority)),
  );
}

export type TaskSort = "manual" | "fecha" | "prioridad";

export function sortTasks(list: Task[], sort: TaskSort): Task[] {
  return [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if (sort === "fecha") return (a.due ?? Infinity) - (b.due ?? Infinity);
    if (sort === "prioridad") return a.priority - b.priority;
    return a.order - b.order;
  });
}

/**
 * After a drag, reuse the order values the visible tasks already had (sorted) in the new sequence,
 * so tasks hidden by the current view/filter keep their relative position.
 */
export function reassignOrder(next: Pick<Task, "id" | "order">[]): { id: string; order: number }[] {
  const slots = next.map((t) => t.order).sort((a, b) => a - b);
  for (let i = 1; i < slots.length; i++) if (slots[i]! <= slots[i - 1]!) slots[i] = slots[i - 1]! + 1;
  return next.map((t, i) => ({ id: t.id, order: slots[i]! }));
}

export async function persistOrder(next: Pick<Task, "id" | "order">[]) {
  const changes = reassignOrder(next).filter((c, i) => c.order !== next[i]!.order);
  if (changes.length) await db.tasks.bulkUpdate(changes.map((c) => ({ key: c.id, changes: { order: c.order } })));
}
