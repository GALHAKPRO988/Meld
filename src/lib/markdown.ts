import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { marked } from "marked";

let service: TurndownService | null = null;

function getService() {
  if (service) return service;
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    hr: "---",
    // Math nodes have no text content; keep them instead of dropping them as blank.
    blankReplacement: (_content, node) => {
      const el = node as HTMLElement;
      const type = el.getAttribute?.("data-type");
      if (type === "inline-math") return `$${el.getAttribute("data-latex") ?? ""}$`;
      if (type === "block-math") return `\n\n$$\n${el.getAttribute("data-latex") ?? ""}\n$$\n\n`;
      return el.nodeType === 1 && /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|PRE)$/.test(el.nodeName) ? "\n\n" : "";
    },
  });
  td.use(gfm);

  // Formatting Markdown cannot express stays as inline HTML.
  td.keep(["u", "mark", "sub", "sup"]);
  td.addRule("styledSpan", {
    filter: (node) => node.nodeName === "SPAN" && !!(node as HTMLElement).getAttribute("style"),
    replacement: (content, node) => {
      const style = (node as HTMLElement).getAttribute("style") ?? "";
      return `<span style="${style}">${content}</span>`;
    },
  });
  td.addRule("alignedBlock", {
    filter: (node) =>
      /^(P|H[1-6])$/.test(node.nodeName) && /text-align:\s*(center|right|justify)/.test((node as HTMLElement).getAttribute("style") ?? ""),
    replacement: (_content, node) => `\n\n${(node as HTMLElement).outerHTML}\n\n`,
  });
  td.addRule("listItemTight", {
    filter: "li",
    replacement: (content, node, options) => {
      const text = content.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n{2,}/g, "\n").replace(/\n/gm, "\n   ");
      const parent = node.parentNode as HTMLElement | null;
      let prefix = `${options.bulletListMarker} `;
      if (parent?.nodeName === "OL") {
        const start = Number(parent.getAttribute("start") ?? 1);
        prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
      }
      return `${prefix}${text}\n`;
    },
  });
  td.addRule("taskItem", {
    filter: (node) => node.nodeName === "LI" && (node as HTMLElement).getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      const text = content.replace(/^\n+/, "").replace(/\n+$/, "").replace(/\n/gm, "\n  ");
      return `- [${checked ? "x" : " "}] ${text}\n`;
    },
  });
  td.addRule("taskList", {
    filter: (node) => node.nodeName === "UL" && (node as HTMLElement).getAttribute("data-type") === "taskList",
    replacement: (content) => `\n\n${content}\n\n`,
  });
  td.addRule("callout", {
    filter: (node) => node.nodeName === "DIV" && (node as HTMLElement).hasAttribute("data-callout"),
    replacement: (content, node) => {
      const type = ((node as HTMLElement).getAttribute("data-callout") ?? "info").toUpperCase();
      const body = content.trim().split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
      return `\n\n> [!${type}]\n${body}\n\n`;
    },
  });
  td.addRule("details", {
    filter: "details" as never,
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const summary = el.querySelector(":scope > summary")?.textContent?.trim() ?? "";
      const inner = el.querySelector(':scope > div[data-type="detailsContent"]') as HTMLElement | null;
      const body = inner ? td.turndown(inner.innerHTML) : "";
      return `\n\n<details${el.hasAttribute("open") ? " open" : ""}><summary>${summary}</summary>\n\n${body}\n\n</details>\n\n`;
    },
  });
  td.addRule("inlineMath", {
    filter: (node) => node.nodeName === "SPAN" && (node as HTMLElement).getAttribute("data-type") === "inline-math",
    replacement: (_c, node) => `$${(node as HTMLElement).getAttribute("data-latex") ?? ""}$`,
  });
  td.addRule("blockMath", {
    filter: (node) => node.nodeName === "DIV" && (node as HTMLElement).getAttribute("data-type") === "block-math",
    replacement: (_c, node) => `\n\n$$\n${(node as HTMLElement).getAttribute("data-latex") ?? ""}\n$$\n\n`,
  });
  service = td;
  return td;
}

/** Tiptap HTML → Markdown (with inline HTML for colour, underline, alignment…). */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  return getService().turndown(html).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Markdown → HTML that Tiptap understands (task lists converted to its format). */
export function markdownToHtml(md: string): string {
  const raw = marked.parse(md, { gfm: true, breaks: false, async: false }) as string;
  if (typeof DOMParser === "undefined") return raw;
  const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, "text/html");
  doc.querySelectorAll("ul").forEach((ul) => {
    const items = Array.from(ul.children).filter((c) => c.tagName === "LI");
    const isTask = items.length > 0 && items.every((li) => li.querySelector(":scope > input[type=checkbox], :scope > p > input[type=checkbox]"));
    if (!isTask) return;
    ul.setAttribute("data-type", "taskList");
    items.forEach((li) => {
      const input = li.querySelector("input[type=checkbox]") as HTMLInputElement;
      li.setAttribute("data-type", "taskItem");
      li.setAttribute("data-checked", input.hasAttribute("checked") ? "true" : "false");
      input.remove();
      if (!li.querySelector(":scope > p")) li.innerHTML = `<p>${li.innerHTML.trim()}</p>`;
    });
  });
  const root = doc.body.firstElementChild as HTMLElement;

  // > [!INFO] blockquotes → callouts
  root.querySelectorAll("blockquote").forEach((bq) => {
    const first = bq.querySelector(":scope > p");
    const m = first?.innerHTML.match(/^\[!(INFO|WARNING|SUCCESS|ERROR|NOTE|TIP|CAUTION|IMPORTANT)\]\s*(<br>)?\s*/i);
    if (!first || !m) return;
    const map: Record<string, string> = { note: "info", tip: "success", important: "info", caution: "error" };
    const t = (m[1] ?? "info").toLowerCase();
    first.innerHTML = first.innerHTML.slice(m[0].length);
    if (!first.innerHTML.trim()) first.remove();
    const div = doc.createElement("div");
    div.setAttribute("data-callout", map[t] ?? t);
    div.innerHTML = bq.innerHTML.trim() || "<p></p>";
    bq.replaceWith(div);
  });

  // <details> → Tiptap structure
  root.querySelectorAll("details").forEach((d) => {
    if (d.querySelector(':scope > div[data-type="detailsContent"]')) return;
    const content = doc.createElement("div");
    content.setAttribute("data-type", "detailsContent");
    Array.from(d.childNodes).forEach((n) => {
      if ((n as HTMLElement).tagName !== "SUMMARY") content.appendChild(n);
    });
    if (!content.innerHTML.trim()) content.innerHTML = "<p></p>";
    d.appendChild(content);
  });

  // $$block$$ and $inline$ math
  root.querySelectorAll("p").forEach((p) => {
    const m = p.textContent?.trim().match(/^\$\$([\s\S]+)\$\$$/);
    if (!m) return;
    const div = doc.createElement("div");
    div.setAttribute("data-type", "block-math");
    div.setAttribute("data-latex", (m[1] ?? "").trim());
    p.replaceWith(div);
  });
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  texts.forEach((t) => {
    if (!t.data.includes("$") || t.parentElement?.closest("code, pre")) return;
    const parts = t.data.split(/(\$[^$\n]+?\$)/g);
    if (parts.length === 1) return;
    const frag = doc.createDocumentFragment();
    parts.forEach((part) => {
      if (/^\$[^$\n]+\$$/.test(part)) {
        const span = doc.createElement("span");
        span.setAttribute("data-type", "inline-math");
        span.setAttribute("data-latex", part.slice(1, -1));
        frag.appendChild(span);
      } else if (part) frag.appendChild(doc.createTextNode(part));
    });
    t.replaceWith(frag);
  });

  return root.innerHTML;
}

export function countWords(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
