import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  Check,
  Code2,
  Copy,
  Eye,
  Image,
  ImagePlus,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { GlassButton, GlassSheet } from "@/components/glass/Glass";
import { RichEditor } from "@/components/editor/RichEditor";
import { IconPicker } from "@/components/IconPicker";
import { TagPicker } from "@/components/TagPicker";
import { FolderPicker } from "@/components/FolderPicker";
import { db, uid, type Page } from "@/lib/db";
import { countWords, htmlToMarkdown, markdownToHtml } from "@/lib/markdown";
import { saveAttachment, useAttachmentUrl } from "@/lib/attachments";
import { moveToTrash, restoreFromTrash } from "@/lib/trash";

export const Route = createFileRoute("/paginas/$pageId")({
  head: () => ({
    meta: [
      { title: "Página · Meld" },
      { name: "description", content: "Edita tu página en Meld." },
      { property: "og:title", content: "Página · Meld" },
      { property: "og:description", content: "Editor de páginas de Meld." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageScreen,
});

function PageScreen() {
  const { pageId } = Route.useParams();
  const page = useLiveQuery(() => db.pages.get(pageId), [pageId], null as Page | null | undefined);
  if (page === null)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (!page)
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="mb-4 text-muted-foreground">Esta página no existe.</p>
          <Link
            to="/paginas"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Ver páginas
          </Link>
        </div>
      </div>
    );
  if (page.deletedAt)
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <p className="mb-4 text-muted-foreground">Esta página está en la papelera.</p>
          <Link
            to="/papelera"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Abrir papelera
          </Link>
        </div>
      </div>
    );
  return <PageEditorView key={page.id} initial={page} />;
}

function PageCoverImage({ src, className }: { src: string; className: string }) {
  const url = useAttachmentUrl(src);
  if (!url) return <div className={`${className} animate-pulse bg-muted/40`} />;
  return <img src={url} alt="" className={className} />;
}

function PageEditorView({ initial }: { initial: Page }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(initial.title);
  const [icon, setIcon] = useState(initial.icon);
  const [cover, setCover] = useState(initial.cover ?? null);
  const [tagIds, setTagIds] = useState(initial.tagIds);
  const [folderId, setFolderId] = useState(initial.folderId);
  const [html, setHtml] = useState(initial.html);
  const [mode, setMode] = useState<"visual" | "source">("visual");
  const [source, setSource] = useState(initial.markdown);
  const [editorKey, setEditorKey] = useState(0);
  const [words, setWords] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [copied, setCopied] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState(initial.title || "Nueva plantilla");
  const [templateDescription, setTemplateDescription] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<Partial<Page>>({});

  const flush = useCallback(async () => {
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length === 0) return;
    await db.pages.update(initial.id, { ...patch, updatedAt: Date.now() });
    setSaveState("saved");
  }, [initial.id]);

  const schedule = useCallback(
    (patch: Partial<Page>) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  useEffect(() => () => void flush(), [flush]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  useEffect(() => {
    if (!initial.title && !initial.html) titleRef.current?.focus();
  }, [initial.title, initial.html]);

  const switchMode = () => {
    if (mode === "visual") {
      setSource(htmlToMarkdown(html));
      setMode("source");
    } else {
      const next = markdownToHtml(source);
      setHtml(next);
      schedule({ html: next, markdown: htmlToMarkdown(next) });
      setEditorKey((k) => k + 1);
      setMode("visual");
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const textToCopy = mode === "source" ? source : htmlToMarkdown(html);
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Copiado al portapapeles en Markdown");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el texto");
    }
  };

  return (
    <div className="pb-safe min-h-dvh">
      <header className="pt-safe sticky top-0 z-30 px-[17px]">
        <div className="flex items-center justify-between gap-2 pt-[10px]">
          <Link to="/paginas" aria-label="Volver a páginas">
            <GlassButton size="md" tabIndex={-1}>
              <ArrowLeft className="h-5 w-5" />
            </GlassButton>
          </Link>
          <div className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              <motion.span
                key={saveState}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                {saveState === "saving" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {saveState === "saving" ? "Guardando" : "Guardado"}
              </motion.span>
            </AnimatePresence>
            <GlassButton
              size="md"
              aria-label={mode === "visual" ? "Ver Markdown" : "Ver modo visual"}
              onClick={switchMode}
            >
              {mode === "visual" ? <Code2 className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </GlassButton>
            <GlassButton
              size="md"
              onClick={handleCopyMarkdown}
              aria-label="Copiar como Markdown"
              title="Copiar como Markdown"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              )}
            </GlassButton>
            <GlassButton
              size="md"
              onClick={() => {
                setTemplateTitle(title || "Nueva plantilla");
                setSaveTemplateOpen(true);
              }}
              aria-label="Guardar esta página como plantilla"
              title="Guardar como plantilla"
            >
              <BookmarkPlus className="h-4 w-4" />
            </GlassButton>
            <GlassButton
              size="md"
              aria-label="Eliminar página"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </GlassButton>
          </div>
        </div>
      </header>

      <motion.article
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-5 pt-6"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const { id } = await saveAttachment(file, file.name);
              const nextCover = `attachment:${id}`;
              setCover(nextCover);
              schedule({ cover: nextCover });
            } catch {
              toast.error("No se pudo cargar la imagen");
            } finally {
              e.target.value = "";
            }
          }}
        />
        {cover ? (
          <div className="group relative mb-5 h-44 w-full overflow-hidden rounded-3xl border border-white/10 sm:h-56">
            {cover.startsWith("linear-gradient") ? (
              <div className="h-full w-full" style={{ background: cover }} />
            ) : (
              <PageCoverImage src={cover} className="h-full w-full object-cover" />
            )}
            <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-90 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="glass inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs text-foreground shadow-md backdrop-blur-md"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Cambiar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCover(null);
                  schedule({ cover: null });
                }}
                className="glass inline-flex items-center rounded-xl p-1 text-xs text-destructive hover:bg-destructive/10"
                title="Quitar portada"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mb-3 inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            <Image className="h-3.5 w-3.5" />
            Añadir portada
          </button>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9, rotate: -6 }}
          onClick={() => setEmojiOpen(true)}
          className="mb-2 text-5xl"
          aria-label="Cambiar icono"
        >
          {icon}
        </motion.button>
        <textarea
          ref={titleRef}
          rows={1}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            schedule({ title: e.target.value });
          }}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Sin título"
          className="w-full resize-none overflow-hidden bg-transparent text-[32px] font-bold leading-tight tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <FolderPicker
            value={folderId}
            onChange={(id) => {
              setFolderId(id);
              schedule({ folderId: id });
            }}
          />
          <TagPicker
            value={tagIds}
            onChange={(ids) => {
              setTagIds(ids);
              schedule({ tagIds: ids });
            }}
          />
        </div>
        <div className="mb-4 mt-2 text-xs text-muted-foreground">
          {mode === "visual" ? words : countWords(source)}{" "}
          {(mode === "visual" ? words : countWords(source)) === 1 ? "palabra" : "palabras"}
        </div>

        {mode === "visual" ? (
          <RichEditor
            key={editorKey}
            currentPageId={initial.id}
            html={html}
            onChange={({ html: next, words: w }) => {
              setWords(w);
              if (next === html) return;
              setHtml(next);
              schedule({ html: next, markdown: htmlToMarkdown(next) });
            }}
          />
        ) : (
          <textarea
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              const next = markdownToHtml(e.target.value);
              schedule({ html: next, markdown: e.target.value });
            }}
            spellCheck={false}
            className="min-h-[60vh] w-full resize-none rounded-2xl bg-muted p-4 font-mono text-[13px] leading-relaxed outline-none"
          />
        )}
      </motion.article>

      <GlassSheet open={emojiOpen} onClose={() => setEmojiOpen(false)} title="Icono">
        <IconPicker
          value={icon}
          onPick={(nextIcon) => {
            setIcon(nextIcon);
            schedule({ icon: nextIcon });
            setEmojiOpen(false);
          }}
        />
      </GlassSheet>

      <GlassSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="¿Eliminar esta página?"
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              await flush();
              await moveToTrash("page", initial.id);
              toast.success("Página movida a la papelera", {
                action: {
                  label: "Deshacer",
                  onClick: () => void restoreFromTrash("page", initial.id),
                },
              });
              void navigate({ to: "/paginas" });
            }}
            className="h-11 flex-1 rounded-2xl bg-destructive text-sm font-semibold text-destructive-foreground"
          >
            Eliminar
          </button>
        </div>
      </GlassSheet>
      <GlassSheet
        open={saveTemplateOpen}
        onClose={() => setSaveTemplateOpen(false)}
        title="Guardar como plantilla"
      >
        <div className="space-y-3">
          <label className="block text-sm font-medium">
            Nombre
            <input
              value={templateTitle}
              onChange={(e) => setTemplateTitle(e.target.value)}
              maxLength={80}
              className="mt-1.5 h-11 w-full rounded-2xl bg-muted px-3 outline-none"
            />
          </label>
          <label className="block text-sm font-medium">
            Descripción
            <textarea
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              maxLength={180}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-2xl bg-muted px-3 py-2 outline-none"
            />
          </label>
          <button
            type="button"
            disabled={!templateTitle.trim()}
            onClick={async () => {
              await flush();
              await db.templates.add({
                id: uid(),
                title: templateTitle.trim(),
                description: templateDescription.trim(),
                icon,
                category: "Personalizada",
                html: mode === "source" ? markdownToHtml(source) : html,
                markdown: mode === "source" ? source : htmlToMarkdown(html),
                isBuiltin: false,
                createdAt: Date.now(),
              });
              setSaveTemplateOpen(false);
              setTemplateDescription("");
              toast.success("Plantilla guardada");
            }}
            className="h-11 w-full rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Guardar plantilla
          </button>
        </div>
      </GlassSheet>
    </div>
  );
}
