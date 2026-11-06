import type { CalendarEvent, Task } from "./db";
import { expandEvents } from "./calendar";

export interface DueReminder {
  key: string;
  title: string;
  at: number; // when the reminder fires
  start: number; // when the event/task happens
  kind: "event" | "task" | "warn";
}

/** Advance warnings ("te quedan X horas") for open timed tasks whose due - hours falls in (since, now]. */
export function taskWarnings(tasks: Task[], hours: number, since: number, now: number): DueReminder[] {
  if (hours <= 0) return [];
  const lead = hours * 3600_000;
  const out: DueReminder[] = [];
  for (const t of tasks) {
    if (t.status === "done" || !t.hasTime || t.due === null) continue;
    const at = t.due - lead;
    if (at > since && at <= now) out.push({ key: `warn:${t.id}:${t.due}`, title: t.title, at, start: t.due, kind: "warn" });
  }
  return out;
}

export function warnText(title: string, hours: number) {
  return `Hey, te quedan ${hours} ${hours === 1 ? "hora" : "horas"} para hacer "${title}"`;
}

/** Reminders whose fire time falls in (since, now]. Events use reminderMinutes; timed tasks fire at their due time. */
export function dueReminders(events: CalendarEvent[], tasks: Task[], since: number, now: number): DueReminder[] {
  const out: DueReminder[] = [];
  const withReminder = events.filter((e) => e.reminderMinutes !== null);
  const maxLead = Math.max(0, ...withReminder.map((e) => e.reminderMinutes ?? 0)) * 60_000;
  for (const o of expandEvents(withReminder, since, now + maxLead + 1)) {
    const at = o.start - (o.event.reminderMinutes ?? 0) * 60_000;
    if (at > since && at <= now) out.push({ key: o.key, title: o.event.title, at, start: o.start, kind: "event" });
  }
  for (const t of tasks) {
    if (t.status === "done" || !t.hasTime || t.due === null) continue;
    if (t.due > since && t.due <= now) out.push({ key: `task:${t.id}:${t.due}`, title: t.title, at: t.due, start: t.due, kind: "task" });
  }
  return out.sort((a, b) => a.at - b.at);
}
