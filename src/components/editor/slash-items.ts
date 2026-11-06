import type { Editor } from "@tiptap/react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRightSquare,
  Code2,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Info,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  OctagonX,
  Quote,
  Sigma,
  SquareSigma,
  Table,
  Type,
  type LucideIcon,
} from "lucide-react";

export type SlashAction =
  | { type: "run"; run: (e: Editor) => void }
  | { type: "image" }
  | { type: "math"; kind: "inline" | "block" }
  | { type: "pageLink" };

export interface SlashItem {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: LucideIcon;
  action: SlashAction;
}

const run = (fn: (e: Editor) => void): SlashAction => ({ type: "run", run: fn });

export const SLASH_ITEMS: SlashItem[] = [
  { id: "p", label: "Texto", hint: "Párrafo normal", keywords: "texto parrafo paragraph", icon: Type, action: run((e) => e.chain().focus().setParagraph().run()) },
  { id: "h1", label: "Título 1", hint: "Encabezado grande", keywords: "titulo h1 heading", icon: Heading1, action: run((e) => e.chain().focus().setHeading({ level: 1 }).run()) },
  { id: "h2", label: "Título 2", hint: "Encabezado mediano", keywords: "titulo h2 heading", icon: Heading2, action: run((e) => e.chain().focus().setHeading({ level: 2 }).run()) },
  { id: "h3", label: "Título 3", hint: "Encabezado pequeño", keywords: "titulo h3 heading", icon: Heading3, action: run((e) => e.chain().focus().setHeading({ level: 3 }).run()) },
  { id: "ul", label: "Lista", hint: "Lista con viñetas", keywords: "lista viñetas bullet", icon: List, action: run((e) => e.chain().focus().toggleBulletList().run()) },
  { id: "ol", label: "Lista numerada", hint: "1, 2, 3…", keywords: "lista numerada ordered", icon: ListOrdered, action: run((e) => e.chain().focus().toggleOrderedList().run()) },
  { id: "todo", label: "Lista de tareas", hint: "Checklist", keywords: "tareas checklist todo", icon: ListChecks, action: run((e) => e.chain().focus().toggleTaskList().run()) },
  { id: "quote", label: "Cita", hint: "Bloque de cita", keywords: "cita quote", icon: Quote, action: run((e) => e.chain().focus().toggleBlockquote().run()) },
  { id: "code", label: "Código", hint: "Bloque con resaltado", keywords: "codigo code", icon: Code2, action: run((e) => e.chain().focus().toggleCodeBlock().run()) },
  { id: "table", label: "Tabla", hint: "3 × 3 con cabecera", keywords: "tabla table", icon: Table, action: run((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()) },
  { id: "c-info", label: "Aviso informativo", hint: "Callout azul", keywords: "callout info aviso nota", icon: Info, action: run((e) => e.chain().focus().setCallout("info").run()) },
  { id: "c-warn", label: "Aviso de cuidado", hint: "Callout ámbar", keywords: "callout warning cuidado", icon: AlertTriangle, action: run((e) => e.chain().focus().setCallout("warning").run()) },
  { id: "c-ok", label: "Aviso de éxito", hint: "Callout verde", keywords: "callout success exito", icon: CheckCircle2, action: run((e) => e.chain().focus().setCallout("success").run()) },
  { id: "c-err", label: "Aviso de error", hint: "Callout rojo", keywords: "callout error peligro", icon: OctagonX, action: run((e) => e.chain().focus().setCallout("error").run()) },
  { id: "toggle", label: "Desplegable", hint: "Contenido plegable", keywords: "toggle desplegable details", icon: ChevronRightSquare, action: run((e) => e.chain().focus().setDetails().run()) },
  { id: "math", label: "Fórmula", hint: "LaTeX en línea", keywords: "formula math latex katex", icon: Sigma, action: { type: "math", kind: "inline" } },
  { id: "mathb", label: "Fórmula en bloque", hint: "LaTeX centrado", keywords: "formula bloque math latex", icon: SquareSigma, action: { type: "math", kind: "block" } },
  { id: "img", label: "Imagen", hint: "Desde tu dispositivo", keywords: "imagen foto image", icon: ImagePlus, action: { type: "image" } },
  { id: "hr", label: "Separador", hint: "Línea horizontal", keywords: "linea separador hr divider", icon: Minus, action: run((e) => e.chain().focus().setHorizontalRule().run()) },
  { id: "link", label: "Enlace a página", hint: "Escribe [[ también", keywords: "enlace pagina link interno", icon: FileText, action: { type: "pageLink" } },
];

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function filterSlash(query: string): SlashItem[] {
  const q = norm(query);
  if (!q) return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => norm(i.label).includes(q) || norm(i.keywords).includes(q));
}
