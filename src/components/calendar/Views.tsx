import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookHeart, CheckCircle2, Circle } from "lucide-react";
import type { Task } from "@/lib/db";
import {
  addDays,
  dayKey,
  fmtTime,
  monthGrid,
  occurrencesOnDay,
  sameDay,
  startOfDay,
  startOfWeek,
  WEEKDAYS_MED,
  WEEKDAYS_SHORT,
  type Occurrence,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

const tasksOnDay = (tasks: Task[], d: Date) => tasks.filter((t) => t.due && sameDay(t.due, d));

/* ---------------- Month ---------------- */
export function MonthView({
  cursor,
  occ,
  tasks,
  journalDays,
  onDay,
}: {
  cursor: Date;
  occ: Occurrence[];
  tasks: Task[];
  journalDays: Set<string>;
  onDay: (d: Date) => void;
}) {
  const days = monthGrid(cursor);
  const today = new Date();
  return (
    <div>
      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold text-muted-foreground">
        {WEEKDAYS_SHORT.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = sameDay(d, today);
          const dayOcc = occurrencesOnDay(occ, d);
          const dayTasks = tasksOnDay(tasks, d);
          const dots = [...dayOcc.map((o) => o.event.color), ...dayTasks.map(() => "var(--sage)")].slice(0, 4);
          const journal = journalDays.has(dayKey(d));
          return (
            <motion.button
              key={d.getTime()}
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.006 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDay(d)}
              aria-label={d.toLocaleDateString("es-ES", { dateStyle: "full" })}
              className="flex h-[60px] flex-col items-center rounded-2xl pt-1.5"
            >
              <span
                className={cn(
                  "relative grid h-8 w-8 place-items-center rounded-full text-[15px] tabular-nums",
                  !inMonth && "text-muted-foreground/40",
                  isToday && "bg-coral font-semibold text-primary-foreground",
                  journal && !isToday && "ring-1 ring-coral/70",
                )}
              >
                {d.getDate()}
              </span>
              <span className="mt-1 flex h-1.5 gap-[3px]">
                {dots.map((c, j) => (
                  <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                ))}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Timeline (week & day) ---------------- */
const HOUR = 48;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function TimelineView({
  days,
  occ,
  tasks,
  onOpen,
  onSlot,
  onMove,
  onToggleTask,
}: {
  days: Date[];
  occ: Occurrence[];
  tasks: Task[];
  onOpen: (o: Occurrence) => void;
  onSlot: (start: number) => void;
  onMove: (o: Occurrence, deltaMs: number) => void;
  onToggleTask: (t: Task) => void;
}) {
  const [ref, width] = useWidth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gutter = 34;
  const colW = width ? (width - gutter) / days.length : 0;
  const today = new Date();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: HOUR * 7.5 });
  }, []);

  const allDay = days.map((d) => occurrencesOnDay(occ, d).filter((o) => o.event.allDay));
  const dayTasks = days.map((d) => tasksOnDay(tasks, d));
  const hasTop = allDay.some((a) => a.length) || dayTasks.some((t) => t.length);

  return (
    <div ref={ref}>
      <div className="flex" style={{ paddingLeft: gutter }}>
        {days.map((d) => (
          <div key={d.getTime()} className="flex-1 pb-1 text-center">
            <div className="text-[11px] text-muted-foreground">{WEEKDAYS_MED[(d.getDay() + 6) % 7]}</div>
            <div className={cn("mx-auto grid h-7 w-7 place-items-center rounded-full text-sm font-semibold", sameDay(d, today) && "bg-coral text-primary-foreground")}>
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>
      {hasTop && (
        <div className="flex border-b border-border pb-1" style={{ paddingLeft: gutter }}>
          {days.map((d, i) => (
            <div key={d.getTime()} className="flex min-w-0 flex-1 flex-col gap-0.5 px-0.5">
              {allDay[i]?.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => onOpen(o)}
                  className="truncate rounded-md px-1 py-0.5 text-left text-[10px] font-medium text-primary-foreground"
                  style={{ background: o.event.color }}
                >
                  {o.event.title}
                </button>
              ))}
              {dayTasks[i]?.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onToggleTask(t)}
                  className={cn("flex items-center gap-0.5 truncate rounded-md bg-muted px-1 py-0.5 text-left text-[10px]", t.status === "done" && "text-muted-foreground line-through")}
                >
                  {t.status === "done" ? <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-success" /> : <Circle className="h-2.5 w-2.5 shrink-0" />}
                  <span className="truncate">{t.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div ref={scrollRef} className="no-scrollbar relative overflow-y-auto" style={{ height: "calc(100dvh - 300px)" }}>
        <div className="relative" style={{ height: HOUR * 24 }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="absolute left-0 right-0 border-t border-border/60" style={{ top: h * HOUR }}>
              <span className="absolute -top-2 left-0 w-[30px] text-right text-[10px] tabular-nums text-muted-foreground">{h ? `${h}:00` : ""}</span>
            </div>
          ))}
          {days.map((d, i) =>
            sameDay(d, today) ? (
              <div
                key="now"
                className="absolute z-20 h-0.5 rounded-full bg-coral"
                style={{ left: gutter + i * colW, width: colW, top: ((today.getHours() * 60 + today.getMinutes()) / 60) * HOUR }}
              />
            ) : null,
          )}
          {days.map((d, i) => (
            <div
              key={d.getTime()}
              className="absolute bottom-0 top-0 border-l border-border/40"
              style={{ left: gutter + i * colW, width: colW }}
              onClick={(e) => {
                const y = e.clientY - (e.currentTarget as HTMLDivElement).getBoundingClientRect().top;
                const minutes = Math.floor((y / HOUR) * 2) * 30;
                onSlot(startOfDay(d).getTime() + minutes * 60_000);
              }}
            />
          ))}
          {days.flatMap((d, i) =>
            occurrencesOnDay(occ, d)
              .filter((o) => !o.event.allDay && sameDay(o.start, d))
              .map((o) => <TimedEvent key={o.key} o={o} left={gutter + i * colW} width={colW} onOpen={onOpen} onMove={onMove} colW={colW} />),
          )}
        </div>
      </div>
    </div>
  );
}

function TimedEvent({
  o,
  left,
  width,
  colW,
  onOpen,
  onMove,
}: {
  o: Occurrence;
  left: number;
  width: number;
  colW: number;
  onOpen: (o: Occurrence) => void;
  onMove: (o: Occurrence, deltaMs: number) => void;
}) {
  const s = new Date(o.start);
  const top = ((s.getHours() * 60 + s.getMinutes()) / 60) * HOUR;
  const height = Math.max(20, ((o.end - o.start) / 3_600_000) * HOUR - 2);
  const moved = useRef(false);
  return (
    <motion.button
      type="button"
      drag
      dragMomentum={false}
      dragSnapToOrigin
      dragElastic={0}
      whileDrag={{ scale: 1.04, zIndex: 40, boxShadow: "0 12px 30px -8px oklch(0 0 0 / 0.5)" }}
      onDragStart={() => (moved.current = true)}
      onDragEnd={(_, info) => {
        const dayDelta = colW ? Math.round(info.offset.x / colW) : 0;
        const minDelta = Math.round(((info.offset.y / HOUR) * 60) / 15) * 15;
        if (dayDelta || minDelta) onMove(o, dayDelta * 864e5 + minDelta * 60_000);
        setTimeout(() => (moved.current = false), 50);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (!moved.current) onOpen(o);
      }}
      className="absolute z-10 overflow-hidden rounded-lg px-1 py-0.5 text-left text-[10px] font-medium leading-tight text-primary-foreground"
      style={{ left: left + 1, width: width - 3, top, height, background: o.event.color, touchAction: "none" }}
    >
      <div className="truncate">{o.event.title}</div>
      {height > 30 && <div className="truncate opacity-80">{fmtTime(o.start)}</div>}
    </motion.button>
  );
}

export function weekDays(cursor: Date) {
  const s = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

export function JournalBadge() {
  return <BookHeart className="h-3.5 w-3.5 text-coral" />;
}
