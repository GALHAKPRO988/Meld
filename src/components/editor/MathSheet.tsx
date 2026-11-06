import { useEffect, useMemo, useState } from "react";
import katex from "katex";
import { GlassSheet } from "@/components/glass/Glass";

export interface MathTarget {
  kind: "inline" | "block";
  latex: string;
  pos: number | null; // null = insert
}

export function MathSheet({
  target,
  onClose,
  onSave,
  onDelete,
}: {
  target: MathTarget | null;
  onClose: () => void;
  onSave: (latex: string) => void;
  onDelete: () => void;
}) {
  const [latex, setLatex] = useState("");
  useEffect(() => setLatex(target?.latex ?? ""), [target]);
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex || "\\;", { throwOnError: false, displayMode: target?.kind === "block" });
    } catch {
      return "";
    }
  }, [latex, target?.kind]);

  return (
    <GlassSheet open={!!target} onClose={onClose} title={target?.kind === "block" ? "Fórmula en bloque" : "Fórmula"}>
      <div className="mb-3 grid min-h-16 place-items-center overflow-x-auto rounded-2xl bg-muted px-3 py-4" dangerouslySetInnerHTML={{ __html: html }} />
      <textarea
        autoFocus
        value={latex}
        onChange={(e) => setLatex(e.target.value)}
        placeholder="E = mc^2"
        spellCheck={false}
        rows={3}
        className="w-full resize-none rounded-2xl bg-muted p-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-3 flex gap-2">
        {target?.pos != null && (
          <button type="button" onClick={onDelete} className="h-11 rounded-2xl bg-destructive/10 px-4 text-sm font-medium text-destructive">
            Eliminar
          </button>
        )}
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium">
          Cancelar
        </button>
        <button
          type="button"
          disabled={!latex.trim()}
          onClick={() => onSave(latex.trim())}
          className="h-11 flex-1 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </GlassSheet>
  );
}
