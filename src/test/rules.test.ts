import { describe, expect, it } from "vitest";
import { parseQuickTask } from "@/lib/nlp";
import { nextDue, filterTasks, sortTasks } from "@/lib/tasks";
import { newTask } from "@/lib/db";
import { effectiveAccess, DEFAULT_ACCESS } from "@/lib/settings";
import { buildTools } from "@/lib/ai/tools";

// Friday 30 Oct 2026, 09:00 local
const NOW = new Date(2026, 9, 30, 9, 0, 0);

describe("quick task parser", () => {
  it("parses 'comprar pan mañana a las 10 #casa'", () => {
    const r = parseQuickTask("comprar pan mañana a las 10 #casa", NOW);
    expect(r.title).toBe("comprar pan");
    expect(r.tags).toEqual(["casa"]);
    expect(r.hasTime).toBe(true);
    expect(new Date(r.due!)).toEqual(new Date(2026, 9, 31, 10, 0, 0));
  });

  it("parses weekday and afternoon time", () => {
    const r = parseQuickTask("llamar a Ana el lunes a las 5 de la tarde", NOW);
    expect(r.title).toBe("llamar a Ana");
    expect(new Date(r.due!)).toEqual(new Date(2026, 10, 2, 17, 0, 0));
  });

  it("parses priority marker", () => {
    expect(parseQuickTask("pagar factura !1", NOW).priority).toBe(1);
  });
});

describe("repeating tasks", () => {
  it("monthly repeat clamps to month end", () => {
    expect(new Date(nextDue(new Date(2026, 0, 31).getTime(), "monthly"))).toEqual(new Date(2026, 1, 28));
  });
  it("weekly repeat adds 7 days", () => {
    expect(new Date(nextDue(new Date(2026, 9, 30).getTime(), "weekly"))).toEqual(new Date(2026, 10, 6));
  });
});

describe("task views", () => {
  it("'hoy' includes overdue and today, excludes future and done", () => {
    const tasks = [
      newTask({ id: "a", due: new Date(2026, 9, 29).getTime() }),
      newTask({ id: "b", due: new Date(2026, 9, 30, 18).getTime() }),
      newTask({ id: "c", due: new Date(2026, 9, 31).getTime() }),
      newTask({ id: "d", due: new Date(2026, 9, 30).getTime(), status: "done" }),
    ];
    expect(filterTasks(tasks, "hoy", NOW).map((t) => t.id).sort()).toEqual(["a", "b"]);
  });
  it("keeps pinned tasks ahead of the selected sort order", () => {
    const tasks = [
      newTask({ id: "low", priority: 4, order: 1 }),
      newTask({ id: "pinned", priority: 4, order: 2, pinned: true }),
      newTask({ id: "high", priority: 1, order: 3 }),
    ];
    expect(sortTasks(tasks, "prioridad").map((task) => task.id)).toEqual(["pinned", "high", "low"]);
    expect(newTask().pinned).toBe(false);
  });
});

describe("AI access", () => {
  const noop = () => {};
  it("read-only sections expose no write tools", () => {
    const tools = buildTools({ ...DEFAULT_ACCESS, paginas: { enabled: true, mode: "read" } }, noop);
    expect(Object.keys(tools)).toContain("leer_pagina");
    expect(Object.keys(tools)).not.toContain("crear_pagina");
  });
  it("disabled sections expose no tools at all", () => {
    const tools = buildTools({ ...DEFAULT_ACCESS, tareas: { enabled: false, mode: "write" } }, noop);
    expect(Object.keys(tools).some((k) => k.includes("tarea"))).toBe(false);
  });
  it("journal stays hidden from the AI until the journal is enabled", () => {
    const acc = effectiveAccess({ ...DEFAULT_ACCESS, diario: { enabled: true, mode: "write" } }, false);
    expect(Object.keys(buildTools(acc, noop)).some((k) => k.includes("diario"))).toBe(false);
  });
});

describe("markdown export", () => {
  it("writes tight lists and keeps underline/colour as inline HTML", async () => {
    const { htmlToMarkdown } = await import("@/lib/markdown");
    const md = htmlToMarkdown('<ul><li><p>manzanas</p></li><li><p>peras</p></li></ul><p><u>sub</u> <span style="color: red">rojo</span></p>');
    expect(md).toContain("- manzanas\n- peras");
    expect(md).toContain("<u>sub</u>");
    expect(md).toContain('<span style="color: red">rojo</span>');
  });
  it("round-trips task lists", async () => {
    const { htmlToMarkdown, markdownToHtml } = await import("@/lib/markdown");
    const html = markdownToHtml("- [x] hecho\n- [ ] pendiente\n");
    expect(html).toContain('data-type="taskList"');
    expect(htmlToMarkdown(html)).toContain("- [x] hecho\n- [ ] pendiente");
  });
});

describe("markdown rich blocks", () => {
  it("callouts export as GitHub alerts and import back", async () => {
    const { htmlToMarkdown, markdownToHtml } = await import("@/lib/markdown");
    const md = htmlToMarkdown('<div data-callout="warning"><p>Cuidado</p></div>');
    expect(md).toContain("> [!WARNING]\n> Cuidado");
    expect(markdownToHtml(md)).toContain('data-callout="warning"');
  });
  it("math exports as $…$ and $$…$$ and imports back", async () => {
    const { htmlToMarkdown, markdownToHtml } = await import("@/lib/markdown");
    const md = htmlToMarkdown('<p>Masa <span data-type="inline-math" data-latex="E=mc^2"></span></p><div data-type="block-math" data-latex="a^2+b^2"></div>');
    expect(md).toContain("$E=mc^2$");
    expect(md).toContain("$$\na^2+b^2\n$$");
    const html = markdownToHtml(md);
    expect(html).toContain('data-type="inline-math"');
    expect(html).toContain('data-type="block-math"');
  });
});

import { APP_VERSION, compareVersions, detectPlatform, pickAsset } from "@/lib/updater";
describe("updater", () => {
  it("uses the package version and detects mobile operating systems", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(detectPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(detectPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe("ios");
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
  });
  it("detects newer tag", () => expect(compareVersions("v1.0.1", "1.0.0")).toBeGreaterThan(0));
  it("android gets apk, windows gets exe", () => {
    const a = [{ name: "meld.exe", browser_download_url: "e" }, { name: "meld.apk", browser_download_url: "a" }];
    expect(pickAsset(a, "android")?.name).toBe("meld.apk");
    expect(pickAsset(a, "windows")?.name).toBe("meld.exe");
    expect(pickAsset([...a, { name: "meld.ipa", browser_download_url: "i" }], "ios")).toBeUndefined();
  });
});
