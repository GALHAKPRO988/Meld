import type { CalendarEvent, Repeat } from "./db";
import { nextDue } from "./tasks";

export const WEEKDAYS_SHORT = ["L", "M", "X", "J", "V", "S", "D"];
export const WEEKDAYS_MED = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export const EVENT_COLORS = [
  "oklch(0.72 0.15 40)",
  "oklch(0.8 0.14 75)",
  "oklch(0.72 0.14 155)",
  "oklch(0.7 0.11 240)",
  "oklch(0.68 0.15 300)",
  "oklch(0.7 0.16 350)",
];

export function startOfDay(d: Date | number) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
export function addDays(d: Date | number, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
/** Monday-based week start. */
export function startOfWeek(d: Date | number) {
  const c = startOfDay(d);
  const dow = (c.getDay() + 6) % 7;
  return addDays(c, -dow);
}
export function startOfMonth(d: Date | number) {
  const c = startOfDay(d);
  c.setDate(1);
  return c;
}
export function addMonths(d: Date | number, n: number) {
  const c = startOfMonth(d);
  c.setMonth(c.getMonth() + n);
  return c;
}
export function sameDay(a: Date | number, b: Date | number) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
export function dayKey(d: Date | number) {
  const c = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${c.getFullYear()}-${p(c.getMonth() + 1)}-${p(c.getDate())}`;
}
export function fromDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/** 6×7 grid of days covering the month of `cursor`, Monday first. */
export function monthGrid(cursor: Date | number): Date[] {
  const first = startOfWeek(startOfMonth(cursor));
  return Array.from({ length: 42 }, (_, i) => addDays(first, i));
}

export interface Occurrence {
  key: string;
  event: CalendarEvent;
  start: number;
  end: number;
}

/** Expands repeating events into concrete occurrences overlapping [from, to). */
export function expandEvents(events: CalendarEvent[], from: number, to: number): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) {
    const dur = Math.max(0, ev.end - ev.start);
    let start = ev.start;
    let guard = 0;
    while (start < to && guard++ < 2000) {
      const end = start + dur;
      if (end >= from || (dur === 0 && start >= from)) {
        if (start < to && (end > from || start >= from)) out.push({ key: `${ev.id}:${start}`, event: ev, start, end });
      }
      if (ev.repeat === "none") break;
      start = nextDue(start, ev.repeat as Repeat, 2);
    }
  }
  return out.sort((a, b) => Number(b.event.allDay) - Number(a.event.allDay) || a.start - b.start);
}

export function occurrencesOnDay(occ: Occurrence[], day: Date | number) {
  const a = startOfDay(day).getTime();
  const b = a + 864e5;
  return occ.filter((o) => o.start < b && (o.end > a || (o.start >= a && o.start < b)));
}

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
export const monthTitle = (d: Date) => {
  const s = d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
