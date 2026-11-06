import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Bold, Code, FilePlus2, FileText, Highlighter, Italic, Link2, Strikethrough, Underline } from "lucide-react";
import { editorExtensions } from "./extensions";
import { EditorToolbar } from "./EditorToolbar";
import { FindBar } from "./FindBar";
import { MathSheet, type MathTarget } from "./MathSheet";
import { filterSlash, type SlashItem } from "./slash-items";
import { resolveAttachments, saveAttachment, serializeAttachments } from "@/lib/attachments";
import { db, newPage, type Page } from "@/lib/db";
import { cn } from "@/lib/utils";

export interface RichEditorChange {
  html: string;
  words: number;
}

interface Trigger {
  kind: "slash" | "link";
  query: string;
  from: number;
  to: number;
  top: number;
  left: number;
}

interface MenuEntry {
  key: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  pick: () => void;
}

function detectTrigger(editor: Editor): Trigger | null {
  const { state, view } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name === "codeBlock") return null;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 60), $from.parentOffset, undefined, "\ufffc");
  const link = /\[\[([^\]\n]{0,40})$/.exec(before);
  const slash = /(?:^|\s)\/([\p{L}\p{N}]{0,20})$/u.exec(before);
  const m = link ? { kind: "link" as const, q: link[1] ?? "", len: (link[1] ?? "").length + 2 } : slash ? { kind: "slash" as const, q: slash[1] ?? "", len: (slash[1] ?? "").length + 1 } : null;
  if (!m) return null;
  const coords = view.coordsAtPos($from.pos);
  return { kind: m.kind, query: m.q, from: $from.pos - m.len, to: $from.pos, top: coords.bottom, left: coords.left };
}

/** Tiptap editor with slash menu, [[ ]] page links, bubble menu, find/replace, math and the glass toolbar. */
export function RichEditor({
  html,
  onChange,
  placeholder = "Escribe, usa / para insertar bloques o [[ para enlazar…",
  currentPageId,
  readOnly = false,
}: {
  html: string;
  onChange: (c: RichEditorChange) => void;
  placeholder?: string;
  currentPageId?: string;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const [focused, setFocused] = useState(false);
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const [active, setActive] = useState(0);
  const [findOpen, setFindOpen] = useState(false);
  const [math, setMath] = useState<MathTarget | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const entriesRef = useRef<MenuEntry[]>([]);
  const activeRef = useRef(0);
  activeRef.current = active;
  const triggerRef = useRef<Trigger | null>(null);
  triggerRef.current = trigger;
  const fileRef = useRef<HTMLInputElement>(null);
  const navRef = useRef(navigate);
  navRef.current = navigate;

  const extensions = useMemo(
    () =>
      editorExtensions(placeholder, {
        onMathClick: (kind, node, pos) => setMath({ kind, latex: String(node.attrs["latex"] ?? ""), pos }),
      }),
    [placeholder],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: "",
    editable: !readOnly,
    editorProps: {
      attributes: { class: "meld-editor-content", spellcheck: "true" },
      handleKeyDown: (_view, event) => {
        if (!triggerRef.current) return false;
        const n = entriesRef.current.length;
        if (event.key === "ArrowDown") {
          setActive((a) => (n ? (a + 1) % n : 0));
          return true;
        }
        if (event.key === "ArrowUp") {
          setActive((a) => (n ? (a - 1 + n) % n : 0));
          return true;
        }
        if (event.key === "Enter" && n) {
          entriesRef.current[activeRef.current]?.pick();
          return true;
        }
        if (event.key === "Escape") {
          setTrigger(null);
          return true;
        }
        return false;
      },
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement).closest("a");
        const href = a?.getAttribute("href");
        if (href?.startsWith("/paginas/")) {
          event.preventDefault();
          void navRef.current({ to: "/paginas/$pageId", params: { pageId: href.slice("/paginas/".length) } });
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current({ html: serializeAttachments(editor.getHTML()), words: editor.storage.characterCount.words() });
    },
    onSelectionUpdate: ({ editor }) => {
      const t = detectTrigger(editor);
      setTrigger((prev) => {
        if (!t) return null;
        if (!prev || prev.kind !== t.kind || prev.query !== t.query) setActive(0);
        return t;
      });
    },
    onTransaction: ({ editor, transaction }) => {
      if (transaction.docChanged) {
        const t = detectTrigger(editor);
        setTrigger((prev) => {
          if (!t) return null;
          if (!prev || prev.query !== t.query) setActive(0);
          return t;
        });
      }
    },
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setFocused(true);
    },
    onBlur: () => {
      blurTimer.current = setTimeout(() => {
        setFocused(false);
        setTrigger(null);
      }, 150);
    },
  });

  useEffect(() => {
    if (!editor) return;
    let cancelled = false;
    void resolveAttachments(html).then((resolved) => {
      if (cancelled) return;
      editor.commands.setContent(resolved, { emitUpdate: false });
      onChangeRef.current({ html, words: editor.storage.characterCount.words() });
    });
    return () => {
      cancelled = true;
    };
    // Content is loaded once per editor instance; parents remount with a new key to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const pages = useLiveQuery(
    async (): Promise<Page[]> => (trigger?.kind === "link" ? db.pages.orderBy("updatedAt").reverse().limit(200).toArray() : []),
    [trigger?.kind],
  );

  const clearTrigger = useCallback(() => {
    const t = triggerRef.current;
    if (!editor || !t) return editor?.chain().focus();
    setTrigger(null);
    return editor.chain().focus().deleteRange({ from: t.from, to: editor.state.selection.from });
  }, [editor]);

  const insertPageLink = useCallback(
    (id: string, title: string) => {
      clearTrigger()
        ?.insertContent([
          { type: "text", text: title || "Sin título", marks: [{ type: "link", attrs: { href: `/paginas/${id}` } }] },
          { type: "text", text: " " },
        ])
        .run();
    },
    [clearTrigger],
  );

  const pickSlash = useCallback(
    (item: SlashItem) => {
      if (!editor) return;
      const chain = clearTrigger();
      chain?.run();
      const a = item.action;
      if (a.type === "run") a.run(editor);
      else if (a.type === "image") fileRef.current?.click();
      else if (a.type === "math") setMath({ kind: a.kind, latex: "", pos: null });
      else if (a.type === "pageLink") editor.chain().focus().insertContent("[[").run();
    },
    [editor, clearTrigger],
  );

  const entries: MenuEntry[] = useMemo(() => {
    if (!trigger) return [];
    if (trigger.kind === "slash")
      return filterSlash(trigger.query).map((i) => ({ key: i.id, label: i.label, hint: i.hint, icon: i.icon, pick: () => pickSlash(i) }));
    const q = trigger.query.trim().toLowerCase();
    const list = (pages ?? [])
      .filter((p) => p.id !== currentPageId && (!q || p.title.toLowerCase().includes(q)))
      .slice(0, 6)
      .map<MenuEntry>((p) => ({ key: p.id, label: `${p.icon} ${p.title || "Sin título"}`, icon: FileText, pick: () => insertPageLink(p.id, p.title) }));
    if (q && !(pages ?? []).some((p) => p.title.toLowerCase() === q))
      list.push({
        key: "new",
        label: `Crear página «${trigger.query.trim()}»`,
        icon: FilePlus2,
        pick: () => {
          const p = newPage({ title: trigger.query.trim() });
          void db.pages.add(p).then(() => insertPageLink(p.id, p.title));
        },
      });
    return list;
  }, [trigger, pages, pickSlash, insertPageLink, currentPageId]);
  entriesRef.current = entries;

  if (!editor) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  const menuTop = trigger ? Math.min(trigger.top + 6, (typeof window !== "undefined" ? window.innerHeight : 800) - 300) : 0;
  const menuLeft = trigger ? Math.max(12, Math.min(trigger.left - 16, (typeof window !== "undefined" ? window.innerWidth : 400) - 272)) : 0;

  return (
    <div className="meld-editor">
      <AnimatePresence>{findOpen && <FindBar editor={editor} onClose={() => setFindOpen(false)} />}</AnimatePresence>

      <BubbleMenu
        editor={editor}
        options={{ placement: "top", offset: 8 }}
        shouldShow={({ editor: e, state }) => !state.selection.empty && !e.isActive("image") && !e.isActive("codeBlock") && state.selection.constructor.name === "TextSelection"}
      >
        <div className="glass glass-solid flex items-center gap-0.5 rounded-2xl p-1" onMouseDown={(e) => e.preventDefault()}>
          {[
            { l: "Negrita", I: Bold, a: "bold", f: () => editor.chain().focus().toggleBold().run() },
            { l: "Cursiva", I: Italic, a: "italic", f: () => editor.chain().focus().toggleItalic().run() },
            { l: "Subrayado", I: Underline, a: "underline", f: () => editor.chain().focus().toggleUnderline().run() },
            { l: "Tachado", I: Strikethrough, a: "strike", f: () => editor.chain().focus().toggleStrike().run() },
            { l: "Código", I: Code, a: "code", f: () => editor.chain().focus().toggleCode().run() },
            { l: "Resaltar", I: Highlighter, a: "highlight", f: () => editor.chain().focus().toggleHighlight({ color: "oklch(0.8 0.14 75 / 0.3)" }).run() },
            {
              l: "Enlace",
              I: Link2,
              a: "link",
              f: () => {
                if (editor.isActive("link")) {
                  editor.chain().focus().unsetLink().run();
                  return;
                }
                const url = window.prompt("URL del enlace");
                if (url) editor.chain().focus().setLink({ href: /^https?:|^mailto:|^\//.test(url) ? url : `https://${url}` }).run();
              },
            },
          ].map(({ l, I, a, f }) => (
            <button
              key={l}
              type="button"
              aria-label={l}
              onClick={f}
              className={cn("relative z-10 grid h-8 w-8 place-items-center rounded-xl", editor.isActive(a) ? "bg-accent text-coral" : "hover:bg-muted")}
            >
              <I className="h-4 w-4" />
            </button>
          ))}
        </div>
      </BubbleMenu>

      <EditorContent editor={editor} />

      <AnimatePresence>
        {trigger && entries.length > 0 && (
          <motion.div
            key={trigger.kind}
            initial={{ opacity: 0, scale: 0.6, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 480, damping: 32 }}
            style={{ top: menuTop, left: menuLeft, transformOrigin: "top left" }}
            className="glass glass-solid glass-refract no-scrollbar fixed z-50 max-h-72 w-[260px] overflow-y-auto rounded-3xl p-1.5"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="relative z-10 flex flex-col">
              <div className="px-2.5 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {trigger.kind === "slash" ? "Insertar" : "Enlazar página"}
              </div>
              {entries.map((e, i) => (
                <button
                  key={e.key}
                  type="button"
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={e.pick}
                  className={cn("flex items-center gap-3 rounded-2xl px-2.5 py-2 text-left", i === active ? "bg-accent" : "")}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted">
                    <e.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.label}</span>
                    {e.hint && <span className="block truncate text-xs text-muted-foreground">{e.hint}</span>}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <EditorToolbar
        editor={editor}
        visible={focused && !trigger}
        onFind={() => setFindOpen((v) => !v)}
        onMath={(kind) => setMath({ kind, latex: "", pos: null })}
        onImage={() => fileRef.current?.click()}
      />

      <MathSheet
        target={math}
        onClose={() => setMath(null)}
        onDelete={() => {
          if (math?.pos != null) {
            const cmd = editor.chain().focus();
            (math.kind === "inline" ? cmd.deleteInlineMath({ pos: math.pos }) : cmd.deleteBlockMath({ pos: math.pos })).run();
          }
          setMath(null);
        }}
        onSave={(latex) => {
          if (!math) return;
          const cmd = editor.chain().focus();
          if (math.pos == null) (math.kind === "inline" ? cmd.insertInlineMath({ latex }) : cmd.insertBlockMath({ latex })).run();
          else (math.kind === "inline" ? cmd.updateInlineMath({ latex, pos: math.pos }) : cmd.updateBlockMath({ latex, pos: math.pos })).run();
          setMath(null);
        }}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const { id, url } = await saveAttachment(f, f.name);
          editor.chain().focus().insertContent({ type: "image", attrs: { src: url, alt: f.name, attachment: id } }).run();
        }}
      />
    </div>
  );
}
