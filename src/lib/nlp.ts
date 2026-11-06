import type { Priority } from "./db";

export interface ParsedQuickTask {
  title: string;
  due: number | null;
  hasTime: boolean;
  tags: string[];
  priority: Priority | null;
}

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/**
 * Parses Spanish quick-add text like "comprar pan mañana a las 10 #casa !1".
 * Pure: `now` is injectable for tests.
 */
export function parseQuickTask(input: string, now: Date = new Date()): ParsedQuickTask {
  let text = ` ${input} `;
  const tags: string[] = [];
  let priority: Priority | null = null;
  let day: Date | null = null;
  let hours: number | null = null;
  let minutes = 0;

  text = text.replace(/\s#([\p{L}\p{N}_-]+)/gu, (_, t: string) => {
    tags.push(t);
    return " ";
  });

  text = text.replace(/\s(?:!|p)([1-4])(?=\s)/gi, (_, p: string) => {
    priority = Number(p) as Priority;
    return " ";
  });

  // Time: "a las 10", "a las 10:30", "a la 1", "10:30", "a las 5 de la tarde"
  text = text.replace(
    /\s(?:a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?(?:\s*(h|horas))?(?:\s+de\s+la\s+(mañana|tarde|noche))?(?=\s)/i,
    (match, h: string, m: string | undefined, hSuffix: string | undefined, period: string | undefined) => {
      const explicit = /a\s+las?\s+/i.test(match) || m !== undefined || hSuffix !== undefined;
      if (!explicit) return match;
      let hh = Number(h);
      if (hh > 23) return match;
      if (period && /tarde|noche/i.test(period) && hh < 12) hh += 12;
      hours = hh;
      minutes = m ? Math.min(59, Number(m)) : 0;
      return " ";
    },
  );

  // Day words
  const today = startOfDay(now);
  text = text.replace(/\s(pasado\s+mañana|mañana|hoy)(?=\s)/i, (_, w: string) => {
    const word = w.toLowerCase().replace(/\s+/g, " ");
    const d = new Date(today);
    if (word === "mañana") d.setDate(d.getDate() + 1);
    else if (word === "pasado mañana") d.setDate(d.getDate() + 2);
    day = d;
    return " ";
  });

  if (!day) {
    text = text.replace(
      /\s(?:el\s+|este\s+|próximo\s+|proximo\s+)?(lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)(?=\s)/i,
      (_, w: string) => {
        const target = WEEKDAYS[w.toLowerCase()] ?? 1;
        const d = new Date(today);
        let diff = (target - d.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        d.setDate(d.getDate() + diff);
        day = d;
        return " ";
      },
    );
  }

  if (!day) {
    // "el 15", "el 15/11"
    text = text.replace(/\sel\s+(\d{1,2})(?:\/(\d{1,2}))?(?=\s)/i, (match, dd: string, mm: string | undefined) => {
      const d = new Date(today);
      const dayNum = Number(dd);
      if (dayNum < 1 || dayNum > 31) return match;
      if (mm) d.setMonth(Number(mm) - 1);
      d.setDate(dayNum);
      if (d < today) mm ? d.setFullYear(d.getFullYear() + 1) : d.setMonth(d.getMonth() + 1);
      day = d;
      return " ";
    });
  }

  let due: number | null = null;
  let hasTime = false;
  if (day || hours !== null) {
    const base = new Date(day ?? today);
    if (hours !== null) {
      base.setHours(hours, minutes, 0, 0);
      hasTime = true;
      if (!day && base.getTime() < now.getTime()) base.setDate(base.getDate() + 1);
    }
    due = base.getTime();
  }

  return { title: text.replace(/\s+/g, " ").trim(), due, hasTime, tags, priority };
}
