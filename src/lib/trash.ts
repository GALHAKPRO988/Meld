import { db, type Page, type Task } from "./db";

export type TrashItem =
  | { kind: "page"; item: Page; id: string; title: string; deletedAt: number }
  | { kind: "task"; item: Task; id: string; title: string; deletedAt: number };

export async function moveToTrash(kind: "page" | "task", id: string) {
  const now = Date.now();
  if (kind === "page") {
    await db.pages.update(id, { deletedAt: now });
  } else {
    await db.tasks.update(id, { deletedAt: now });
  }
}

export async function restoreFromTrash(kind: "page" | "task", id: string) {
  if (kind === "page") {
    await db.pages.update(id, { deletedAt: null });
  } else {
    await db.tasks.update(id, { deletedAt: null });
  }
}

export async function permanentlyDelete(kind: "page" | "task", id: string) {
  if (kind === "page") {
    await db.pages.delete(id);
  } else {
    await db.tasks.delete(id);
  }
}

export async function emptyTrash() {
  await db.transaction("rw", [db.pages, db.tasks], async () => {
    const [pagesToDelete, tasksToDelete] = await Promise.all([
      db.pages.filter((page) => !!page.deletedAt).primaryKeys(),
      db.tasks.filter((task) => !!task.deletedAt).primaryKeys(),
    ]);
    await Promise.all([db.pages.bulkDelete(pagesToDelete), db.tasks.bulkDelete(tasksToDelete)]);
  });
}

export async function getTrashItems(): Promise<TrashItem[]> {
  const [pages, tasks] = await Promise.all([
    db.pages.filter((page) => !!page.deletedAt).toArray(),
    db.tasks.filter((task) => !!task.deletedAt).toArray(),
  ]);
  return [
    ...pages.map((item) => ({
      kind: "page" as const,
      item,
      id: item.id,
      title: item.title || "Sin título",
      deletedAt: item.deletedAt!,
    })),
    ...tasks.map((item) => ({
      kind: "task" as const,
      item,
      id: item.id,
      title: item.title || "Sin título",
      deletedAt: item.deletedAt!,
    })),
  ].sort((a, b) => b.deletedAt - a.deletedAt);
}
