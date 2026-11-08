import type { DataConnection } from "peerjs";
import { db } from "./db";

export type SyncStrategy = "copy" | "overwrite" | "merge";
export type SyncTableName =
  | "pages"
  | "tasks"
  | "events"
  | "folders"
  | "tags"
  | "journal"
  | "attachments"
  | "chats"
  | "templates";

export interface SyncSnapshot {
  app: "meld";
  schema: 1;
  tables: Record<SyncTableName, object[]>;
}

export interface SyncDeviceInfo {
  id: string;
  name: string;
  peerId: string;
}

export type SyncPacket =
  | { type: "hello"; strategy: SyncStrategy; device: SyncDeviceInfo; snapshot?: SyncSnapshot }
  | { type: "sync"; device: SyncDeviceInfo; snapshot: SyncSnapshot }
  | { type: "done"; device: SyncDeviceInfo }
  | { type: "chunk"; transferId: string; index: number; total: number; data: string };

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
const MAX_SNAPSHOT_BYTES = 100 * 1024 * 1024;
const CHUNK_SIZE = 12_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const stride = 0x8000;
  for (let i = 0; i < bytes.length; i += stride) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + stride, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBlob(value: string, type: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function createSyncSnapshot(): Promise<SyncSnapshot> {
  const [pages, tasks, events, folders, tags, journal, attachments, chats, templates] =
    await Promise.all([
      db.pages.toArray(),
      db.tasks.toArray(),
      db.events.toArray(),
      db.folders.toArray(),
      db.tags.toArray(),
      db.journal.toArray(),
      db.attachments.toArray(),
      db.chats.toArray(),
      db.templates.toArray(),
    ]);
  const serializedAttachments = await Promise.all(
    attachments.map(async (attachment) => ({
      id: attachment.id,
      type: attachment.type,
      name: attachment.name,
      createdAt: attachment.createdAt,
      data: bytesToBase64(new Uint8Array(await attachment.blob.arrayBuffer())),
    })),
  );
  return {
    app: "meld",
    schema: 1,
    tables: {
      pages,
      tasks,
      events,
      folders,
      tags,
      journal,
      attachments: serializedAttachments,
      chats,
      templates,
    },
  };
}

function validateSnapshot(snapshot: SyncSnapshot) {
  if (!snapshot || snapshot.app !== "meld" || snapshot.schema !== 1 || !snapshot.tables)
    throw new Error("La copia recibida no es válida.");
  for (const name of tableNames) {
    if (!Array.isArray(snapshot.tables[name]))
      throw new Error(`La copia recibida no contiene la tabla ${name}.`);
    if (snapshot.tables[name]!.length > 100_000)
      throw new Error(`La tabla ${name} supera el límite permitido.`);
  }
}

function recordDate(record: object) {
  const value =
    Reflect.get(record, "updatedAt") ??
    Reflect.get(record, "createdAt") ??
    Reflect.get(record, "start") ??
    0;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mergeRecords(local: object[], remote: object[]) {
  const byId = new Map<string, object>();
  for (const item of [...local, ...remote]) {
    const id = Reflect.get(item, "id");
    if (typeof id !== "string") continue;
    const previous = byId.get(id);
    if (
      !previous ||
      recordDate(item) > recordDate(previous) ||
      (recordDate(item) === recordDate(previous) && JSON.stringify(item) > JSON.stringify(previous))
    ) {
      byId.set(id, item);
    }
  }
  return [...byId.values()];
}

export function mergeSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncSnapshot {
  validateSnapshot(local);
  validateSnapshot(remote);
  const tables = Object.fromEntries(
    tableNames.map((name) => [name, mergeRecords(local.tables[name], remote.tables[name])]),
  ) as SyncSnapshot["tables"];
  return { app: "meld", schema: 1, tables };
}

export async function replaceDatabase(snapshot: SyncSnapshot) {
  validateSnapshot(snapshot);
  const attachments = snapshot.tables.attachments.map((entry) => {
    const data = Reflect.get(entry, "data");
    const type = Reflect.get(entry, "type");
    if (typeof data !== "string" || typeof type !== "string")
      throw new Error("Se recibió un adjunto con formato no válido.");
    const metadata = Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "data"));
    return { ...metadata, blob: base64ToBlob(data, type) };
  });
  await db.transaction("rw", db.tables, async () => {
    for (const name of tableNames) await db.table(name).clear();
    for (const name of tableNames) {
      const entries = name === "attachments" ? attachments : snapshot.tables[name];
      if (entries.length) await db.table(name).bulkPut(entries);
    }
  });
}

export async function createMergedSnapshot(remote: SyncSnapshot) {
  return mergeSnapshots(await createSyncSnapshot(), remote);
}

export async function sendSyncPacket(
  connection: DataConnection,
  packet: Exclude<SyncPacket, { type: "chunk" }>,
) {
  const serialized = JSON.stringify(packet);
  if (new Blob([serialized]).size > MAX_SNAPSHOT_BYTES)
    throw new Error("La sincronización supera el máximo de 100 MB.");
  const transferId = crypto.randomUUID();
  const total = Math.ceil(serialized.length / CHUNK_SIZE);
  for (let index = 0; index < total; index++) {
    connection.send({
      type: "chunk",
      transferId,
      index,
      total,
      data: serialized.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    } satisfies SyncPacket);
    if (index % 64 === 63) await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export class SyncPacketAssembler {
  private transfers = new Map<
    string,
    { parts: string[]; received: number; total: number; size: number }
  >();

  add(value: unknown): Exclude<SyncPacket, { type: "chunk" }> | null {
    if (!value || typeof value !== "object") throw new Error("Se recibió un fragmento no válido.");
    if (Reflect.get(value, "type") !== "chunk")
      throw new Error("Se recibió un tipo de mensaje P2P desconocido.");
    const transferId = Reflect.get(value, "transferId");
    const index = Reflect.get(value, "index");
    const total = Reflect.get(value, "total");
    const data = Reflect.get(value, "data");
    if (
      typeof transferId !== "string" ||
      transferId.length > 128 ||
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      typeof total !== "number" ||
      !Number.isInteger(total) ||
      total < 1 ||
      total > 10_000 ||
      index < 0 ||
      index >= total ||
      typeof data !== "string"
    ) {
      throw new Error("Se recibió un fragmento de sincronización no válido.");
    }
    let transfer = this.transfers.get(transferId);
    if (!transfer) {
      transfer = { parts: new Array<string>(total), received: 0, total, size: 0 };
      this.transfers.set(transferId, transfer);
    }
    if (transfer.total !== total) throw new Error("Los fragmentos de sincronización no coinciden.");
    if (transfer.parts[index] === undefined) {
      transfer.size += new Blob([data]).size;
      if (transfer.size > MAX_SNAPSHOT_BYTES) {
        this.transfers.delete(transferId);
        throw new Error("La copia recibida supera el máximo de 100 MB.");
      }
      transfer.parts[index] = data;
      transfer.received++;
    }
    if (transfer.received !== transfer.total) return null;
    this.transfers.delete(transferId);
    const packet: unknown = JSON.parse(transfer.parts.join(""));
    if (
      !packet ||
      typeof packet !== "object" ||
      !["hello", "sync", "done"].includes((packet as { type?: string }).type ?? "")
    ) {
      throw new Error("El mensaje de sincronización recibido no es válido.");
    }
    return packet as Exclude<SyncPacket, { type: "chunk" }>;
  }
}
