import { addDays, dayKey, fromDayKey, startOfDay } from "./calendar";
import { db, type JournalEntry } from "./db";
import { useSettings } from "./settings";

export const MOODS = [
  { id: "genial", emoji: "😄", label: "Genial" },
  { id: "bien", emoji: "🙂", label: "Bien" },
  { id: "normal", emoji: "😐", label: "Normal" },
  { id: "mal", emoji: "😕", label: "Mal" },
  { id: "fatal", emoji: "😢", label: "Fatal" },
] as const;

export const moodEmoji = (id: string | null | undefined) => MOODS.find((m) => m.id === id)?.emoji ?? null;

export const isDayKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function isJournalDayLocked(day: string, today = dayKey(new Date())): boolean {
  return useSettings.getState().lockPastJournalEntries && day < today;
}

export function assertJournalEditable(day: string): void {
  if (!isDayKey(day)) throw new Error("La fecha de la entrada no es válida.");
  if (isJournalDayLocked(day)) {
    throw new Error("Esta entrada está protegida porque pertenece a un día anterior.");
  }
}

/** Consecutive days with an entry ending today — or yesterday, so the streak survives until today is over. */
export function currentStreak(keys: Iterable<string>, today: Date = new Date()): number {
  const set = new Set(keys);
  let d = startOfDay(today);
  if (!set.has(dayKey(d))) d = addDays(d, -1);
  let n = 0;
  while (set.has(dayKey(d))) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Longest run of consecutive days with an entry. */
export function longestStreak(keys: Iterable<string>): number {
  const sorted = [...new Set(keys)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev !== null && dayKey(addDays(fromDayKey(prev), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = k;
  }
  return best;
}

export const entryHasContent = (e: Pick<JournalEntry, "markdown" | "mood">) => Boolean(e.mood) || e.markdown.trim().length > 0;

/** Merges a patch into a day's entry; deletes the entry when it ends up empty so it doesn't count for streaks. */
export async function saveJournal(day: string, patch: Partial<Omit<JournalEntry, "id">>) {
  assertJournalEditable(day);
  await db.transaction("rw", db.journal, async () => {
    assertJournalEditable(day);
    const before = await db.journal.get(day);
    assertJournalEditable(day);
    const next: JournalEntry = { id: day, html: "", markdown: "", mood: null, ...before, ...patch, updatedAt: Date.now() };
    if (entryHasContent(next)) await db.journal.put(next);
    else if (before) await db.journal.delete(day);
  });
}
