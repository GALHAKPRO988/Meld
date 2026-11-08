import { useEffect } from "react";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { dueReminders, taskWarnings, warnText } from "@/lib/reminders";
import { useSettings } from "@/lib/settings";

export function notify(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(title, { body, icon: "/icons/icon-512.png" });
    } catch {
      /* some WebViews disallow the constructor */
    }
  }
}

/** While the app is open, checks every 30s for reminders and advance task warnings. */
export function useReminders() {
  useEffect(() => {
    let since = Date.now();
    const seen = new Set<string>();
    const tick = async () => {
      const now = Date.now();
      const hours = useSettings.getState().taskWarnHours;
      const [events, allTasks] = await Promise.all([db.events.toArray(), db.tasks.toArray()]);
      const tasks = allTasks.filter((task) => !task.deletedAt);
      for (const r of [...taskWarnings(tasks, hours, since, now), ...dueReminders(events, tasks, since, now)]) {
        if (seen.has(r.key)) continue;
        seen.add(r.key);
        if (r.kind === "warn") {
          const text = warnText(r.title, hours);
          toast(text, { duration: 10_000 });
          notify("Meld", text);
          continue;
        }
        const when = new Date(r.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
        toast(r.title, { description: `${r.kind === "event" ? "Evento" : "Tarea"} · ${when}`, duration: 10_000 });
        notify(r.title, when);
      }
      since = now;
    };
    const id = setInterval(() => void tick(), 30_000);
    return () => clearInterval(id);
  }, []);
}
