import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { DragEvent, ReactNode } from "react";
import { CalendarDays, CalendarClock } from "lucide-react";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { PRIO_COLOR } from "@/components/tasks/TaskRow";
import type { CalendarEvent, Page, Task } from "@/lib/db";
import { formatDue, toggleTask } from "@/lib/tasks";
import { fmtTime } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>;
}

const rowCls = "glass rounded-3xl";
const innerCls = "flex items-center gap-3 px-3.5 py-3";
export const DRAG_MIME = "application/x-meld-item";

/** Native drag source wrapper (motion.li reserves its own drag props). */
function Drag({ data, children }: { data?: string | undefined; children: ReactNode }) {
  const onDragStart = (e: DragEvent) => {
    if (!data) return;
    e.dataTransfer.setData(DRAG_MIME, data);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div draggable={!!data} onDragStart={onDragStart} className={cn(innerCls, data && "cursor-grab active:cursor-grabbing")}>
      {children}
    </div>
  );
}

export function PageItem({ page, index = 0, action, dragData }: { page: Page; index?: number; action?: ReactNode; dragData?: string }) {
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className={rowCls}>
      <Drag data={dragData}>
      <Link to="/paginas/$pageId" params={{ pageId: page.id }} className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
        <span className="text-xl">{page.icon}</span>
        <span className="truncate text-[15px] font-medium">{page.title || "Sin título"}</span>
      </Link>
      {action && <div className="relative z-10">{action}</div>}
      </Drag>
    </motion.li>
  );
}

export function TaskItem({ task, index = 0, onOpen, action, dragData }: { task: Task; index?: number; onOpen?: () => void; action?: ReactNode; dragData?: string }) {
  const done = task.status === "done";
  const due = formatDue(task);
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className={rowCls}>
      <Drag data={dragData}>
      <div className="relative z-10">
        <TaskCheckbox checked={done} onToggle={() => void toggleTask(task)} color={PRIO_COLOR[task.priority]} label={`Completar ${task.title}`} />
      </div>
      <button type="button" onClick={onOpen} className="relative z-10 min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[15px]", done && "text-muted-foreground line-through")}>{task.title}</span>
        {due && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3" /> {due}
          </span>
        )}
      </button>
      {action && <div className="relative z-10">{action}</div>}
      </Drag>
    </motion.li>
  );
}

export function EventItem({ event, index = 0 }: { event: CalendarEvent; index?: number }) {
  const date = new Date(event.start).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return (
    <motion.li layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.025 }} className={cn(rowCls, innerCls)}>
      <Link to="/calendario" className="relative z-10 flex min-w-0 flex-1 items-center gap-3">
        <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: event.color }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{event.title || "Sin título"}</span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> {date}
            {!event.allDay && ` · ${fmtTime(event.start)}`}
          </span>
        </span>
      </Link>
    </motion.li>
  );
}
