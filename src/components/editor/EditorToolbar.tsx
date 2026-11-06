import { useEffect, useReducer, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ChevronRightSquare,
  Code,
  MessageSquareWarning,
  Search,
  Sigma,
  Heading,
  Highlighter,
  ImagePlus,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  PaintBucket,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { CALLOUT_TYPES } from "./custom-nodes";
import { CODE_LANGUAGES } from "./extensions";
import { cn } from "@/lib/utils";

const PALETTE = [
  { label: "Por defecto", value: null },
  { label: "Coral", value: "oklch(0.72 0.15 40)" },
  { label: "Ámbar", value: "oklch(0.8 0.14 75)" },
  { label: "Verde", value: "oklch(0.72 0.14 155)" },
  { label: "Azul", value: "oklch(0.7 0.11 240)" },
  { label: "Violeta", value: "oklch(0.68 0.15 300)" },
  { label: "Rosa", value: "oklch(0.7 0.16 350)" },
  { label: "Gris", value: "oklch(0.65 0.01 150)" },
];
const BG_PALETTE = [
  { label: "Ninguno", value: null },
  { label: "Coral", value: "oklch(0.72 0.15 40 / 0.3)" },
  { label: "Ámbar", value: "oklch(0.8 0.14 75 / 0.3)" },
  { label: "Verde", value: "oklch(0.72 0.14 155 / 0.3)" },
  { label: "Azul", value: "oklch(0.7 0.11 240 / 0.3)" },
  { label: "Violeta", value: "oklch(0.68 0.15 300 / 0.3)" },
  { label: "Gris", value: "oklch(0.65 0.01 150 / 0.3)" },
];

type Panel = null | "color" | "bg" | "highlight" | "heading" | "table" | "link" | "callout" | "code";

function Btn({ onClick, active, label, children, disabled }: { onClick: () => void; active?: boolean; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={{ scale: 0.88 }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-9 min-w-9 shrink-0 place-items-center rounded-xl px-1.5 text-foreground transition-colors disabled:opacity-35",
        active ? "bg-accent text-coral" : "hover:bg-muted",
      )}
    >
      {children}
    </motion.button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;

export function EditorToolbar({
  editor,
  visible,
  onFind,
  onMath,
  onImage,
}: {
  editor: Editor;
  visible: boolean;
  onFind: () => void;
  onMath: (kind: "inline" | "block") => void;
  onImage: () => void;
}) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [panel, setPanel] = useState<Panel>(null);
  const [href, setHref] = useState("");
  const inset = useKeyboardInset();

  useEffect(() => {
    editor.on("transaction", force);
    return () => {
      editor.off("transaction", force);
    };
  }, [editor]);

  useEffect(() => {
    if (!visible) setPanel(null);
  }, [visible]);

  const c = () => editor.chain().focus();
  const is = (name: string, attrs?: Record<string, unknown>) => editor.isActive(name, attrs);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const listType = is("taskItem") ? "taskItem" : "listItem";
  const inTable = is("table");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
          style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + ${inset}px + 8px)` }}
          className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px] px-2 lg:max-w-[1280px] lg:left-[var(--sidebar-w)]"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="glass glass-solid glass-refract overflow-hidden rounded-[22px] [mask-image:linear-gradient(to_right,black_calc(100%-36px),transparent_100%)] lg:[mask-image:none]">
            <div className="relative z-10">
              <AnimatePresence initial={false}>
                {panel && (
                  <motion.div
                    key={panel}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-b border-border"
                  >
                    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto p-1.5">
                      {panel === "heading" && (
                        <>
                          <Btn label="Párrafo" active={is("paragraph")} onClick={() => c().setParagraph().run()}>
                            <span className="text-sm">Aa</span>
                          </Btn>
                          {([1, 2, 3, 4, 5, 6] as const).map((l) => (
                            <Btn key={l} label={`Título ${l}`} active={is("heading", { level: l })} onClick={() => c().toggleHeading({ level: l }).run()}>
                              <span className="text-sm font-semibold">H{l}</span>
                            </Btn>
                          ))}
                        </>
                      )}
                      {(panel === "color" || panel === "bg" || panel === "highlight") &&
                        (panel === "color" ? PALETTE : BG_PALETTE).map((col) => (
                          <button
                            key={col.label}
                            type="button"
                            aria-label={col.label}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              if (panel === "color") col.value ? c().setColor(col.value).run() : c().unsetColor().run();
                              else if (panel === "bg") col.value ? c().setBackgroundColor(col.value).run() : c().unsetBackgroundColor().run();
                              else col.value ? c().setHighlight({ color: col.value }).run() : c().unsetHighlight().run();
                              setPanel(null);
                            }}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                          >
                            <span
                              className="h-6 w-6 rounded-full border border-border"
                              style={{ background: col.value ?? "transparent" }}
                            >
                              {!col.value && <X className="m-auto mt-[3px] h-4 w-4 text-muted-foreground" />}
                            </span>
                          </button>
                        ))}
                      {panel === "table" && (
                        <>
                          {!inTable && (
                            <Btn label="Insertar tabla" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
                              <span className="px-1 text-xs font-medium">Insertar 3×3</span>
                            </Btn>
                          )}
                          {inTable && (
                            <>
                              {[
                                ["+ Fila", () => c().addRowAfter().run()],
                                ["− Fila", () => c().deleteRow().run()],
                                ["+ Col", () => c().addColumnAfter().run()],
                                ["− Col", () => c().deleteColumn().run()],
                                ["Cabecera", () => c().toggleHeaderRow().run()],
                                ["Combinar", () => c().mergeCells().run()],
                                ["Dividir", () => c().splitCell().run()],
                                ["Borrar tabla", () => c().deleteTable().run()],
                              ].map(([l, fn]) => (
                                <Btn key={l as string} label={l as string} onClick={fn as () => void}>
                                  <span className="whitespace-nowrap px-1 text-xs font-medium">{l as string}</span>
                                </Btn>
                              ))}
                            </>
                          )}
                        </>
                      )}
                      {panel === "callout" &&
                        <>
                          {CALLOUT_TYPES.map((t) => (
                            <Btn
                              key={t.value}
                              label={t.label}
                              active={is("callout", { type: t.value })}
                              onClick={() => (is("callout") ? c().setCalloutType(t.value).run() : c().setCallout(t.value).run())}
                            >
                              <span className="whitespace-nowrap px-1 text-xs font-medium">
                                {t.icon} {t.label}
                              </span>
                            </Btn>
                          ))}
                          {is("callout") && (
                            <Btn label="Quitar aviso" onClick={() => c().unsetCallout().run()}>
                              <span className="whitespace-nowrap px-1 text-xs font-medium">Quitar</span>
                            </Btn>
                          )}
                        </>
                      }
                      {panel === "code" &&
                        CODE_LANGUAGES.map((l) => (
                          <Btn
                            key={l.value}
                            label={l.label}
                            active={(editor.getAttributes("codeBlock")["language"] ?? "auto") === l.value}
                            onClick={() => c().updateAttributes("codeBlock", { language: l.value === "auto" ? null : l.value }).run()}
                          >
                            <span className="whitespace-nowrap px-1 text-xs font-medium">{l.label}</span>
                          </Btn>
                        ))}
                      {panel === "link" && (
                        <form
                          className="flex w-full items-center gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const url = href.trim();
                            if (url) c().extendMarkRange("link").setLink({ href: /^https?:|^mailto:/.test(url) ? url : `https://${url}` }).run();
                            else c().unsetLink().run();
                            setPanel(null);
                          }}
                        >
                          <input
                            autoFocus
                            value={href}
                            onChange={(e) => setHref(e.target.value)}
                            placeholder="https://…"
                            className="h-9 min-w-0 flex-1 rounded-xl bg-muted px-3 text-sm outline-none"
                          />
                          <button type="submit" className="h-9 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground">
                            OK
                          </button>
                        </form>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto p-1.5">
                <Btn label="Deshacer" disabled={!editor.can().undo()} onClick={() => c().undo().run()}>
                  <Undo2 className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Rehacer" disabled={!editor.can().redo()} onClick={() => c().redo().run()}>
                  <Redo2 className="h-[18px] w-[18px]" />
                </Btn>
                <Sep />
                <Btn label="Negrita" active={is("bold")} onClick={() => c().toggleBold().run()}>
                  <Bold className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Cursiva" active={is("italic")} onClick={() => c().toggleItalic().run()}>
                  <Italic className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Subrayado" active={is("underline")} onClick={() => c().toggleUnderline().run()}>
                  <Underline className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Tachado" active={is("strike")} onClick={() => c().toggleStrike().run()}>
                  <Strikethrough className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Código" active={is("code")} onClick={() => c().toggleCode().run()}>
                  <Code className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Resaltado" active={is("highlight") || panel === "highlight"} onClick={() => toggle("highlight")}>
                  <Highlighter className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Color de texto" active={panel === "color"} onClick={() => toggle("color")}>
                  <Baseline className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Color de fondo" active={panel === "bg"} onClick={() => toggle("bg")}>
                  <PaintBucket className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Superíndice" active={is("superscript")} onClick={() => c().toggleSuperscript().run()}>
                  <Superscript className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Subíndice" active={is("subscript")} onClick={() => c().toggleSubscript().run()}>
                  <Subscript className="h-[18px] w-[18px]" />
                </Btn>
                <Sep />
                <Btn label="Títulos" active={is("heading") || panel === "heading"} onClick={() => toggle("heading")}>
                  <Heading className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Alinear a la izquierda" active={editor.isActive({ textAlign: "left" })} onClick={() => c().setTextAlign("left").run()}>
                  <AlignLeft className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Centrar" active={editor.isActive({ textAlign: "center" })} onClick={() => c().setTextAlign("center").run()}>
                  <AlignCenter className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Alinear a la derecha" active={editor.isActive({ textAlign: "right" })} onClick={() => c().setTextAlign("right").run()}>
                  <AlignRight className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => c().setTextAlign("justify").run()}>
                  <AlignJustify className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Lista" active={is("bulletList")} onClick={() => c().toggleBulletList().run()}>
                  <List className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Lista numerada" active={is("orderedList")} onClick={() => c().toggleOrderedList().run()}>
                  <ListOrdered className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Lista de tareas" active={is("taskList")} onClick={() => c().toggleTaskList().run()}>
                  <ListChecks className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Indentar" disabled={!editor.can().sinkListItem(listType)} onClick={() => c().sinkListItem(listType).run()}>
                  <IndentIncrease className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Desindentar" disabled={!editor.can().liftListItem(listType)} onClick={() => c().liftListItem(listType).run()}>
                  <IndentDecrease className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Cita" active={is("blockquote")} onClick={() => c().toggleBlockquote().run()}>
                  <Quote className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Bloque de código" active={is("codeBlock")} onClick={() => c().toggleCodeBlock().run()}>
                  <SquareCode className="h-[18px] w-[18px]" />
                </Btn>
                {is("codeBlock") && (
                  <Btn label="Lenguaje" active={panel === "code"} onClick={() => toggle("code")}>
                    <span className="whitespace-nowrap px-1 text-xs font-medium">
                      {CODE_LANGUAGES.find((l) => l.value === (editor.getAttributes("codeBlock")["language"] ?? "auto"))?.label ?? "Lenguaje"}
                    </span>
                  </Btn>
                )}
                <Btn label="Línea horizontal" onClick={() => c().setHorizontalRule().run()}>
                  <Minus className="h-[18px] w-[18px]" />
                </Btn>
                <Sep />
                <Btn label="Tabla" active={inTable || panel === "table"} onClick={() => toggle("table")}>
                  <Table className="h-[18px] w-[18px]" />
                </Btn>
                <Btn
                  label="Enlace"
                  active={is("link") || panel === "link"}
                  onClick={() => {
                    setHref((editor.getAttributes("link")["href"] as string | undefined) ?? "");
                    toggle("link");
                  }}
                >
                  <Link2 className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Imagen" onClick={onImage}>
                  <ImagePlus className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Aviso" active={is("callout") || panel === "callout"} onClick={() => toggle("callout")}>
                  <MessageSquareWarning className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Desplegable" active={is("details")} onClick={() => (is("details") ? c().unsetDetails().run() : c().setDetails().run())}>
                  <ChevronRightSquare className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Fórmula" onClick={() => onMath("inline")}>
                  <Sigma className="h-[18px] w-[18px]" />
                </Btn>
                <Btn label="Fórmula en bloque" onClick={() => onMath("block")}>
                  <span className="text-xs font-semibold">∑▭</span>
                </Btn>
                <Sep />
                <Btn label="Buscar y reemplazar" onClick={onFind}>
                  <Search className="h-[18px] w-[18px]" />
                </Btn>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
