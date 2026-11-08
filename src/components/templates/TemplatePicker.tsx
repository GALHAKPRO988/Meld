import { useLiveQuery } from "dexie-react-hooks";
import { Eye, FilePlus2, Sparkles } from "lucide-react";
import { useState } from "react";
import { db, type Template } from "@/lib/db";
import { GlassSheet } from "@/components/glass/Glass";

export function TemplatePicker({ onSelect }: { onSelect: (template: Template) => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Template | null>(null);
  const templates = useLiveQuery(() => db.templates.orderBy("createdAt").toArray(), []);

  const choose = (template: Template) => {
    onSelect(template);
    setOpen(false);
    setPreview(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium"
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Usar plantilla
        </span>
      </button>
      <GlassSheet
        open={open}
        onClose={() => {
          setOpen(false);
          setPreview(null);
        }}
        title={preview ? preview.title : "Biblioteca de plantillas"}
        className="max-h-[88dvh]"
      >
        {preview ? (
          <div className="space-y-4">
            <div className="rounded-3xl bg-muted/60 p-4">
              <div className="mb-2 text-4xl">{preview.icon}</div>
              <p className="mb-3 text-sm text-muted-foreground">{preview.description}</p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-2xl bg-background/50 p-3 font-sans text-sm">
                {preview.markdown}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => choose(preview)}
                className="h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground"
              >
                Aplicar plantilla
              </button>
            </div>
          </div>
        ) : (
          <div className="max-h-[72dvh] overflow-y-auto">
            {templates === undefined ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="h-32 animate-pulse rounded-3xl bg-muted" />
                <div className="h-32 animate-pulse rounded-3xl bg-muted" />
              </div>
            ) : templates.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Todavía no hay plantillas.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {templates.map((template) => (
                  <article key={template.id} className="glass rounded-3xl p-4">
                    <div className="relative z-10">
                      <div className="mb-2 text-3xl">{template.icon}</div>
                      <h3 className="font-semibold">{template.title}</h3>
                      <p className="mt-1 min-h-10 text-xs text-muted-foreground">
                        {template.description}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPreview(template)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-muted text-xs font-medium"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Vista previa
                        </button>
                        <button
                          type="button"
                          onClick={() => choose(template)}
                          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground"
                        >
                          <FilePlus2 className="h-3.5 w-3.5" />
                          Aplicar
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassSheet>
    </>
  );
}
