import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, db, newPage } from "@/lib/db";
import { mergeSnapshots, type SyncSnapshot, type SyncTableName } from "@/lib/sync-p2p";
import { hashPin, verifyPin } from "@/lib/security";
import { getAttachmentUrl } from "@/lib/attachments";

const tableNames: SyncTableName[] = [
  "pages",
  "tasks",
  "events",
  "folders",
  "tags",
  "journal",
  "attachments",
  "chats",
  "templates",
];
const snapshot = (pages: object[], tasks: object[] = []): SyncSnapshot => ({
  app: "meld",
  schema: 1,
  tables: Object.fromEntries(
    tableNames.map((name) => [name, name === "pages" ? pages : name === "tasks" ? tasks : []]),
  ) as SyncSnapshot["tables"],
});

describe("P2P sync merge", () => {
  it("adds the built-in templates to the local database", async () => {
    await db.open();
    const builtins = (await db.templates.toArray()).filter((template) => template.isBuiltin);
    expect(builtins).toHaveLength(BUILTIN_TEMPLATES.length);
  });

  it("keeps a single record per ID and selects the newest updatedAt", () => {
    const merged = mergeSnapshots(
      snapshot([
        { id: "page-1", title: "local", updatedAt: 10 },
        { id: "page-local", updatedAt: 1 },
      ]),
      snapshot([
        { id: "page-1", title: "remote", updatedAt: 20 },
        { id: "page-remote", updatedAt: 2 },
      ]),
    );

    expect(merged.tables.pages).toHaveLength(3);
    expect(merged.tables.pages.find((page) => Reflect.get(page, "id") === "page-1")).toMatchObject({
      title: "remote",
    });
  });

  it("merges tasks by ID and uses createdAt when updatedAt is unavailable", () => {
    const merged = mergeSnapshots(
      snapshot([], [{ id: "task-1", title: "old", createdAt: 1 }]),
      snapshot([], [{ id: "task-1", title: "new", createdAt: 2 }]),
    );

    expect(merged.tables.tasks).toEqual([{ id: "task-1", title: "new", createdAt: 2 }]);
  });
});

describe("local PIN hashing", () => {
  it("hashes and verifies four-digit PINs without storing their plaintext", async () => {
    const hash = await hashPin("4821");
    expect(hash).not.toBe("4821");
    expect(await verifyPin("4821", hash)).toBe(true);
    expect(await verifyPin("4822", hash)).toBe(false);
  });

  describe("page covers", () => {
    it("initializes new pages without a cover", () => {
      expect(newPage().cover).toBeNull();
    });

    it("resolves external cover URLs and returns null for missing local attachments", async () => {
      expect(await getAttachmentUrl("https://example.test/cover.jpg")).toBe(
        "https://example.test/cover.jpg",
      );
      expect(await getAttachmentUrl("attachment:missing-cover")).toBeNull();
      expect(await getAttachmentUrl(null)).toBeNull();
    });
  });

  it("rejects values that are not exactly four digits", async () => {
    await expect(hashPin("123")).rejects.toThrow("4 dígitos");
    await expect(hashPin("12a4")).rejects.toThrow("4 dígitos");
  });
});
