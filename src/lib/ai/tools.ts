import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { db, ensureTag, newPage, newTask, uid, type Task } from "@/lib/db";
import { htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import { assertJournalEditable } from "@/lib/journal";
import type { AccessMap } from "@/lib/settings";
import { moveToTrash, restoreFromTrash } from "@/lib/trash";

export interface AiAction {
  id: string;
  title: string;
  detail: string;
  undo: () => Promise<void>;
}

type Report = (a: Omit<AiAction, "id">) => void;

const fmt = (ms: number | null, withTime = true) =>
  ms == null
    ? null
    : new Date(ms).toLocaleString(
        "es-ES",
        withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
      );

function taskView(t: Task) {
  return {
    id: t.id,
    titulo: t.title,
    estado: t.status === "done" ? "completada" : "pendiente",
    vence: t.due ? new Date(t.due).toISOString() : null,
    prioridad: t.priority,
    notas: t.notes || undefined,
    subtareas: t.subtasks.length
      ? t.subtasks.map((s) => `${s.done ? "[x]" : "[ ]"} ${s.title}`)
      : undefined,
  };
}

const parseDate = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

/** Builds the toolset strictly from the sections the user granted. */
export function buildTools(access: AccessMap, report: Report): ToolSet {
  const tools: ToolSet = {};
  const can = (s: keyof AccessMap) => access[s].enabled;
  const canWrite = (s: keyof AccessMap) => access[s].enabled && access[s].mode === "write";

  /* ---------- Tareas ---------- */
  if (can("tareas")) {
    tools["listar_tareas"] = tool({
      description:
        "Lista las tareas del usuario. Filtros: hoy, proximas, todas, completadas. Opcionalmente busca por texto.",
      inputSchema: z.object({
        filtro: z.enum(["hoy", "proximas", "todas", "completadas"]).default("todas"),
        busqueda: z.string().optional(),
      }),
      execute: async ({ filtro, busqueda }) => {
        const all = (await db.tasks.toArray()).filter((task) => !task.deletedAt);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        let list = all.filter((t) =>
          filtro === "completadas" ? t.status === "done" : t.status !== "done",
        );
        if (filtro === "hoy") list = list.filter((t) => t.due && t.due <= end.getTime());
        if (filtro === "proximas") list = list.filter((t) => t.due && t.due > end.getTime());
        if (busqueda)
          list = list.filter((t) => t.title.toLowerCase().includes(busqueda.toLowerCase()));
        return list.slice(0, 50).map(taskView);
      },
    });
    if (canWrite("tareas")) {
      tools["crear_tarea"] = tool({
        description: "Crea una tarea. fecha en ISO 8601 (con hora si se indica).",
        inputSchema: z.object({
          titulo: z.string(),
          fecha: z.string().nullable().optional(),
          con_hora: z.boolean().optional(),
          prioridad: z.number().int().min(1).max(4).optional(),
          notas: z.string().optional(),
        }),
        execute: async ({ titulo, fecha, con_hora, prioridad, notas }) => {
          const t = newTask({
            title: titulo,
            due: parseDate(fecha),
            hasTime: !!con_hora,
            priority: (prioridad ?? 4) as Task["priority"],
            notes: notas ?? "",
          });
          await db.tasks.add(t);
          report({
            title: "Tarea creada",
            detail: `${titulo}${t.due ? ` · ${fmt(t.due, t.hasTime)}` : ""}`,
            undo: async () => void (await db.tasks.delete(t.id)),
          });
          return { ok: true, id: t.id };
        },
      });
      tools["completar_tarea"] = tool({
        description: "Marca una tarea como completada (o pendiente si completada=false).",
        inputSchema: z.object({ id: z.string(), completada: z.boolean().default(true) }),
        execute: async ({ id, completada }) => {
          const before = await db.tasks.get(id);
          if (!before || before.deletedAt) return { ok: false, error: "No existe" };
          await db.tasks.update(id, {
            status: completada ? "done" : "todo",
            completedAt: completada ? Date.now() : null,
            updatedAt: Date.now(),
          });
          report({
            title: completada ? "Tarea completada" : "Tarea reabierta",
            detail: before.title,
            undo: async () => void (await db.tasks.put(before)),
          });
          return { ok: true };
        },
      });
      tools["editar_tarea"] = tool({
        description: "Edita título, fecha, prioridad o notas de una tarea existente.",
        inputSchema: z.object({
          id: z.string(),
          titulo: z.string().optional(),
          fecha: z.string().nullable().optional(),
          prioridad: z.number().int().min(1).max(4).optional(),
          notas: z.string().optional(),
        }),
        execute: async ({ id, titulo, fecha, prioridad, notas }) => {
          const before = await db.tasks.get(id);
          if (!before || before.deletedAt) return { ok: false, error: "No existe" };
          await db.tasks.update(id, {
            ...(titulo !== undefined && { title: titulo }),
            ...(fecha !== undefined && { due: parseDate(fecha) }),
            ...(prioridad !== undefined && { priority: prioridad as Task["priority"] }),
            ...(notas !== undefined && { notes: notas }),
            updatedAt: Date.now(),
          });
          report({
            title: "Tarea editada",
            detail: titulo ?? before.title,
            undo: async () => void (await db.tasks.put(before)),
          });
          return { ok: true };
        },
      });
      tools["eliminar_tarea"] = tool({
        description: "Mueve una tarea a la papelera.",
        inputSchema: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          const before = await db.tasks.get(id);
          if (!before || before.deletedAt) return { ok: false, error: "No existe" };
          await moveToTrash("task", id);
          report({
            title: "Tarea movida a la papelera",
            detail: before.title,
            undo: async () => void (await restoreFromTrash("task", id)),
          });
          return { ok: true };
        },
      });
    }
  }

  /* ---------- Páginas ---------- */
  if (can("paginas")) {
    tools["buscar_paginas"] = tool({
      description: "Busca páginas por título o contenido. Devuelve id, título y un fragmento.",
      inputSchema: z.object({ consulta: z.string().default("") }),
      execute: async ({ consulta }) => {
        const q = consulta.toLowerCase();
        const pages = (await db.pages.orderBy("updatedAt").reverse().toArray()).filter(
          (page) => !page.deletedAt,
        );
        return pages
          .filter(
            (p) => !q || p.title.toLowerCase().includes(q) || p.markdown.toLowerCase().includes(q),
          )
          .slice(0, 20)
          .map((p) => ({
            id: p.id,
            titulo: p.title || "Sin título",
            fragmento: p.markdown.slice(0, 200),
          }));
      },
    });
    tools["leer_pagina"] = tool({
      description: "Lee el contenido completo en Markdown de una página.",
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id }) => {
        const p = await db.pages.get(id);
        return p && !p.deletedAt
          ? { id: p.id, titulo: p.title, markdown: p.markdown }
          : { error: "No existe" };
      },
    });
    if (canWrite("paginas")) {
      tools["crear_pagina"] = tool({
        description:
          "Crea una página nueva con contenido en Markdown. Elige siempre un emoji representativo del tema como icono.",
        inputSchema: z.object({
          titulo: z.string(),
          markdown: z.string().default(""),
          icono: z.string().optional(),
        }),
        execute: async ({ titulo, markdown, icono }) => {
          const html = markdownToHtml(markdown);
          const p = newPage({
            title: titulo,
            html,
            markdown: htmlToMarkdown(html),
            icon: icono ?? "📄",
          });
          await db.pages.add(p);
          report({
            title: "Página creada",
            detail: titulo,
            undo: async () => void (await db.pages.delete(p.id)),
          });
          return { ok: true, id: p.id };
        },
      });
      tools["cambiar_icono_pagina"] = tool({
        description: "Cambia el icono (un emoji) de una página existente.",
        inputSchema: z.object({ id: z.string(), icono: z.string().min(1).max(16) }),
        execute: async ({ id, icono }) => {
          const before = await db.pages.get(id);
          if (!before || before.deletedAt) return { ok: false, error: "No existe" };
          await db.pages.update(id, { icon: icono, updatedAt: Date.now() });
          report({
            title: "Icono cambiado",
            detail: `${icono} ${before.title || "Sin título"}`,
            undo: async () => void (await db.pages.update(id, { icon: before.icon })),
          });
          return { ok: true };
        },
      });
      tools["anadir_a_pagina"] = tool({
        description: "Añade contenido Markdown al final de una página existente.",
        inputSchema: z.object({ id: z.string(), markdown: z.string() }),
        execute: async ({ id, markdown }) => {
          const before = await db.pages.get(id);
          if (!before || before.deletedAt) return { ok: false, error: "No existe" };
          const html = before.html + markdownToHtml(markdown);
          await db.pages.update(id, {
            html,
            markdown: htmlToMarkdown(html),
            updatedAt: Date.now(),
          });
          report({
            title: "Página actualizada",
            detail: before.title || "Sin título",
            undo: async () => void (await db.pages.put(before)),
          });
          return { ok: true };
        },
      });
    }
  }

  /* ---------- Calendario ---------- */
  if (can("calendario")) {
    tools["listar_eventos"] = tool({
      description: "Lista eventos del calendario entre dos fechas ISO.",
      inputSchema: z.object({ desde: z.string(), hasta: z.string() }),
      execute: async ({ desde, hasta }) => {
        const a = parseDate(desde) ?? 0;
        const b = parseDate(hasta) ?? Date.now() + 864e5 * 30;
        const evs = await db.events.where("start").between(a, b, true, true).toArray();
        return evs.map((e) => ({
          id: e.id,
          titulo: e.title,
          inicio: new Date(e.start).toISOString(),
          fin: new Date(e.end).toISOString(),
          todo_el_dia: e.allDay,
        }));
      },
    });
    if (canWrite("calendario")) {
      tools["crear_evento"] = tool({
        description: "Crea un evento en el calendario. Fechas en ISO 8601.",
        inputSchema: z.object({
          titulo: z.string(),
          inicio: z.string(),
          fin: z.string().optional(),
          todo_el_dia: z.boolean().optional(),
          descripcion: z.string().optional(),
        }),
        execute: async ({ titulo, inicio, fin, todo_el_dia, descripcion }) => {
          const start = parseDate(inicio) ?? Date.now();
          const now = Date.now();
          const ev = {
            id: uid(),
            title: titulo,
            start,
            end: parseDate(fin) ?? start + 3600_000,
            allDay: !!todo_el_dia,
            color: "oklch(0.72 0.15 40)",
            repeat: "none" as const,
            description: descripcion ?? "",
            tagIds: [],
            reminderMinutes: null,
            createdAt: now,
            updatedAt: now,
          };
          await db.events.add(ev);
          report({
            title: "Evento creado",
            detail: `${titulo} · ${fmt(start, !todo_el_dia)}`,
            undo: async () => void (await db.events.delete(ev.id)),
          });
          return { ok: true, id: ev.id };
        },
      });
    }
  }

  /* ---------- Carpetas ---------- */
  if (can("carpetas")) {
    tools["listar_carpetas"] = tool({
      description: "Lista las carpetas del usuario.",
      inputSchema: z.object({}),
      execute: async () =>
        (await db.folders.toArray()).map((f) => ({ id: f.id, nombre: f.name, padre: f.parentId })),
    });
    if (canWrite("carpetas")) {
      tools["crear_carpeta"] = tool({
        description: "Crea una carpeta.",
        inputSchema: z.object({
          nombre: z.string(),
          icono: z.string().optional(),
          padre_id: z.string().nullable().optional(),
        }),
        execute: async ({ nombre, icono, padre_id }) => {
          const now = Date.now();
          const f = {
            id: uid(),
            name: nombre,
            icon: icono ?? "📁",
            color: "oklch(0.72 0.15 40)",
            parentId: padre_id ?? null,
            createdAt: now,
            updatedAt: now,
          };
          await db.folders.add(f);
          report({
            title: "Carpeta creada",
            detail: nombre,
            undo: async () => void (await db.folders.delete(f.id)),
          });
          return { ok: true, id: f.id };
        },
      });
    }
  }

  /* ---------- Tags ---------- */
  if (can("tags")) {
    tools["listar_tags"] = tool({
      description: "Lista los tags.",
      inputSchema: z.object({}),
      execute: async () => (await db.tags.toArray()).map((t) => ({ id: t.id, nombre: t.name })),
    });
    if (canWrite("tags")) {
      tools["crear_tag"] = tool({
        description: "Crea un tag.",
        inputSchema: z.object({ nombre: z.string() }),
        execute: async ({ nombre }) => {
          const existed = await db.tags.where("name").equalsIgnoreCase(nombre).first();
          const t = await ensureTag(nombre);
          if (!existed)
            report({
              title: "Tag creado",
              detail: `#${t.name}`,
              undo: async () => void (await db.tags.delete(t.id)),
            });
          return { ok: true, id: t.id };
        },
      });
    }
  }

  /* ---------- Diario ---------- */
  if (can("diario")) {
    tools["leer_diario"] = tool({
      description: "Lee la entrada del diario de un día (yyyy-mm-dd).",
      inputSchema: z.object({ fecha: z.string() }),
      execute: async ({ fecha }) => {
        const e = await db.journal.get(fecha);
        return e ? { fecha, animo: e.mood, markdown: e.markdown } : { fecha, vacio: true };
      },
    });
    if (canWrite("diario")) {
      tools["escribir_diario"] = tool({
        description: "Añade texto Markdown a la entrada del diario de un día (yyyy-mm-dd).",
        inputSchema: z.object({ fecha: z.string(), markdown: z.string() }),
        execute: async ({ fecha, markdown }) => {
          assertJournalEditable(fecha);
          const before = await db.journal.get(fecha);
          const html = (before?.html ?? "") + markdownToHtml(markdown);
          assertJournalEditable(fecha);
          await db.journal.put({
            id: fecha,
            html,
            markdown: htmlToMarkdown(html),
            mood: before?.mood ?? null,
            updatedAt: Date.now(),
          });
          report({
            title: "Diario actualizado",
            detail: fecha,
            undo: async () => {
              assertJournalEditable(fecha);
              if (before) await db.journal.put(before);
              else await db.journal.delete(fecha);
            },
          });
          return { ok: true };
        },
      });
    }
  }

  return tools;
}

export const TOOL_LABELS: Record<string, string> = {
  listar_tareas: "Consultando tareas",
  crear_tarea: "Creando tarea",
  completar_tarea: "Completando tarea",
  editar_tarea: "Editando tarea",
  eliminar_tarea: "Eliminando tarea",
  buscar_paginas: "Buscando páginas",
  leer_pagina: "Leyendo página",
  crear_pagina: "Creando página",
  cambiar_icono_pagina: "Cambiando icono",
  anadir_a_pagina: "Editando página",
  listar_eventos: "Consultando calendario",
  crear_evento: "Creando evento",
  listar_carpetas: "Consultando carpetas",
  crear_carpeta: "Creando carpeta",
  listar_tags: "Consultando tags",
  crear_tag: "Creando tag",
  leer_diario: "Leyendo diario",
  escribir_diario: "Escribiendo en el diario",
};
