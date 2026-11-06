import { Extension, Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export type CalloutType = "info" | "warning" | "success" | "error";
export const CALLOUT_TYPES: { value: CalloutType; label: string; icon: string }[] = [
  { value: "info", label: "Info", icon: "💡" },
  { value: "warning", label: "Aviso", icon: "⚠️" },
  { value: "success", label: "Éxito", icon: "✅" },
  { value: "error", label: "Error", icon: "⛔" },
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type?: CalloutType) => ReturnType;
      setCalloutType: (type: CalloutType) => ReturnType;
      unsetCallout: () => ReturnType;
    };
    search: {
      setSearchTerm: (term: string) => ReturnType;
      setSearchIndex: (index: number) => ReturnType;
    };
  }
}

/** Callout / admonition block: <div data-callout="info">…</div> */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return {
      type: {
        default: "info",
        parseHTML: (el) => el.getAttribute("data-callout") ?? "info",
        renderHTML: (attrs) => ({ "data-callout": attrs["type"] }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: "callout" }), 0];
  },
  addCommands() {
    return {
      setCallout:
        (type = "info") =>
        ({ commands }) =>
          commands.wrapIn(this.name, { type }),
      setCalloutType:
        (type) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { type }),
      unsetCallout:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

/* ---------- Find & replace ---------- */
export const searchKey = new PluginKey<SearchState>("meld-search");
interface SearchState {
  term: string;
  index: number;
  matches: { from: number; to: number }[];
  deco: DecorationSet;
}

function findMatches(doc: PMNode, term: string) {
  const out: { from: number; to: number }[] = [];
  if (!term) return out;
  const needle = term.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const hay = node.text.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push({ from: pos + i, to: pos + i + term.length });
      i = hay.indexOf(needle, i + needle.length);
    }
  });
  return out;
}

function build(doc: PMNode, term: string, index: number): SearchState {
  const matches = findMatches(doc, term);
  const idx = matches.length ? ((index % matches.length) + matches.length) % matches.length : 0;
  const deco = DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === idx ? "search-hit search-hit-current" : "search-hit" })),
  );
  return { term, index: idx, matches, deco };
}

export const SearchHighlight = Extension.create({
  name: "search",
  addCommands() {
    return {
      setSearchTerm:
        (term) =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(searchKey, { term, index: 0 }));
          return true;
        },
      setSearchIndex:
        (index) =>
        ({ tr, dispatch, state }) => {
          const s = searchKey.getState(state);
          dispatch?.(tr.setMeta(searchKey, { term: s?.term ?? "", index }));
          return true;
        },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: (_, { doc }) => build(doc, "", 0),
          apply: (tr, prev, _old, state) => {
            const meta = tr.getMeta(searchKey) as { term: string; index: number } | undefined;
            if (meta) return build(state.doc, meta.term, meta.index);
            if (tr.docChanged) return build(state.doc, prev.term, prev.index);
            return prev;
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.deco ?? null,
        },
      }),
    ];
  },
});
