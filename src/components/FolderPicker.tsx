import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, FolderOpen, Plus } from "lucide-react";
import { GlassSheet } from "@/components/glass/Glass";
import { db, uid, type Id } from "@/lib/db";
import { flattenTree } from "@/lib/folders";
import { cn } from "@/lib/utils";

/** Bottom sheet listing the folder tree (indented). `disabled` folders can't be picked. */
export function FolderTreeSheet({
  open,
  onClose,
  value,
  onPick,
  title = "Mover a…",
  disabled,
  rootLabel = "Sin carpeta",
}: {
  open: boolean;
  onClose: () => void;
  value: Id | null;
  onPick: (id: Id | null) => void;
  title?: string;
  disabled?: Set<Id>;
  rootLabel?: string;
}) {
  const folders = useLiveQuery(() => db.folders.toArray(), []) ?? [];
  const [name, setName] = useState("");
  const rows = flattenTree(folders);

  return (
    <GlassSheet open={open} onClose={onClose} title={title}>
      <div className="flex max-h-[50vh] flex-col overflow-y-auto">
        {[{ id: null as Id | null, name: rootLabel, icon: "🗂️", depth: 0 }, ...rows.map((r) => ({ id: r.folder.id as Id | null, name: r.folder.name, icon: r.folder.icon, depth: r.depth }))].map((f) => {
          const off = f.id !== null && disabled?.has(f.id);
          return (
            <button
              key={f.id ?? "none"}
              type="button"
              disabled={off}
              onClick={() => {
                onPick(f.id);
                onClose();
              }}
              style={{ paddingLeft: 12 + f.depth * 18 }}
              className={cn("flex items-center gap-3 rounded-2xl py-2.5 pr-3 text-left", value === f.id ? "bg-accent" : "hover:bg-muted", off && "opacity-35")}
            >
              <span className="text-lg">{f.icon}</span>
              <span className="flex-1 truncate text-[15px]">{f.name}</span>
              {value === f.id && <Check className="h-4 w-4 text-coral" />}
            </button>
          );
        })}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = uid();
          await db.folders.add({ id, name: name.trim(), icon: "📁", color: "oklch(0.72 0.15 40)", parentId: null, createdAt: Date.now() });
          onPick(id);
          setName("");
          onClose();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva carpeta…" className="h-11 flex-1 rounded-2xl bg-muted px-3 text-sm outline-none" />
        <button type="submit" className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground" aria-label="Crear carpeta">
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </GlassSheet>
  );
}

export function FolderPicker({ value, onChange }: { value: Id | null; onChange: (id: Id | null) => void }) {
  const folders = useLiveQuery(() => db.folders.toArray(), []) ?? [];
  const [open, setOpen] = useState(false);
  const current = folders.find((f) => f.id === value);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium">
        {current ? <span>{current.icon}</span> : <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />}
        {current?.name ?? "Sin carpeta"}
      </button>
      <FolderTreeSheet open={open} onClose={() => setOpen(false)} value={value} onPick={onChange} />
    </>
  );
}
