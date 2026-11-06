import Dexie, { type EntityTable } from "dexie";

export type Id = string;

export interface Page {
  id: Id;
  title: string;
  icon: string;
  html: string;
  markdown: string;
  folderId: Id | null;
  tagIds: Id[];
  pinned: 0 | 1;
  createdAt: number;
  updatedAt: number;
}

export type Priority = 1 | 2 | 3 | 4;
export type Repeat = "none" | "daily" | "weekly" | "monthly" | "custom";

export interface Subtask {
  id: Id;
  title: string;
  done: boolean;
}

export interface Task {
  id: Id;
  title: string;
  notes: string;
  due: number | null; // epoch ms
  hasTime: boolean;
  priority: Priority;
  subtasks: Subtask[];
  pinned?: boolean;
  tagIds: Id[];
  folderId: Id | null;
  status: "todo" | "done";
  completedAt: number | null;
  repeat: Repeat;
  repeatEveryDays?: number;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export interface CalendarEvent {
  id: Id;
  title: string;
  start: number;
  end: number;
  allDay: boolean;
  color: string;
  repeat: Repeat;
  description: string;
  tagIds: Id[];
  reminderMinutes: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Folder {
  id: Id;
  name: string;
  icon: string;
  color: string;
  parentId: Id | null;
  createdAt: number;
}

export interface Tag {
  id: Id;
  name: string;
  color: string;
  createdAt: number;
}

export interface JournalEntry {
  id: string; // yyyy-mm-dd
  html: string;
  markdown: string;
  mood: string | null;
  updatedAt: number;
}

export interface Attachment {
  id: Id;
  blob: Blob;
  type: string;
  name: string;
  createdAt: number;
}

export interface StoredChatMessage {
  id: Id;
  role: "user" | "assistant";
  text: string;
}

export interface StoredChat {
  id: Id;
  title: string;
  messages: StoredChatMessage[];
  updatedAt: number;
}

export class MeldDB extends Dexie {
  pages!: EntityTable<Page, "id">;
  tasks!: EntityTable<Task, "id">;
  events!: EntityTable<CalendarEvent, "id">;
  folders!: EntityTable<Folder, "id">;
  tags!: EntityTable<Tag, "id">;
  journal!: EntityTable<JournalEntry, "id">;
  attachments!: EntityTable<Attachment, "id">;
  chats!: EntityTable<StoredChat, "id">;

  constructor() {
    super("meld");
    this.version(1).stores({
      pages: "id, title, folderId, *tagIds, pinned, updatedAt",
      tasks: "id, status, due, priority, folderId, *tagIds, order, updatedAt",
      events: "id, start, end, *tagIds",
      folders: "id, parentId, name",
      tags: "id, &name",
      journal: "id, updatedAt",
      attachments: "id",
    });
    this.version(2).stores({
      pages: "id, title, folderId, *tagIds, pinned, updatedAt",
      tasks: "id, status, due, priority, folderId, *tagIds, order, updatedAt",
      events: "id, start, end, *tagIds",
      folders: "id, parentId, name",
      tags: "id, &name",
      journal: "id, updatedAt",
      attachments: "id",
      chats: "id, updatedAt",
    });
    // Solo se ejecuta la primera vez que se crea la base de datos (usuarios nuevos).
    this.on("populate", (tx) => {
      const now = Date.now();
      const md = `# Bienvenido a Meld 👋

Tu organizador personal. Todo se guarda **solo en tu dispositivo**.

## Primeros pasos
- Escribe **/** en una página para insertar títulos, listas, tablas, fórmulas…
- Usa **[[** para enlazar a otra página.
- Organiza todo en **Carpetas** y **Tags**.
- Planifica en **Tareas** y **Calendario**.
- Activa el **Diario** desde el menú si quieres escribir cada día.

## Asistente IA
Añade tu clave en **Ajustes** y pídele que cree tareas, páginas o eventos por ti. Con la llave inglesa eliges a qué secciones puede acceder.

Puedes borrar esta página cuando quieras.`;
      const html = `<h1>Bienvenido a Meld 👋</h1><p>Tu organizador personal. Todo se guarda <strong>solo en tu dispositivo</strong>.</p><h2>Primeros pasos</h2><ul><li><p>Escribe <strong>/</strong> en una página para insertar títulos, listas, tablas, fórmulas…</p></li><li><p>Usa <strong>[[</strong> para enlazar a otra página.</p></li><li><p>Organiza todo en <strong>Carpetas</strong> y <strong>Tags</strong>.</p></li><li><p>Planifica en <strong>Tareas</strong> y <strong>Calendario</strong>.</p></li><li><p>Activa el <strong>Diario</strong> desde el menú si quieres escribir cada día.</p></li></ul><h2>Asistente IA</h2><p>Añade tu clave en <strong>Ajustes</strong> y pídele que cree tareas, páginas o eventos por ti. Con la llave inglesa eliges a qué secciones puede acceder.</p><p>Puedes borrar esta página cuando quieras.</p>`;
      void tx.table("pages").add(newPage({ title: "Bienvenido a Meld", icon: "👋", html, markdown: md, pinned: 1 }));
      void tx.table("tasks").bulkAdd([
        newTask({ title: "Explora Meld", priority: 2, due: now, order: now }),
        newTask({ title: "Configura tu asistente IA en Ajustes", priority: 3, order: now + 1 }),
      ]);
    });
  }
}

export const db = new MeldDB();

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function newPage(partial: Partial<Page> = {}): Page {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    icon: "📄",
    html: "",
    markdown: "",
    folderId: null,
    tagIds: [],
    pinned: 0,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function newTask(partial: Partial<Task> = {}): Task {
  const now = Date.now();
  return {
    id: uid(),
    title: "",
    notes: "",
    due: null,
    hasTime: false,
    priority: 4,
    subtasks: [],
    pinned: false,
    tagIds: [],
    folderId: null,
    status: "todo",
    completedAt: null,
    repeat: "none",
    order: now,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export const TAG_COLORS = [
  "oklch(0.72 0.15 40)",
  "oklch(0.78 0.14 75)",
  "oklch(0.72 0.14 155)",
  "oklch(0.7 0.11 240)",
  "oklch(0.68 0.15 300)",
  "oklch(0.7 0.16 350)",
  "oklch(0.65 0.02 150)",
];

export async function ensureTag(name: string): Promise<Tag> {
  const clean = name.trim().replace(/^#/, "");
  const existing = await db.tags.where("name").equalsIgnoreCase(clean).first();
  if (existing) return existing;
  const count = await db.tags.count();
  const tag: Tag = { id: uid(), name: clean, color: TAG_COLORS[count % TAG_COLORS.length] ?? "oklch(0.72 0.15 40)", createdAt: Date.now() };
  await db.tags.add(tag);
  return tag;
}
