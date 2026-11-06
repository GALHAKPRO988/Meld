import { db, type Id, type Tag } from "./db";

/** Replaces `source` with `target` in a tag list, without duplicates. */
export function mergeTagIds(ids: Id[], source: Id, target: Id): Id[] {
  if (!ids.includes(source)) return ids;
  const out: Id[] = [];
  for (const id of ids) {
    const next = id === source ? target : id;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

/** Moves every use of `source` to `target` (pages, tasks, events) and deletes `source`. */
export async function mergeTags(source: Id, target: Id) {
  if (source === target) return;
  await db.transaction("rw", [db.tags, db.pages, db.tasks, db.events], async () => {
    for (const table of [db.pages, db.tasks, db.events] as const) {
      await (table as typeof db.pages).where("tagIds").equals(source).modify((x) => {
        x.tagIds = mergeTagIds(x.tagIds, source, target);
      });
    }
    await db.tags.delete(source);
  });
}

export async function removeTag(tag: Tag) {
  await db.transaction("rw", [db.tags, db.pages, db.tasks, db.events], async () => {
    await db.tags.delete(tag.id);
    for (const table of [db.pages, db.tasks, db.events] as const) {
      await (table as typeof db.pages).where("tagIds").equals(tag.id).modify((x) => {
        x.tagIds = x.tagIds.filter((id) => id !== tag.id);
      });
    }
  });
}
