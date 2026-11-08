import { db } from "./db";

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

export async function exportAll() {
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
  const att = await Promise.all(
    attachments.map(async (a) => ({
      id: a.id,
      type: a.type,
      name: a.name,
      createdAt: a.createdAt,
      data: await blobToDataUrl(a.blob),
    })),
  );
  return {
    app: "meld",
    version: 1,
    exportedAt: new Date().toISOString(),
    pages,
    tasks,
    events,
    folders,
    tags,
    journal,
    attachments: att,
    chats,
    templates,
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);
const safe = (s: string) => (s || "Sin título").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80);

export async function downloadJson() {
  const data = await exportAll();
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    `meld-${stamp()}.json`,
  );
}

export async function downloadZip() {
  const { default: JSZip } = await import("jszip");
  const data = await exportAll();
  const zip = new JSZip();
  const folderPath = (id: string | null): string => {
    if (!id) return "";
    const f = data.folders.find((x) => x.id === id);
    return f ? `${folderPath(f.parentId)}${safe(f.name)}/` : "";
  };
  const used = new Set<string>();
  for (const p of data.pages) {
    let path = `paginas/${folderPath(p.folderId)}${safe(p.title)}.md`;
    let n = 2;
    while (used.has(path)) path = path.replace(/( \(\d+\))?\.md$/, ` (${n++}).md`);
    used.add(path);
    zip.file(path, `# ${p.title || "Sin título"}\n\n${p.markdown}`);
  }
  for (const j of data.journal) zip.file(`diario/${j.id}.md`, j.markdown);
  zip.file("meld.json", JSON.stringify(data, null, 2));
  const blob = await zip.generateAsync({ type: "blob" });
  download(blob, `meld-${stamp()}.zip`);
}

export async function importJson(file: File) {
  const data = JSON.parse(await file.text());
  if (data?.app !== "meld") throw new Error("Este archivo no es una copia de Meld.");
  const attachments = await Promise.all(
    (data.attachments ?? []).map(
      async (a: { id: string; type: string; name: string; createdAt: number; data: string }) => ({
        id: a.id,
        type: a.type,
        name: a.name,
        createdAt: a.createdAt,
        blob: await (await fetch(a.data)).blob(),
      }),
    ),
  );
  await db.transaction(
    "rw",
    [
      db.pages,
      db.tasks,
      db.events,
      db.folders,
      db.tags,
      db.journal,
      db.attachments,
      db.chats,
      db.templates,
    ],
    async () => {
      await db.pages.bulkPut(data.pages ?? []);
      await db.tasks.bulkPut(data.tasks ?? []);
      await db.events.bulkPut(data.events ?? []);
      await db.folders.bulkPut(data.folders ?? []);
      await db.tags.bulkPut(data.tags ?? []);
      await db.journal.bulkPut(data.journal ?? []);
      await db.attachments.bulkPut(attachments);
      await db.chats.bulkPut(data.chats ?? []);
      await db.templates.bulkPut(data.templates ?? []);
    },
  );
}

export async function wipeAll() {
  await Promise.all(
    db.tables.filter((table) => table.name !== "templates").map((table) => table.clear()),
  );
  const customTemplateIds = await db.templates
    .filter((template) => !template.isBuiltin)
    .primaryKeys();
  await db.templates.bulkDelete(customTemplateIds);
}
