import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db, newPage, newTask } from "@/lib/db";
import {
  emptyTrash,
  getTrashItems,
  moveToTrash,
  permanentlyDelete,
  restoreFromTrash,
} from "@/lib/trash";

describe("trash", () => {
  beforeEach(async () => {
    await Promise.all([db.pages.clear(), db.tasks.clear()]);
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it("moves and restores pages and tasks without deleting their data", async () => {
    await db.pages.add(newPage({ id: "page", title: "Página" }));
    await db.tasks.add(newTask({ id: "task", title: "Tarea" }));

    await moveToTrash("page", "page");
    await moveToTrash("task", "task");

    const trashed = await getTrashItems();
    expect(new Set(trashed.map((item) => item.id))).toEqual(new Set(["page", "task"]));
    expect((await db.pages.get("page"))?.title).toBe("Página");
    expect((await db.tasks.get("task"))?.title).toBe("Tarea");

    await restoreFromTrash("page", "page");
    expect((await db.pages.get("page"))?.deletedAt).toBeNull();
    expect((await getTrashItems()).map((item) => item.id)).toEqual(["task"]);
  });

  it("permanently deletes a selected item and empties the remaining trash", async () => {
    await db.pages.add(newPage({ id: "page" }));
    await db.tasks.bulkAdd([newTask({ id: "task-1" }), newTask({ id: "task-2" })]);
    await Promise.all([
      moveToTrash("page", "page"),
      moveToTrash("task", "task-1"),
      moveToTrash("task", "task-2"),
    ]);

    await permanentlyDelete("page", "page");
    await emptyTrash();

    expect(await db.pages.get("page")).toBeUndefined();
    expect(await db.tasks.count()).toBe(0);
    expect(await getTrashItems()).toEqual([]);
  });
});
