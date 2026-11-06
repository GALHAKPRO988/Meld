import "katex/dist/katex.min.css";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { ReactMarkViewRenderer } from "@tiptap/react";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Image from "@tiptap/extension-image";
import { Placeholder, CharacterCount } from "@tiptap/extensions";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Mathematics } from "@tiptap/extension-mathematics";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Callout, SearchHighlight } from "./custom-nodes";
import { InternalLinkMarkView } from "./InternalLinkMarkView";

export const lowlight = createLowlight(common);

export const CODE_LANGUAGES = [
  { value: "auto", label: "Automático" },
  { value: "plaintext", label: "Texto" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "json", label: "JSON" },
  { value: "xml", label: "HTML/XML" },
  { value: "css", label: "CSS" },
  { value: "bash", label: "Bash" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
  { value: "java", label: "Java" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "cpp", label: "C++" },
  { value: "csharp", label: "C#" },
  { value: "php", label: "PHP" },
  { value: "ruby", label: "Ruby" },
  { value: "swift", label: "Swift" },
  { value: "kotlin", label: "Kotlin" },
  { value: "yaml", label: "YAML" },
];

const LinkWithPagePreview = Link.extend({
  addMarkView() {
    return ReactMarkViewRenderer(InternalLinkMarkView);
  },
});

/** Image that keeps a reference to its locally stored blob. */
const LocalImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      attachment: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-attachment"),
        renderHTML: (attrs) => (attrs["attachment"] ? { "data-attachment": attrs["attachment"] } : {}),
      },
    };
  },
});

export interface EditorHooks {
  onMathClick?: (kind: "inline" | "block", node: PMNode, pos: number) => void;
}

export function editorExtensions(placeholder: string, hooks: EditorHooks = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      codeBlock: false,
      link: false,
    }),
    LinkWithPagePreview.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
    TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    BackgroundColor,
    Subscript,
    Superscript,
    TableKit.configure({ table: { resizable: false } }),
    TaskList,
    TaskItem.configure({ nested: true }),
    LocalImage.configure({ inline: false, allowBase64: true }),
    Details.configure({ persist: true, HTMLAttributes: { class: "toggle" } }),
    DetailsSummary,
    DetailsContent,
    Mathematics.configure({
      katexOptions: { throwOnError: false },
      inlineOptions: { onClick: (node, pos) => hooks.onMathClick?.("inline", node, pos) },
      blockOptions: { onClick: (node, pos) => hooks.onMathClick?.("block", node, pos) },
    }),
    Callout,
    SearchHighlight,
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === "detailsSummary" ? "Título del desplegable" : placeholder),
      includeChildren: true,
    }),
    CharacterCount,
  ];
}
