import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { useState } from "react";
import { Plus } from "lucide-react";
import { GlassButton, GlassPill, softSpring } from "@/components/glass/Glass";
import { OverlapSquaresIcon, SlidersIcon } from "@/components/icons";
import { Composer } from "@/components/home/Composer";
import { AiSelector } from "@/components/home/AiSelector";
import { AccessSelector } from "@/components/home/AccessSelector";
import { MessageList } from "@/components/home/MessageList";
import { MainMenu } from "@/components/MainMenu";
import { useChat } from "@/lib/ai/chat-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meld" },
      { name: "description", content: "Pregunta a tu IA y organiza páginas, tareas, calendario y diario. Todo en tu dispositivo." },
      { property: "og:title", content: "Meld" },
      { property: "og:description", content: "Organización personal con IA, privada y en local." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const [menu, setMenu] = useState(false);
  const hasMessages = useChat((s) => s.messages.length > 0);
  const reset = useChat((s) => s.reset);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="pt-safe absolute inset-x-0 top-0 z-30 px-[25px]">
        <div className="flex items-center justify-between pt-[18px]">
          <GlassButton aria-label="Abrir menú" className="lg:invisible" onClick={() => setMenu(true)}>
            <OverlapSquaresIcon size={32} />
          </GlassButton>
          <AnimatePresence>
            {hasMessages && (
              <GlassPill
                key="new"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                onClick={reset}
                className="h-10 rounded-full px-3.5"
              >
                <Plus className="h-4 w-4" /> Nuevo chat
              </GlassPill>
            )}
          </AnimatePresence>
          <Link to="/ajustes" aria-label="Ajustes">
            <GlassButton tabIndex={-1}>
              <SlidersIcon size={34} />
            </GlassButton>
          </Link>
        </div>
      </header>

      <LayoutGroup>
        {hasMessages ? <MessageList /> : <div className="flex-1" />}
        <motion.div
          layout
          transition={softSpring}
          className={hasMessages ? "pb-safe px-[17px] pb-3 pt-1" : "px-[25px] pt-[54px]"}
        >
          <Composer />
          <div className="relative mt-[18px] flex items-center justify-center gap-[11px]">
            <AiSelector placement={hasMessages ? "top" : "bottom"} />
            <AccessSelector placement={hasMessages ? "top" : "bottom"} />
          </div>
        </motion.div>
        {!hasMessages && <div className="flex-1" />}
      </LayoutGroup>

      <MainMenu open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
