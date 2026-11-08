import { db, type Folder, type Id } from "./db";

const byName = (a: Folder, b: Folder) => a.name.localeCompare(b.name, "es");

export const childrenOf = (folders: Folder[], parentId: Id | null) =>
  folders.filter((f) => (f.parentId ?? null) === parentId).sort(byName);

/** Every folder nested (at any depth) under `id`, not including `id`. */
export function descendantIds(folders: Folder[], id: Id): Set<Id> {
  const out = new Set<Id>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const f of folders) {
      if (f.parentId === cur && !out.has(f.id)) {
        out.add(f.id);
        stack.push(f.id);
      }
    }
  }
  return out;
}

/** Root → … → folder. Empty for null/unknown ids. */
export function folderPath(folders: Folder[], id: Id | null): Folder[] {
  const path: Folder[] = [];
  const seen = new Set<Id>();
  let cur = id ? folders.find((f) => f.id === id) : undefined;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
  }
  return path;
}

/** A folder can't be moved into itself or into one of its own subfolders. */
export function canMoveFolder(folders: Folder[], id: Id, newParent: Id | null): boolean {
  if (newParent === null) return true;
  if (newParent === id) return false;
  return !descendantIds(folders, id).has(newParent);
}

/** Depth-first, alphabetical flattening for tree views. `collapsed` hides a folder's children. */
export function flattenTree(
  folders: Folder[],
  collapsed: Set<Id> = new Set(),
): { folder: Folder; depth: number; hasChildren: boolean }[] {
  const out: { folder: Folder; depth: number; hasChildren: boolean }[] = [];
  const walk = (parent: Id | null, depth: number) => {
    for (const f of childrenOf(folders, parent)) {
      const kids = folders.some((c) => c.parentId === f.id);
      out.push({ folder: f, depth, hasChildren: kids });
      if (!collapsed.has(f.id)) walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export async function moveFolder(id: Id, parentId: Id | null) {
  const folders = await db.folders.toArray();
  if (!canMoveFolder(folders, id, parentId))
    throw new Error("No puedes mover una carpeta dentro de sí misma");
  await db.folders.update(id, { parentId, updatedAt: Date.now() });
}

/** Deletes a folder; its subfolders, pages and tasks move up to its parent. Returns an undo. */
export async function deleteFolder(id: Id): Promise<() => Promise<void>> {
  const folder = await db.folders.get(id);
  if (!folder) return async () => {};
  const parent = folder.parentId ?? null;
  const [subs, pages, tasks] = await Promise.all([
    db.folders.where("parentId").equals(id).primaryKeys(),
    db.pages.where("folderId").equals(id).primaryKeys(),
    db.tasks.where("folderId").equals(id).primaryKeys(),
  ]);
  await db.transaction("rw", [db.folders, db.pages, db.tasks], async () => {
    await db.folders
      .where("parentId")
      .equals(id)
      .modify({ parentId: parent, updatedAt: Date.now() });
    await db.pages.where("folderId").equals(id).modify({ folderId: parent });
    await db.tasks.where("folderId").equals(id).modify({ folderId: parent });
    await db.folders.delete(id);
  });
  return async () => {
    await db.transaction("rw", [db.folders, db.pages, db.tasks], async () => {
      await db.folders.put(folder);
      await db.folders.bulkUpdate(subs.map((key) => ({ key, changes: { parentId: id } })));
      await db.pages.bulkUpdate(pages.map((key) => ({ key, changes: { folderId: id } })));
      await db.tasks.bulkUpdate(tasks.map((key) => ({ key, changes: { folderId: id } })));
    });
  };
}
