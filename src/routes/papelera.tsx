import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { GlassSheet } from "@/components/glass/Glass";
import {
  emptyTrash,
  getTrashItems,
  permanentlyDelete,
  restoreFromTrash,
  type TrashItem,
} from "@/lib/trash";

export const Route = createFileRoute("/papelera")({
  head: () => ({
    meta: [
      { title: "Papelera · Meld" },
      {
        name: "description",
        content: "Restaura o elimina definitivamente páginas y tareas borradas.",
      },
    ],
  }),
  component: TrashScreen,
});

function relativeDeletionDate(timestamp: number) {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "Eliminado hoy";
  if (days === 1) return "Eliminado hace 1 día";
  if (days < 30) return `Eliminado hace ${days} días`;
  if (days < 365)
    return `Eliminado hace ${Math.floor(days / 30)} ${Math.floor(days / 30) === 1 ? "mes" : "meses"}`;
  const years = Math.floor(days / 365);
  return `Eliminado hace ${years} ${years === 1 ? "año" : "años"}`;
}

function TrashScreen() {
  const items = useLiveQuery(getTrashItems, []) ?? [];
  const [confirm, setConfirm] = useState<TrashItem | "empty" | null>(null);
  const isEmpty = confirm === "empty";

  const restore = async (item: TrashItem) => {
    try {
      await restoreFromTrash(item.kind, item.id);
      toast.success(`${item.kind === "page" ? "Página" : "Tarea"} restaurada`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo restaurar el elemento");
    }
  };

  return (
    <div className="pb-safe min-h-dvh pb-10">
      <PageHeader
        title="Papelera"
        subtitle={`${items.length} ${items.length === 1 ? "elemento" : "elementos"} · Se conservan localmente hasta que decidas vaciarla`}
        actions={
          items.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirm("empty")}
              className="glass inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-destructive sm:h-11 sm:px-4"
              aria-label="Vaciar papelera"
              title="Vaciar papelera"
            >
              <Trash2 className="h-4 w-4" />
              <span>Vaciar papelera</span>
            </button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-5 py-20 text-center"
        >
          <div className="mb-3 text-5xl opacity-70">🗑️</div>
          <p className="font-medium text-muted-foreground">La papelera está vacía</p>
        </motion.div>
      ) : (
        <ul className="flex flex-col gap-2 px-4">
          <AnimatePresence>
            {items.map((entry) => (
              <motion.li
                key={`${entry.kind}:${entry.id}`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="glass rounded-2xl p-3.5"
              >
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-xl">
                      {entry.kind === "page" ? entry.item.icon || "📄" : "☑️"}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeDeletionDate(entry.deletedAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void restore(entry)}
                      aria-label={`Restaurar ${entry.title}`}
                      title="Restaurar"
                      className="glass grid h-9 w-9 place-items-center rounded-xl text-foreground hover:bg-muted"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirm(entry)}
                      aria-label={`Eliminar definitivamente ${entry.title}`}
                      title="Eliminar definitivamente"
                      className="glass grid h-9 w-9 place-items-center rounded-xl text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <GlassSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={isEmpty ? "¿Vaciar la papelera?" : "¿Eliminar definitivamente?"}
      >
        <p className="mb-4 text-sm text-muted-foreground">
          {isEmpty
            ? "Se eliminarán definitivamente todas las páginas y tareas de la papelera. Esta acción no se puede deshacer."
            : `“${confirm && typeof confirm !== "string" ? confirm.title : ""}” se eliminará permanentemente y no se podrá recuperar.`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirm(null)}
            className="h-11 flex-1 rounded-2xl bg-muted text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                if (isEmpty) {
                  await emptyTrash();
                  toast.success("Papelera vaciada");
                } else if (confirm) {
                  await permanentlyDelete(confirm.kind, confirm.id);
                  toast.success("Elemento eliminado definitivamente");
                }
                setConfirm(null);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "No se pudo eliminar el elemento",
                );
              }
            }}
            className="h-11 flex-1 rounded-2xl bg-destructive text-sm font-semibold text-destructive-foreground"
          >
            {isEmpty ? "Vaciar papelera" : "Eliminar definitivamente"}
          </button>
        </div>
      </GlassSheet>
    </div>
  );
}
