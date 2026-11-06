import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GlassSegmented, GlassSheet, GlassSwitch } from "@/components/glass/Glass";
import { TagPicker } from "@/components/TagPicker";
import { db, uid, type CalendarEvent, type Repeat } from "@/lib/db";
import { EVENT_COLORS } from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type EventDraft = Partial<CalendarEvent> & { start: number; end: number };

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const toTime = (ms: number) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const combine = (date: string, time: string) => new Date(`${date}T${time || "00:00"}`).getTime();

const REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: "Sin aviso" },
  { value: 0, label: "A la hora" },
  { value: 10, label: "10 min antes" },
  { value: 30, label: "30 min antes" },
  { value: 60, label: "1 h antes" },
  { value: 1440, label: "1 día antes" },
];

export function EventSheet({ draft, onClose }: { draft: EventDraft | null; onClose: () => void }) {
  const [ev, setEv] = useState<CalendarEvent | null>(null);
  const isNew = !draft?.id;

  useEffect(() => {
    if (!draft) return setEv(null);
    const now = Date.now();
    setEv({
      id: draft.id ?? uid(),
      title: draft.title ?? "",
      start: draft.start,
      end: draft.end,
      allDay: draft.allDay ?? false,
      color: draft.color ?? EVENT_COLORS[0] ?? "oklch(0.72 0.15 40)",
      repeat: draft.repeat ?? "none",
      description: draft.description ?? "",
      tagIds: draft.tagIds ?? [],
      reminderMinutes: draft.reminderMinutes ?? null,
      createdAt: draft.createdAt ?? now,
      updatedAt: now,
    });
  }, [draft]);

  const patch = (p: Partial<CalendarEvent>) => setEv((e) => (e ? { ...e, ...p } : e));

  const save = async () => {
    if (!ev || !ev.title.trim()) return;
    const fixed = { ...ev, title: ev.title.trim(), end: Math.max(ev.end, ev.start), updatedAt: Date.now() };
    await db.events.put(fixed);
    if (fixed.reminderMinutes !== null && "Notification" in window && Notification.permission === "default") {
      const res = await Notification.requestPermission();
      if (res !== "granted") toast("Sin permiso de notificaciones: el aviso no sonará");
    }
    onClose();
  };

  return (
    <GlassSheet open={!!draft} onClose={onClose} title={isNew ? "Nuevo evento" : "Editar evento"}>
      {ev && (
        <div className="flex max-h-[72vh] flex-col gap-4 overflow-y-auto pb-1">
          <input
            autoFocus={isNew}
            value={ev.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="Título"
            className="h-12 rounded-2xl bg-muted px-3.5 text-[16px] font-medium outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-medium">Todo el día</span>
            <GlassSwitch checked={ev.allDay} onChange={(allDay) => patch({ allDay })} label="Todo el día" />
          </div>
          {(["start", "end"] as const).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-12 px-1 text-sm text-muted-foreground">{k === "start" ? "Inicio" : "Fin"}</span>
              <input
                type="date"
                value={toDate(ev[k])}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const v = combine(e.target.value, toTime(ev[k]));
                  if (k === "start") patch({ start: v, end: v + (ev.end - ev.start) });
                  else patch({ end: v });
                }}
                className="h-10 flex-1 rounded-2xl bg-muted px-3 text-sm outline-none [color-scheme:dark]"
              />
              {!ev.allDay && (
                <input
                  type="time"
                  value={toTime(ev[k])}
                  onChange={(e) => {
                    const v = combine(toDate(ev[k]), e.target.value);
                    if (k === "start") patch({ start: v, end: v + (ev.end - ev.start) });
                    else patch({ end: v });
                  }}
                  className="h-10 w-24 rounded-2xl bg-muted px-3 text-sm outline-none [color-scheme:dark]"
                />
              )}
            </div>
          ))}
          <div className="flex gap-2.5 px-1">
            {EVENT_COLORS.map((c) => (
              <motion.button
                key={c}
                type="button"
                whileTap={{ scale: 0.85 }}
                aria-label="Color"
                onClick={() => patch({ color: c })}
                className={cn("h-8 w-8 rounded-full", ev.color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="no-scrollbar overflow-x-auto">
            <GlassSegmented<Repeat>
              layoutId="ev-repeat"
              size="sm"
              value={ev.repeat}
              onChange={(repeat) => patch({ repeat })}
              options={[
                { value: "none", label: "No se repite" },
                { value: "daily", label: "Diario" },
                { value: "weekly", label: "Semanal" },
                { value: "monthly", label: "Mensual" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Bell className="h-3 w-3" /> Recordatorio
            </span>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {REMINDERS.map((r) => (
                <button
                  key={String(r.value)}
                  type="button"
                  onClick={() => patch({ reminderMinutes: r.value })}
                  className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-medium", ev.reminderMinutes === r.value ? "bg-accent text-coral" : "bg-muted")}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={ev.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Descripción"
            rows={2}
            className="resize-none rounded-2xl bg-muted p-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <TagPicker value={ev.tagIds} onChange={(tagIds) => patch({ tagIds })} />
          <div className="flex gap-2">
            {!isNew && (
              <button
                type="button"
                aria-label="Eliminar evento"
                onClick={async () => {
                  await db.events.delete(ev.id);
                  onClose();
                }}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-destructive/10 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!ev.title.trim()}
              onClick={() => void save()}
              className="h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
      )}
    </GlassSheet>
  );
}
