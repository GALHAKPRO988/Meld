import { useEffect, useReducer, useState } from "react";
import { motion } from "framer-motion";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import { ChevronDown, ChevronUp, Replace, X } from "lucide-react";
import { searchKey } from "./custom-nodes";

export function FindBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const [term, setTerm] = useState("");
  const [rep, setRep] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    editor.on("transaction", force);
    return () => {
      editor.off("transaction", force);
      editor.commands.setSearchTerm("");
    };
  }, [editor]);

  useEffect(() => {
    editor.commands.setSearchTerm(term);
  }, [editor, term]);

  const s = searchKey.getState(editor.state);
  const count = s?.matches.length ?? 0;
  const index = s?.index ?? 0;

  const go = (delta: number) => {
    if (!count) return;
    editor.commands.setSearchIndex(index + delta);
    const st = searchKey.getState(editor.state);
    const m = st?.matches[st.index];
    if (m) {
      const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, m.from, m.to)).scrollIntoView();
      editor.view.dispatch(tr);
    }
  };

  const replaceOne = () => {
    const m = s?.matches[index];
    if (!m) return;
    editor.chain().insertContentAt({ from: m.from, to: m.to }, rep).run();
  };

  const replaceAll = () => {
    if (!s?.matches.length) return;
    const tr = editor.state.tr;
    [...s.matches].reverse().forEach((m) => tr.insertText(rep, m.from, m.to));
    editor.view.dispatch(tr);
  };

  return (
    <motion.div
      initial={{ y: -20, opacity: 0, scale: 0.96 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="glass glass-solid glass-refract sticky top-[calc(env(safe-area-inset-top)+64px)] z-30 mb-3 rounded-[22px] p-2"
    >
      <div className="relative z-10 flex flex-col gap-2">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                go(e.shiftKey ? -1 : 1);
              }
              if (e.key === "Escape") onClose();
            }}
            placeholder="Buscar en la página"
            className="h-9 min-w-0 flex-1 rounded-xl bg-muted px-3 text-sm outline-none"
          />
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{count ? `${index + 1}/${count}` : "0/0"}</span>
          <button type="button" aria-label="Anterior" onClick={() => go(-1)} className="grid h-9 w-8 place-items-center rounded-xl hover:bg-muted">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => go(1)} className="grid h-9 w-8 place-items-center rounded-xl hover:bg-muted">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Reemplazar"
            onClick={() => setShowReplace((v) => !v)}
            className={`grid h-9 w-8 place-items-center rounded-xl ${showReplace ? "bg-accent text-coral" : "hover:bg-muted"}`}
          >
            <Replace className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Cerrar búsqueda" onClick={onClose} className="grid h-9 w-8 place-items-center rounded-xl hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        {showReplace && (
          <div className="flex items-center gap-1.5">
            <input
              value={rep}
              onChange={(e) => setRep(e.target.value)}
              placeholder="Reemplazar por…"
              className="h-9 min-w-0 flex-1 rounded-xl bg-muted px-3 text-sm outline-none"
            />
            <button type="button" onClick={replaceOne} disabled={!count} className="h-9 rounded-xl bg-muted px-3 text-xs font-medium disabled:opacity-40">
              Reemplazar
            </button>
            <button type="button" onClick={replaceAll} disabled={!count} className="h-9 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-40">
              Todo
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
