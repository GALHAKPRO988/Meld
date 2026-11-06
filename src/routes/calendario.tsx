import { createFileRoute, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { BookHeart, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { GlassButton, GlassPill, GlassSegmented, GlassSheet } from "@/components/glass/Glass";
import { EventSheet, type EventDraft } from "@/components/calendar/EventSheet";
import { MonthView, TimelineView, weekDays } from "@/components/calendar/Views";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { PRIO_COLOR } from "@/components/tasks/TaskRow";
import { db, type Task } from "@/lib/db";
import { toggleTask } from "@/lib/tasks";
import { useSettings } from "@/lib/settings";
import {
  addDays,
  addMonths,
  dayKey,
  expandEvents,
  fmtTime,
  monthGrid,
  monthTitle,
  occurrencesOnDay,
  sameDay,
  startOfDay,
  startOfWeek,
  type Occurrence,
} from "@/lib/calendar";

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario · Meld" },
      { name: "description", content: "Eventos y tareas con fecha en tu calendario de Meld." },
      { property: "og:title", content: "Calendario · Meld" },
      { property: "og:description", content: "Tu calendario personal en local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarScreen,
});

type View = "month" | "week" | "day";

function CalendarScreen() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [dir, setDir] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const journalEnabled = useSettings((s) => s.journalEnabled);

  const range = useMemo(() => {
    if (view === "month") {
      const g = monthGrid(cursor);
      return [g[0]!.getTime(), addDays(g[41]!, 1).getTime()] as const;
    }
    if (view === "week") {
      const s = startOfWeek(cursor);
      return [s.getTime(), addDays(s, 7).getTime()] as const;
    }
    return [cursor.getTime(), addDays(cursor, 1).getTime()] as const;
  }, [view, cursor]);

  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  const tasks = useLiveQuery(() => db.tasks.where("due").between(range[0], range[1], true, false).toArray(), [range[0], range[1]]) ?? [];
  const journalKeys = useLiveQuery(async () => (journalEnabled ? ((await db.journal.toCollection().primaryKeys()) as string[]) : []), [journalEnabled]) ?? [];
  const journalDays = useMemo(() => new Set(journalKeys), [journalKeys]);
  const occ = useMemo(() => expandEvents(events, range[0], range[1]), [events, range]);

  const shift = (n: number) => {
    setDir(n);
    setCursor((c) => (view === "month" ? addMonths(c, n) : addDays(c, view === "week" ? 7 * n : n)));
  };

  const title =
    view === "month"
      ? monthTitle(cursor)
      : view === "week"
        ? monthTitle(startOfWeek(cursor))
        : cursor.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const newAt = (start: number, allDay = false) => setDraft({ start, end: start + 3_600_000, allDay });
  const openOcc = (o: Occurrence) => setDraft({ ...o.event });
  const moveOcc = (o: Occurrence, delta: number) =>
    void db.events.update(o.event.id, { start: o.event.start + delta, end: o.event.end + delta, updatedAt: Date.now() });
  const toggle = (t: Task) => void toggleTask(t);

  return (
    <div className="pb-safe min-h-dvh pb-24">
      <PageHeader
        title="Calendario"
        actions={
          <GlassPill
            className="h-11 rounded-full px-4"
            onClick={() => {
              setDir(0);
              setCursor(startOfDay(new Date()));
            }}
          >
            Hoy
          </GlassPill>
        }
      />
      <div className="flex items-center justify-between gap-2 px-4 pb-3">
        <GlassSegmented
          layoutId="cal-view"
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Mes" },
            { value: "week", label: "Semana" },
            { value: "day", label: "Día" },
          ]}
        />
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Anterior" onClick={() => shift(-1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => shift(1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <h2 className="px-5 pb-2 text-lg font-semibold first-letter:uppercase">{title}</h2>

      <div className="overflow-hidden px-2">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={`${view}-${cursor.getTime()}`}
            custom={dir}
            variants={{
              enter: (d: number) => ({ x: d * 60, opacity: 0, filter: "blur(4px)" }),
              center: { x: 0, opacity: 1, filter: "blur(0px)" },
              exit: (d: number) => ({ x: d * -60, opacity: 0, filter: "blur(4px)" }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            drag={view === "month" ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70) shift(1);
              else if (info.offset.x > 70) shift(-1);
            }}
          >
            {view === "month" && (
              <MonthView cursor={cursor} occ={occ} tasks={tasks} journalDays={journalDays} onDay={(d) => setSelectedDay(d)} />
            )}
            {view === "week" && (
              <TimelineView days={weekDays(cursor)} occ={occ} tasks={tasks} onOpen={openOcc} onSlot={newAt} onMove={moveOcc} onToggleTask={toggle} />
            )}
            {view === "day" && (
              <TimelineView days={[cursor]} occ={occ} tasks={tasks} onOpen={openOcc} onSlot={newAt} onMove={moveOcc} onToggleTask={toggle} />
            )}
          </motion.div>
        </AnimatePresence>
        {view !== "month" && <p className="mt-2 text-center text-xs text-muted-foreground">Toca una hora para crear · arrastra para mover</p>}
      </div>

      <div className="pb-safe app-col fixed inset-x-0 bottom-0 z-30 flex justify-end px-5 pb-5">
        <GlassButton
          aria-label="Nuevo evento"
          className="glass-strong"
          onClick={() => {
            const base = view === "month" && selectedDay ? selectedDay : cursor;
            const d = new Date(base);
            const now = new Date();
            d.setHours(sameDay(d, now) ? now.getHours() + 1 : 9, 0, 0, 0);
            newAt(d.getTime());
          }}
        >
          <Plus className="h-7 w-7" />
        </GlassButton>
      </div>

      <DaySheet
        day={selectedDay}
        occ={selectedDay ? occurrencesOnDay(occ, selectedDay) : []}
        tasks={selectedDay ? tasks.filter((t) => t.due && sameDay(t.due, selectedDay)) : []}
        hasJournal={!!selectedDay && journalDays.has(dayKey(selectedDay))}
        journalEnabled={journalEnabled}
        onClose={() => setSelectedDay(null)}
        onOpen={(o) => {
          setSelectedDay(null);
          openOcc(o);
        }}
        onNew={() => {
          if (!selectedDay) return;
          const d = new Date(selectedDay);
          d.setHours(9, 0, 0, 0);
          setSelectedDay(null);
          newAt(d.getTime());
        }}
        onToggle={toggle}
      />
      <EventSheet draft={draft} onClose={() => setDraft(null)} />
    </div>
  );
}

function DaySheet({
  day,
  occ,
  tasks,
  hasJournal,
  journalEnabled,
  onClose,
  onOpen,
  onNew,
  onToggle,
}: {
  day: Date | null;
  occ: Occurrence[];
  tasks: Task[];
  hasJournal: boolean;
  journalEnabled: boolean;
  onClose: () => void;
  onOpen: (o: Occurrence) => void;
  onNew: () => void;
  onToggle: (t: Task) => void;
}) {
  const label = day?.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" }) ?? "";
  return (
    <GlassSheet open={!!day} onClose={onClose} title={label.charAt(0).toUpperCase() + label.slice(1)}>
      <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
        {occ.length === 0 && tasks.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Día libre.</p>}
        {occ.map((o, i) => (
          <motion.button
            key={o.key}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onOpen(o)}
            className="flex items-center gap-3 rounded-2xl bg-muted px-3 py-2.5 text-left"
          >
            <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: o.event.color }} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium">{o.event.title}</span>
              <span className="text-xs text-muted-foreground">{o.event.allDay ? "Todo el día" : `${fmtTime(o.start)} – ${fmtTime(o.end)}`}</span>
            </span>
          </motion.button>
        ))}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl px-3 py-2">
            <TaskCheckbox checked={t.status === "done"} onToggle={() => onToggle(t)} color={PRIO_COLOR[t.priority]} label={t.title} />
            <span className={t.status === "done" ? "text-muted-foreground line-through" : ""}>{t.title}</span>
          </div>
        ))}
        {journalEnabled && hasJournal && day && (
          <Link
            to="/diario"
            search={{ dia: dayKey(day) }}
            className="flex items-center gap-2 rounded-2xl bg-coral/10 px-3 py-2.5 text-sm font-medium text-coral"
          >
            <BookHeart className="h-4 w-4" /> Ver entrada del diario
          </Link>
        )}
      </div>
      <button type="button" onClick={onNew} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground">
        <Plus className="h-4 w-4" /> Nuevo evento
      </button>
    </GlassSheet>
  );
}
