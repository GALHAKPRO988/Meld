import { createFileRoute } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookHeart, CalendarDays, Check, ChevronLeft, ChevronRight, Flame, Loader2, Lock, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { GlassButton, GlassPill, GlassSheet } from "@/components/glass/Glass";
import { RichEditor } from "@/components/editor/RichEditor";
import { useSettings } from "@/lib/settings";
import { db, type JournalEntry } from "@/lib/db";
import { htmlToMarkdown } from "@/lib/markdown";
import { addDays, addMonths, dayKey, fromDayKey, monthGrid, monthTitle, startOfMonth, WEEKDAYS_SHORT } from "@/lib/calendar";
import { currentStreak, entryHasContent, isDayKey, longestStreak, MOODS, moodEmoji, saveJournal } from "@/lib/journal";
import { cn } from "@/lib/utils";

interface JournalSearch {
  dia?: string;
}

export const Route = createFileRoute("/diario")({
  validateSearch: (s: Record<string, unknown>): JournalSearch => (isDayKey(s["dia"]) ? { dia: s["dia"] } : {}),
  head: () => ({
    meta: [
      { title: "Diario · Meld" },
      { name: "description", content: "Un diario privado, una entrada por día, en tu dispositivo." },
      { property: "og:title", content: "Diario · Meld" },
      { property: "og:description", content: "Diario privado en local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Journal,
});

const FEATURES = [
  { icon: BookHeart, title: "Una entrada al día", text: "Con el mismo editor de tus páginas." },
  { icon: Flame, title: "Racha y estado de ánimo", text: "Ve cómo te sientes y mantén el hábito." },
  { icon: Lock, title: "Privado de verdad", text: "Se queda en tu dispositivo. La IA solo lo ve si tú lo permites." },
];

function Journal() {
  const enabled = useSettings((s) => s.journalEnabled);
  const setEnabled = useSettings((s) => s.setJournalEnabled);

  if (enabled) return <JournalHome />;

  return (
    <div className="min-h-dvh pb-10">
      <PageHeader title="Diario" />
      <div className="px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, filter: "blur(8px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="glass glass-refract overflow-hidden rounded-[32px] p-6"
        >
          <div className="relative z-10">
            <div className="relative mb-5 grid h-16 w-16 place-items-center">
              <div className="absolute inset-0 rounded-full bg-coral/30 blur-xl" />
              <Sparkles className="relative h-8 w-8 text-coral" strokeWidth={1.6} />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Tu espacio para pensar</h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              El diario es opcional. Escribe cómo ha ido tu día, qué has aprendido o lo que te ronda la cabeza.
            </p>
            <ul className="mt-6 flex flex-col gap-4">
              {FEATURES.map((f, i) => (
                <motion.li key={f.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07 }} className="flex gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-muted">
                    <f.icon className="h-5 w-5" strokeWidth={1.7} />
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold">{f.title}</span>
                    <span className="block text-sm text-muted-foreground">{f.text}</span>
                  </span>
                </motion.li>
              ))}
            </ul>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setEnabled(true)}
              className="mt-7 h-12 w-full rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground"
            >
              Activar diario
            </motion.button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Puedes desactivarlo en Ajustes cuando quieras.</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

const longDate = (key: string) => {
  const s = fromDayKey(key).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function JournalHome() {
  const { dia } = Route.useSearch();
  const navigate = Route.useNavigate();
  const today = dayKey(new Date());
  const day = dia && dia <= today ? dia : today;
  const lockPastEntries = useSettings((s) => s.lockPastJournalEntries);
  const locked = lockPastEntries && day < today;
  const [calOpen, setCalOpen] = useState(false);

  const entries = useLiveQuery(() => db.journal.toArray(), []);
  const moods = useMemo(() => new Map((entries ?? []).map((e) => [e.id, e.mood])), [entries]);
  const keys = useMemo(() => (entries ?? []).map((e) => e.id), [entries]);
  const streak = currentStreak(keys);
  const best = longestStreak(keys);
  const thisMonth = keys.filter((k) => k.startsWith(today.slice(0, 7))).length;
  const mood = moods.get(day) ?? null;

  const go = (key: string) => void navigate({ search: key === today ? {} : { dia: key }, replace: true });
  const shift = (n: number) => go(dayKey(addDays(fromDayKey(day), n)));

  return (
    <div className="pb-safe min-h-dvh pb-24">
      <PageHeader
        title="Diario"
        subtitle={
          <span className="inline-flex items-center gap-1">
            <Flame className={cn("h-3.5 w-3.5", streak > 0 && "text-coral")} />
            {streak === 0 ? "Empieza tu racha hoy" : `${streak} ${streak === 1 ? "día" : "días"} de racha`}
          </span>
        }
        actions={
          <GlassButton size="md" aria-label="Calendario del diario" onClick={() => setCalOpen(true)}>
            <CalendarDays className="h-5 w-5" />
          </GlassButton>
        }
      />

      <div className="px-4">
        <div className="mb-3 grid grid-cols-3 gap-2">
          {[
            { icon: Flame, label: "Racha", value: streak },
            { icon: Trophy, label: "Mejor racha", value: best },
            { icon: BookHeart, label: "Este mes", value: thisMonth },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl px-3 py-2.5">
              <div className="relative z-10">
                <s.icon className="mb-1 h-4 w-4 text-coral" />
                <div className="text-xl font-bold leading-none">{s.value}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-coral/25 bg-coral/10 px-3 py-1 backdrop-blur-md">
            <Flame className="h-4 w-4 animate-pulse text-coral" />
            <span className="text-xs font-semibold text-coral">
              {streak > 0 ? `${streak} ${streak === 1 ? "día" : "días"} de racha` : "Empieza tu racha hoy"}
            </span>
            {best > 0 && <span className="border-l border-coral/20 pl-2 text-[11px] text-coral/80">Récord: {best}</span>}
          </div>
          {entryHasContent({
            markdown: htmlToMarkdown(entries?.find((e) => e.id === today)?.html ?? ""),
            mood: moods.get(today) ?? null,
          }) && <span className="text-xs font-medium text-emerald-400">✓ Entrada de hoy completada</span>}
        </div>

        <div className="glass mb-3 flex items-center gap-1 rounded-3xl p-1.5">
          <button type="button" aria-label="Día anterior" onClick={() => shift(-1)} className="relative z-10 grid h-9 w-9 place-items-center rounded-full hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={day} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="relative z-10 flex-1 text-center">
              <div className="text-[15px] font-semibold">{day === today ? "Hoy" : longDate(day)}</div>
              {day === today && <div className="text-xs text-muted-foreground">{longDate(day)}</div>}
            </motion.div>
          </AnimatePresence>
          <button
            type="button"
            aria-label="Día siguiente"
            disabled={day >= today}
            onClick={() => shift(1)}
            className="relative z-10 grid h-9 w-9 place-items-center rounded-full hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        {day !== today && (
          <div className="mb-3 flex justify-center">
            <GlassPill onClick={() => go(today)}>Volver a hoy</GlassPill>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-2 px-1 text-sm text-muted-foreground">¿Cómo te sientes?</p>
          <div className="flex justify-between gap-1.5">
            {MOODS.map((m) => (
              <motion.button
                key={m.id}
                type="button"
                whileTap={{ scale: 0.85 }}
                aria-label={m.label}
                aria-pressed={mood === m.id}
                disabled={locked}
                onClick={() =>
                  void saveJournal(day, { mood: mood === m.id ? null : m.id }).catch((error: unknown) =>
                    toast.error(
                      error instanceof Error ? error.message : "No se pudo guardar la entrada.",
                    ),
                  )
                }
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  mood === m.id ? "glass glass-strong" : "bg-muted/60",
                )}
              >
                <motion.span animate={{ scale: mood === m.id ? 1.18 : 1 }} className="relative z-10 text-2xl">
                  {m.emoji}
                </motion.span>
                <span className={cn("relative z-10 text-[11px]", mood === m.id ? "font-semibold" : "text-muted-foreground")}>{m.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {locked && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm text-muted-foreground"
          >
            <Lock className="h-4 w-4 shrink-0" />
            <span>Esta entrada está protegida. Puedes permitir cambios en Ajustes.</span>
          </div>
        )}
        <JournalEditor key={`${day}-${locked}`} day={day} locked={locked} />
      </div>

      <JournalCalendar open={calOpen} onClose={() => setCalOpen(false)} selected={day} today={today} moods={moods} onPick={(k) => { go(k); setCalOpen(false); }} />
    </div>
  );
}

function JournalEditor({ day, locked }: { day: string; locked: boolean }) {
  const entry = useLiveQuery(() => db.journal.get(day), [day], null as JournalEntry | null | undefined);
  if (entry === null)
    return (
      <div className="grid h-40 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  return <JournalEditorInner day={day} initialHtml={entry?.html ?? ""} locked={locked} />;
}

function JournalEditorInner({ day, initialHtml, locked }: { day: string; initialHtml: string; locked: boolean }) {
  const [state, setState] = useState<"saved" | "saving">("saved");
  const [words, setWords] = useState(0);
  const last = useRef(initialHtml);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const html = pending.current;
    pending.current = null;
    if (html === null) return;
    try {
      await saveJournal(day, { html, markdown: htmlToMarkdown(html) });
      setState("saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la entrada.");
    }
  }, [day]);

  useEffect(() => () => void flush(), [flush]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {words} {words === 1 ? "palabra" : "palabras"}
        </span>
        <span className="inline-flex items-center gap-1">
          {state === "saving" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {state === "saving" ? "Guardando" : "Guardado"}
        </span>
      </div>
      <RichEditor
        html={initialHtml}
        readOnly={locked}
        placeholder="¿Qué tal ha ido el día? Escribe lo que quieras…"
        onChange={({ html, words: w }) => {
          if (locked) return;
          setWords(w);
          if (html === last.current) return;
          last.current = html;
          pending.current = html;
          setState("saving");
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => void flush(), 500);
        }}
      />
    </div>
  );
}

function JournalCalendar({
  open,
  onClose,
  selected,
  today,
  moods,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  selected: string;
  today: string;
  moods: Map<string, string | null>;
  onPick: (key: string) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(fromDayKey(selected)));
  useEffect(() => {
    if (open) setCursor(startOfMonth(fromDayKey(selected)));
  }, [open, selected]);
  const grid = monthGrid(cursor);
  const month = cursor.getMonth();
  const written = grid.filter((d) => d.getMonth() === month && moods.has(dayKey(d))).length;

  return (
    <GlassSheet open={open} onClose={onClose} title={monthTitle(cursor)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {written} {written === 1 ? "entrada" : "entradas"}
        </span>
        <div className="flex gap-1">
          <button type="button" aria-label="Mes anterior" onClick={() => setCursor((c) => addMonths(c, -1))} className="grid h-9 w-9 place-items-center rounded-full bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={dayKey(addMonths(cursor, 1)) > today}
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const k = dayKey(d);
          const has = moods.has(k);
          const emoji = moodEmoji(moods.get(k));
          const future = k > today;
          return (
            <button
              key={k}
              type="button"
              disabled={future}
              onClick={() => onPick(k)}
              aria-label={longDate(k)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm",
                d.getMonth() !== month && "opacity-30",
                future && "opacity-20",
                k === selected ? "bg-primary text-primary-foreground" : has ? "bg-accent" : "hover:bg-muted",
                k === today && k !== selected && "ring-1 ring-coral",
              )}
            >
              {emoji ? <span className="text-lg leading-none">{emoji}</span> : <span>{d.getDate()}</span>}
              {has && !emoji && <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-coral" />}
            </button>
          );
        })}
      </div>
    </GlassSheet>
  );
}
