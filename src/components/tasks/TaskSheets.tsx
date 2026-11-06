import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, CalendarClock, Flag, Hash, Plus, Trash2, X } from "lucide-react";
import { GlassSegmented, GlassSheet } from "@/components/glass/Glass";
import { TagPicker } from "@/components/TagPicker";
import { FolderPicker } from "@/components/FolderPicker";
import { TaskCheckbox } from "./TaskCheckbox";
import { PRIO_COLOR } from "./TaskRow";
import { db, ensureTag, newTask, uid, type Priority, type Repeat, type Task } from "@/lib/db";
import { parseQuickTask } from "@/lib/nlp";
import { formatDue, PRIORITY_LABELS } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function QuickAddSheet({ open, onClose, defaultToday }: { open: boolean; onClose: () => void; defaultToday?: boolean }) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuickTask(text), [text]);
  useEffect(() => {
    if (!open) setText("");
  }, [open]);

  const submit = async () => {
    if (!parsed.title) return;
    const tagIds = await Promise.all(parsed.tags.map(async (t) => (await ensureTag(t)).id));
    let due = parsed.due;
    if (!due && defaultToday) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      due = d.getTime();
    }
    await db.tasks.add(newTask({ title: parsed.title, due, hasTime: parsed.hasTime, tagIds, priority: parsed.priority ?? 4 }));
    setText("");
  };

  return (
    <GlassSheet open={open} onClose={onClose} title="Nueva tarea">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex items-center gap-2 rounded-2xl bg-muted pr-1.5"
      >
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="comprar pan mañana a las 10 #casa"
          enterKeyHint="done"
          className="h-12 min-w-0 flex-1 bg-transparent px-3.5 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <motion.button
          whileTap={{ scale: 0.9 }}
          type="submit"
          disabled={!parsed.title}
          aria-label="Añadir tarea"
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </motion.button>
      </form>
      <div className="mt-3 flex min-h-7 flex-wrap gap-1.5 text-xs">
        {parsed.due && (
          <motion.span initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-full bg-coral/15 px-2.5 py-1 font-medium text-coral">
            <CalendarClock className="h-3 w-3" /> {formatDue(parsed)}
          </motion.span>
        )}
        {parsed.tags.map((t) => (
          <motion.span key={t} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium">
            <Hash className="h-3 w-3" />
            {t}
          </motion.span>
        ))}
        {parsed.priority && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium" style={{ color: PRIO_COLOR[parsed.priority] }}>
            <Flag className="h-3 w-3" /> {PRIORITY_LABELS[parsed.priority]}
          </span>
        )}
        {!parsed.due && !parsed.tags.length && !parsed.priority && (
          <span className="text-muted-foreground">Prueba “mañana”, “el viernes a las 18”, “#tag” o “!1”.</span>
        )}
      </div>
    </GlassSheet>
  );
}

const toLocalInput = (ms: number | null, withTime: boolean) => {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return withTime ? `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

export function TaskEditSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Task | null>(task);
  const [sub, setSub] = useState("");
  useEffect(() => setDraft(task), [task]);

  const update = (patch: Partial<Task>) => {
    if (!draft) return;
    const next = { ...draft, ...patch, updatedAt: Date.now() };
    setDraft(next);
    void db.tasks.put(next);
  };

  return (
    <GlassSheet open={!!task} onClose={onClose}>
      {draft && (
        <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
          <div className="flex items-start gap-3">
            <div className="pt-1.5">
              <TaskCheckbox
                checked={draft.status === "done"}
                color={PRIO_COLOR[draft.priority]}
                label="Completada"
                onToggle={() => update({ status: draft.status === "done" ? "todo" : "done", completedAt: draft.status === "done" ? null : Date.now() })}
              />
            </div>
            <textarea
              value={draft.title}
              rows={1}
              onChange={(e) => update({ title: e.target.value })}
              className="min-h-10 flex-1 resize-none bg-transparent text-xl font-semibold outline-none"
            />
          </div>
          <textarea
            value={draft.notes}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Notas (Markdown)…"
            rows={3}
            className="resize-none rounded-2xl bg-muted p-3 text-sm outline-none placeholder:text-muted-foreground"
          />

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vencimiento</span>
            <div className="flex items-center gap-2">
              <input
                type={draft.hasTime ? "datetime-local" : "date"}
                value={toLocalInput(draft.due, draft.hasTime)}
                onChange={(e) => update({ due: e.target.value ? new Date(e.target.value).getTime() : null })}
                className="h-10 flex-1 rounded-2xl bg-muted px-3 text-sm outline-none [color-scheme:dark]"
              />
              <button type="button" onClick={() => update({ hasTime: !draft.hasTime })} className={cn("h-10 rounded-2xl px-3 text-xs font-medium", draft.hasTime ? "bg-accent text-coral" : "bg-muted")}>
                Hora
              </button>
              {draft.due && (
                <button type="button" aria-label="Quitar fecha" onClick={() => update({ due: null })} className="grid h-10 w-10 place-items-center rounded-2xl bg-muted">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioridad</span>
            <div className="flex gap-2">
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <motion.button
                  key={p}
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => update({ priority: p })}
                  className={cn("flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl text-xs font-medium", draft.priority === p ? "bg-accent" : "bg-muted")}
                  style={{ color: PRIO_COLOR[p] }}
                >
                  <Flag className="h-3.5 w-3.5" fill={draft.priority === p ? "currentColor" : "none"} /> P{p}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Repetir</span>
            <div className="no-scrollbar overflow-x-auto">
              <GlassSegmented<Repeat>
                layoutId="repeat"
                size="sm"
                value={draft.repeat}
                onChange={(repeat) => update({ repeat })}
                options={[
                  { value: "none", label: "Nunca" },
                  { value: "daily", label: "Diaria" },
                  { value: "weekly", label: "Semanal" },
                  { value: "monthly", label: "Mensual" },
                  { value: "custom", label: "Cada…" },
                ]}
              />
            </div>
            {draft.repeat === "custom" && (
              <label className="flex items-center gap-2 text-sm">
                Cada
                <input
                  type="number"
                  min={1}
                  value={draft.repeatEveryDays ?? 2}
                  onChange={(e) => update({ repeatEveryDays: Math.max(1, Number(e.target.value)) })}
                  className="h-9 w-16 rounded-xl bg-muted px-2 text-center outline-none"
                />
                días
              </label>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subtareas</span>
            {draft.subtasks.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <TaskCheckbox
                  checked={s.done}
                  color="var(--sage)"
                  label={s.title}
                  onToggle={() => update({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                />
                <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>{s.title}</span>
                <button type="button" aria-label="Quitar subtarea" onClick={() => update({ subtasks: draft.subtasks.filter((x) => x.id !== s.id) })} className="text-muted-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!sub.trim()) return;
                update({ subtasks: [...draft.subtasks, { id: uid(), title: sub.trim(), done: false }] });
                setSub("");
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4 text-muted-foreground" />
              <input value={sub} onChange={(e) => setSub(e.target.value)} placeholder="Añadir subtarea" className="h-9 flex-1 bg-transparent text-sm outline-none" />
            </form>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FolderPicker value={draft.folderId} onChange={(folderId) => update({ folderId })} />
            <TagPicker value={draft.tagIds} onChange={(tagIds) => update({ tagIds })} />
          </div>

          <button
            type="button"
            onClick={async () => {
              await db.tasks.delete(draft.id);
              onClose();
            }}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-destructive/10 text-sm font-medium text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Eliminar tarea
          </button>
        </div>
      )}
    </GlassSheet>
  );
}
