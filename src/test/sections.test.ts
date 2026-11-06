import { describe, expect, it } from "vitest";
import {
  assertJournalEditable,
  currentStreak,
  entryHasContent,
  isJournalDayLocked,
  longestStreak,
} from "@/lib/journal";
import { canMoveFolder, descendantIds, flattenTree, folderPath } from "@/lib/folders";
import { mergeTagIds } from "@/lib/tags";
import { applyTaskFilter, reassignOrder, sortTasks, EMPTY_FILTER } from "@/lib/tasks";
import { dueReminders } from "@/lib/reminders";
import { newTask, type CalendarEvent, type Folder } from "@/lib/db";
import { useSettings } from "@/lib/settings";

const TODAY = new Date(2026, 10, 3, 15, 0, 0); // Tue 3 Nov 2026

describe("diary streaks", () => {
  it("counts consecutive days ending today", () => {
    expect(currentStreak(["2026-11-01", "2026-11-02", "2026-11-03"], TODAY)).toBe(3);
  });
  it("keeps the streak alive if today is not written yet", () => {
    expect(currentStreak(["2026-11-01", "2026-11-02"], TODAY)).toBe(2);
  });
  it("breaks after a missed day", () => {
    expect(currentStreak(["2026-10-31", "2026-11-01"], TODAY)).toBe(0);
  });
  it("longest streak crosses month boundaries", () => {
    expect(longestStreak(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-03"])).toBe(3);
  });
  it("an entry with only a mood counts; an empty one doesn't", () => {
    expect(entryHasContent({ markdown: "", mood: "bien" })).toBe(true);
    expect(entryHasContent({ markdown: "  ", mood: null })).toBe(false);
  });
});

describe("past diary entry lock", () => {
  it("blocks past dates when enabled and permits them when disabled", () => {
    const original = useSettings.getState().lockPastJournalEntries;
    try {
      useSettings.getState().setLockPastJournalEntries(true);
      expect(isJournalDayLocked("2026-11-02", "2026-11-03")).toBe(true);
      expect(isJournalDayLocked("2026-11-03", "2026-11-03")).toBe(false);
      expect(() => assertJournalEditable("2000-01-01")).toThrow("protegida");

      useSettings.getState().setLockPastJournalEntries(false);
      expect(isJournalDayLocked("2026-11-02", "2026-11-03")).toBe(false);
      expect(() => assertJournalEditable("2000-01-01")).not.toThrow();
    } finally {
      useSettings.getState().setLockPastJournalEntries(original);
    }
  });
});

const f = (id: string, parentId: string | null, name = id): Folder => ({ id, name, parentId, icon: "📁", color: "", createdAt: 0 });
const FOLDERS = [f("a", null, "Casa"), f("b", "a", "Cocina"), f("c", "b", "Recetas"), f("d", null, "Trabajo")];

describe("nested folders", () => {
  it("finds descendants at any depth", () => {
    expect([...descendantIds(FOLDERS, "a")].sort()).toEqual(["b", "c"]);
  });
  it("cannot move a folder into itself or a subfolder", () => {
    expect(canMoveFolder(FOLDERS, "a", "a")).toBe(false);
    expect(canMoveFolder(FOLDERS, "a", "c")).toBe(false);
    expect(canMoveFolder(FOLDERS, "c", "d")).toBe(true);
    expect(canMoveFolder(FOLDERS, "b", null)).toBe(true);
  });
  it("builds the breadcrumb path", () => {
    expect(folderPath(FOLDERS, "c").map((x) => x.name)).toEqual(["Casa", "Cocina", "Recetas"]);
  });
  it("flattens the tree depth-first and hides collapsed children", () => {
    expect(flattenTree(FOLDERS).map((x) => `${x.depth}:${x.folder.id}`)).toEqual(["0:a", "1:b", "2:c", "0:d"]);
    expect(flattenTree(FOLDERS, new Set(["a"])).map((x) => x.folder.id)).toEqual(["a", "d"]);
  });
});

describe("tag merge", () => {
  it("replaces the source tag and avoids duplicates", () => {
    expect(mergeTagIds(["x", "src", "dst"], "src", "dst")).toEqual(["x", "dst"]);
    expect(mergeTagIds(["src"], "src", "dst")).toEqual(["dst"]);
    expect(mergeTagIds(["x"], "src", "dst")).toEqual(["x"]);
  });
});

describe("task filters and order", () => {
  const t1 = newTask({ id: "1", title: "a", priority: 3, tagIds: ["casa"], folderId: "f1", order: 10, due: 300 });
  const t2 = newTask({ id: "2", title: "b", priority: 1, tagIds: ["casa", "urgente"], folderId: null, order: 20, due: null });
  const t3 = newTask({ id: "3", title: "c", priority: 4, tagIds: [], folderId: "f1", order: 30, due: 100 });

  it("filters by tag, folder and priority", () => {
    expect(applyTaskFilter([t1, t2, t3], { ...EMPTY_FILTER, tagIds: ["casa"] }).map((t) => t.id)).toEqual(["1", "2"]);
    expect(applyTaskFilter([t1, t2, t3], { ...EMPTY_FILTER, folderId: "none" }).map((t) => t.id)).toEqual(["2"]);
    expect(applyTaskFilter([t1, t2, t3], { ...EMPTY_FILTER, folderId: "f1", priorities: [4] }).map((t) => t.id)).toEqual(["3"]);
  });
  it("sorts by date (undated last) and by priority", () => {
    expect(sortTasks([t1, t2, t3], "fecha").map((t) => t.id)).toEqual(["3", "1", "2"]);
    expect(sortTasks([t1, t2, t3], "prioridad").map((t) => t.id)).toEqual(["2", "1", "3"]);
  });
  it("reorders reusing the existing order slots", () => {
    expect(reassignOrder([t3, t1, t2])).toEqual([
      { id: "3", order: 10 },
      { id: "1", order: 20 },
      { id: "2", order: 30 },
    ]);
  });
});

describe("reminders", () => {
  const ev: CalendarEvent = {
    id: "e",
    title: "Dentista",
    start: new Date(2026, 10, 3, 16, 0).getTime(),
    end: new Date(2026, 10, 3, 17, 0).getTime(),
    allDay: false,
    color: "",
    repeat: "none",
    description: "",
    tagIds: [],
    reminderMinutes: 15,
    createdAt: 0,
    updatedAt: 0,
  };
  it("fires 15 minutes before the event, once", () => {
    const at = new Date(2026, 10, 3, 15, 45).getTime();
    expect(dueReminders([ev], [], at - 30_000, at + 1000).map((r) => r.title)).toEqual(["Dentista"]);
    expect(dueReminders([ev], [], at + 1000, at + 60_000)).toEqual([]);
  });
  it("fires timed tasks at their due time but not done ones", () => {
    const due = new Date(2026, 10, 3, 18, 0).getTime();
    const task = newTask({ title: "Llamar", due, hasTime: true });
    expect(dueReminders([], [task], due - 1000, due).length).toBe(1);
    expect(dueReminders([], [{ ...task, status: "done" }], due - 1000, due).length).toBe(0);
  });
});
