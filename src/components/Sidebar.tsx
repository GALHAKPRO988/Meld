import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, History, MessageCircle, PanelLeftClose, PanelLeftOpen, Search, Settings } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { SECTION_ICONS } from "@/components/AccessList";
import { SECTION_ROUTES } from "@/components/MainMenu";
import { useChat } from "@/lib/ai/chat-store";
import { db } from "@/lib/db";
import { SECTION_LABELS, SECTION_ORDER, useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

const active = { className: "bg-muted text-foreground" };

/** Desktop-only navigation column (lg and up), collapsible to an icon rail. */
export function Sidebar() {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const setCollapsed = useSettings((s) => s.setSidebarCollapsed);
  const [chatsCollapsed, setChatsCollapsed] = useState(false);
  const chats = useLiveQuery(() => db.chats.orderBy("updatedAt").reverse().toArray(), []);
  const activeChatId = useChat((s) => s.activeChatId);
  const loadChat = useChat((s) => s.loadChat);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsed(!useSettings.getState().sidebarCollapsed);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCollapsed]);

  const item = cn(
    "flex items-center gap-3 rounded-2xl py-2.5 text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
    collapsed ? "justify-center px-0" : "px-3",
  );
  const label = (t: string) => (collapsed ? <span className="sr-only">{t}</span> : t);

  return (
    <aside
      aria-label="Navegación"
      className="glass glass-solid fixed inset-y-3 left-3 z-30 hidden w-[calc(var(--sidebar-w)-24px)] flex-col gap-1 rounded-[30px] p-3 transition-[width] duration-300 lg:flex"
    >
      <div className="relative z-10 flex h-full flex-col gap-1">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(item, "mb-1")}
          aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}
          title="Ctrl + \\"
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" strokeWidth={1.7} /> : <PanelLeftClose className="h-5 w-5" strokeWidth={1.7} />}
          {!collapsed && "Plegar"}
        </button>
        <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }} title="Chat">
          <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={1.7} /> {label("Chat")}
        </Link>
        <Link to="/buscar" search={{ q: "" }} className={item} activeProps={active} title="Buscar">
          <Search className="h-5 w-5 shrink-0" strokeWidth={1.7} /> {label("Buscar")}
        </Link>
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setChatsCollapsed((value) => !value)}
            aria-expanded={!chatsCollapsed}
            aria-label={chatsCollapsed ? "Mostrar chats anteriores" : "Ocultar chats anteriores"}
            title="Chats Anteriores"
            className={cn(item, "w-full")}
          >
            <History className="h-5 w-5 shrink-0" strokeWidth={1.7} />
            {label("Chats Anteriores")}
            {!collapsed &&
              (chatsCollapsed ? (
                <ChevronRight className="ml-auto h-4 w-4" />
              ) : (
                <ChevronDown className="ml-auto h-4 w-4" />
              ))}
          </button>
          {!collapsed && !chatsCollapsed && (
            <div className="no-scrollbar mt-1 flex max-h-[30dvh] flex-col gap-0.5 overflow-y-auto pl-2">
              {chats === undefined ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Cargando chats…</p>
              ) : chats.length ? (
                chats.map((chat) => (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      loadChat(chat);
                      void navigate({ to: "/" });
                    }}
                    title={chat.title}
                    className={cn(
                      "flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-muted",
                      activeChatId === chat.id ? "bg-muted text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{chat.title || "Chat sin título"}</span>
                    <time
                      className="shrink-0 text-[10px] text-muted-foreground"
                      dateTime={new Date(chat.updatedAt).toISOString()}
                    >
                      {`(${new Date(chat.updatedAt).toLocaleTimeString("es-ES", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })})`}
                    </time>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-muted-foreground">Aún no hay chats guardados.</p>
              )}
            </div>
          )}
        </div>
        <div className="my-2 h-px bg-border" />
        {SECTION_ORDER.map((s) => {
          const Icon = SECTION_ICONS[s];
          return (
            <Link key={s} to={SECTION_ROUTES[s]} className={item} activeProps={active} title={SECTION_LABELS[s]}>
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.7} /> {label(SECTION_LABELS[s])}
            </Link>
          );
        })}
        <div className="flex-1" />
        <Link to="/ajustes" className={item} activeProps={active} title="Ajustes">
          <Settings className="h-5 w-5 shrink-0" strokeWidth={1.7} /> {label("Ajustes")}
        </Link>
      </div>
    </aside>
  );
}
