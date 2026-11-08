import Dexie, { type EntityTable } from "dexie";

export type Id = string;

export interface Page {
  id: Id;
  title: string;
  icon: string;
  cover?: string | null;
  html: string;
  markdown: string;
  folderId: Id | null;
  tagIds: Id[];
  pinned: 0 | 1;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
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
  deletedAt?: number | null;
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
  updatedAt?: number;
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

export interface Template {
  id: Id;
  title: string;
  description: string;
  icon: string;
  category: string;
  html: string;
  markdown: string;
  isBuiltin: boolean;
  createdAt: number;
}

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin-meeting-1-1",
    title: "Reunión 1:1",
    description: "Objetivos, temas, notas y acuerdos de acción.",
    icon: "🤝",
    category: "Trabajo",
    markdown:
      "## Objetivos\n\n## Temas a tratar\n\n## Notas conjuntas\n\n## Acuerdos de acción\n- [ ] ",
    html: '<h2>Objetivos</h2><p></p><h2>Temas a tratar</h2><ul><li><p></p></li></ul><h2>Notas conjuntas</h2><p></p><h2>Acuerdos de acción</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>',
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: "builtin-gratitude-journal",
    title: "Diario de gratitud y reflexión",
    description: "Agradecimientos, el mejor momento y un aprendizaje.",
    icon: "🌱",
    category: "Personal",
    markdown:
      "## 3 cosas que agradezco\n1. \n2. \n3. \n\n## Mi mejor momento del día\n\n## Qué aprendí",
    html: "<h2>3 cosas que agradezco</h2><ol><li><p></p></li><li><p></p></li><li><p></p></li></ol><h2>Mi mejor momento del día</h2><p></p><h2>Qué aprendí</h2><p></p>",
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: "builtin-weekly-planning",
    title: "Planificación semanal",
    description: "Prioridades, plan por días y seguimiento.",
    icon: "🗓️",
    category: "Organización",
    markdown:
      "## Prioridades de la semana\n- [ ] \n- [ ] \n- [ ] \n\n## Plan por días\n### Lunes\n\n### Martes\n\n### Miércoles\n\n### Jueves\n\n### Viernes\n\n## Notas de seguimiento",
    html: '<h2>Prioridades de la semana</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul><h2>Plan por días</h2><h3>Lunes</h3><p></p><h3>Martes</h3><p></p><h3>Miércoles</h3><p></p><h3>Jueves</h3><p></p><h3>Viernes</h3><p></p><h2>Notas de seguimiento</h2><p></p>',
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: "builtin-recipe",
    title: "Receta de cocina",
    description: "Tiempo, porciones, ingredientes y preparación.",
    icon: "🍲",
    category: "Personal",
    markdown:
      "## Tiempo y porciones\n- Tiempo: \n- Porciones: \n\n## Ingredientes\n- [ ] \n\n## Preparación\n1. ",
    html: '<h2>Tiempo y porciones</h2><ul><li><p>Tiempo: </p></li><li><p>Porciones: </p></li></ul><h2>Ingredientes</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul><h2>Preparación</h2><ol><li><p></p></li></ol>',
    isBuiltin: true,
    createdAt: 0,
  },
  {
    id: "builtin-brainstorm",
    title: "Lluvia de ideas",
    description: "Pregunta detonante, ideas, votación y próximos pasos.",
    icon: "💡",
    category: "Trabajo",
    markdown:
      "## Pregunta detonante\n\n## Ideas locas\n- \n\n## Votación\n\n## Próximos pasos\n- [ ] ",
    html: '<h2>Pregunta detonante</h2><p></p><h2>Ideas locas</h2><ul><li><p></p></li></ul><h2>Votación</h2><p></p><h2>Próximos pasos</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p></p></div></li></ul>',
    isBuiltin: true,
    createdAt: 0,
  },
];

export class MeldDB extends Dexie {
  pages!: EntityTable<Page, "id">;
  tasks!: EntityTable<Task, "id">;
  events!: EntityTable<CalendarEvent, "id">;
  folders!: EntityTable<Folder, "id">;
  tags!: EntityTable<Tag, "id">;
  journal!: EntityTable<JournalEntry, "id">;
  attachments!: EntityTable<Attachment, "id">;
  chats!: EntityTable<StoredChat, "id">;
  templates!: EntityTable<Template, "id">;

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
    this.version(3)
      .stores({
        pages: "id, title, folderId, *tagIds, pinned, updatedAt",
        tasks: "id, status, due, priority, folderId, *tagIds, order, updatedAt",
        events: "id, start, end, *tagIds, updatedAt",
        folders: "id, parentId, name",
        tags: "id, &name",
        journal: "id, updatedAt",
        attachments: "id",
        chats: "id, updatedAt",
        templates: "id, title, category, isBuiltin, createdAt",
      })
      .upgrade((tx) =>
        tx
          .table("templates")
          .bulkPut(BUILTIN_TEMPLATES.map((template) => ({ ...template, createdAt: Date.now() }))),
      );
    this.version(4).stores({
      pages: "id, title, folderId, *tagIds, pinned, updatedAt, deletedAt",
      tasks: "id, status, due, priority, folderId, *tagIds, order, updatedAt, deletedAt",
      events: "id, start, end, *tagIds, updatedAt",
      folders: "id, parentId, name",
      tags: "id, &name",
      journal: "id, updatedAt",
      attachments: "id",
      chats: "id, updatedAt",
      templates: "id, title, category, isBuiltin, createdAt",
    });
    // Solo se ejecuta la primera vez que se crea la base de datos (usuarios nuevos).
    this.on("populate", (tx) => {
      const now = Date.now();
      const md = `# Bienvenido a Meld 👋

Tu organizador personal. Todo se guarda localmente; si quieres, puedes sincronizar directamente con tus otros dispositivos desde Ajustes.

## Primeros pasos
- Escribe **/** en una página para insertar títulos, listas, tablas, fórmulas…
- Usa **[[** para enlazar a otra página.
- Organiza todo en **Carpetas** y **Tags**.
- Planifica en **Tareas** y **Calendario**.
- Activa el **Diario** desde el menú si quieres escribir cada día.

## Asistente IA
Añade tu clave en **Ajustes** y pídele que cree tareas, páginas o eventos por ti. Con la llave inglesa eliges a qué secciones puede acceder.

Puedes borrar esta página cuando quieras.`;
      const html = `<h1>Bienvenido a Meld 👋</h1><p>Tu organizador personal. Todo se guarda localmente; si quieres, puedes sincronizar directamente con tus otros dispositivos desde Ajustes.</p><h2>Primeros pasos</h2><ul><li><p>Escribe <strong>/</strong> en una página para insertar títulos, listas, tablas, fórmulas…</p></li><li><p>Usa <strong>[[</strong> para enlazar a otra página.</p></li><li><p>Organiza todo en <strong>Carpetas</strong> y <strong>Tags</strong>.</p></li><li><p>Planifica en <strong>Tareas</strong> y <strong>Calendario</strong>.</p></li><li><p>Activa el <strong>Diario</strong> desde el menú si quieres escribir cada día.</p></li></ul><h2>Asistente IA</h2><p>Añade tu clave en <strong>Ajustes</strong> y pídele que cree tareas, páginas o eventos por ti. Con la llave inglesa eliges a qué secciones puede acceder.</p><p>Puedes borrar esta página cuando quieras.</p>`;
      void tx
        .table("pages")
        .add(newPage({ title: "Bienvenido a Meld", icon: "👋", html, markdown: md, pinned: 1 }));
      void tx
        .table("tasks")
        .bulkAdd([
          newTask({ title: "Explora Meld", priority: 2, due: now, order: now }),
          newTask({ title: "Configura tu asistente IA en Ajustes", priority: 3, order: now + 1 }),
        ]);
      void tx
        .table("templates")
        .bulkAdd(BUILTIN_TEMPLATES.map((template) => ({ ...template, createdAt: now })));
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
    cover: null,
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
  const tag: Tag = {
    id: uid(),
    name: clean,
    color: TAG_COLORS[count % TAG_COLORS.length] ?? "oklch(0.72 0.15 40)",
    createdAt: Date.now(),
  };
  await db.tags.add(tag);
  return tag;
}
