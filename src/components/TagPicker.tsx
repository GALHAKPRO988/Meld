import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X } from "lucide-react";
import { db, ensureTag, type Id } from "@/lib/db";

export function TagChip({ name, color, onRemove }: { name: string; color: string; onRemove?: () => void }) {
  return (
    <motion.span
      layout
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0 }}
      className="inline-flex h-7 items-center gap-1 rounded-full bg-muted pl-2 pr-1.5 text-xs font-medium"
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />#{name}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Quitar ${name}`} className="text-muted-foreground">
          <X className="h-3 w-3" />
        </button>
      )}
    </motion.span>
  );
}

/** Tag chips + inline input that creates tags on Enter. */
export function TagPicker({ value, onChange }: { value: Id[]; onChange: (ids: Id[]) => void }) {
  const tags = useLiveQuery(() => db.tags.toArray(), []) ?? [];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(false);
  const selected = value.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as typeof tags;
  const query = q.trim().replace(/^#/, "").toLowerCase();
  const suggestions = tags.filter((t) => !value.includes(t.id) && t.name.toLowerCase().includes(query)).slice(0, 6);
  const exact = tags.some((t) => t.name.toLowerCase() === query);

  const add = async (name: string) => {
    if (!name.trim()) return;
    const t = await ensureTag(name);
    if (!value.includes(t.id)) onChange([...value, t.id]);
    setQ("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <AnimatePresence>
          {selected.map((t) => (
            <TagChip key={t.id} name={t.name} color={t.color} onRemove={() => onChange(value.filter((v) => v !== t.id))} />
          ))}
        </AnimatePresence>
        {editing ? (
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setTimeout(() => setEditing(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add(q);
              }
            }}
            placeholder="Nuevo tag…"
            className="h-7 w-28 rounded-full bg-muted px-2.5 text-xs outline-none"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-xs text-muted-foreground">
            <Plus className="h-3 w-3" /> Tag
          </button>
        )}
      </div>
      {editing && (suggestions.length > 0 || (query && !exact)) && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((t) => (
            <button key={t.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onChange([...value, t.id])}>
              <TagChip name={t.name} color={t.color} />
            </button>
          ))}
          {query && !exact && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void add(q)}
              className="h-7 rounded-full bg-coral/15 px-2.5 text-xs font-medium text-coral"
            >
              Crear tag “{q.trim().replace(/^#/, "")}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
