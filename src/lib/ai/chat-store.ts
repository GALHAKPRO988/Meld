import { create } from "zustand";
import type { ModelMessage } from "ai";
import { createModel, PROVIDERS } from "./providers";
import { buildTools, TOOL_LABELS, type AiAction } from "./tools";
import { effectiveAccess, SECTION_LABELS, SECTION_ORDER, useSettings } from "@/lib/settings";
import { db, uid, type StoredChat, type StoredChatMessage } from "@/lib/db";
import { toast } from "sonner";

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error" }
  | { type: "action"; actionId: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  parts: ChatPart[];
  error?: string;
}

interface ChatState {
  activeChatId: string | null;
  messages: ChatMessage[];
  status: "idle" | "submitted" | "streaming";
  actions: Record<string, AiAction & { undone: boolean }>;
  abort: AbortController | null;
  send: (text: string) => Promise<void>;
  reload: () => Promise<void>;
  stop: () => void;
  reset: () => void;
  loadChat: (chat: StoredChat) => void;
  undo: (actionId: string) => Promise<void>;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

function storedMessages(
  messages: ChatMessage[],
  actions: Record<string, AiAction & { undone: boolean }>,
): StoredChatMessage[] {
  return messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: message.parts
        .map((part) => {
          if (part.type === "text") return part.text;
          if (part.type !== "action") return "";
          const action = actions[part.actionId];
          return action ? `${action.undone ? "Deshecho: " : ""}${action.title}${action.detail ? ` · ${action.detail}` : ""}` : "";
        })
        .filter(Boolean)
        .join("\n"),
    }))
    .filter((message) => message.text.length > 0);
}

async function saveChatSnapshot(
  id: string,
  messages: ChatMessage[],
  actions: Record<string, AiAction & { undone: boolean }>,
): Promise<void> {
  const saved = storedMessages(messages, actions);
  const firstUserMessage = saved.find((message) => message.role === "user");
  if (!firstUserMessage) return;

  const current = await db.chats.get(id);
  const title = current?.title ?? firstUserMessage.text.replace(/\s+/g, " ").slice(0, 80);
  await db.chats.put({ id, title, messages: saved, updatedAt: Date.now() });
}

function scheduleChatSave(
  id: string,
  messages: ChatMessage[],
  actions: Record<string, AiAction & { undone: boolean }>,
): void {
  const oldTimer = saveTimers.get(id);
  if (oldTimer) clearTimeout(oldTimer);
  const timer = setTimeout(() => {
    saveTimers.delete(id);
    void saveChatSnapshot(id, messages, actions).catch((error: unknown) => {
      console.error("No se pudo guardar el chat localmente.", error);
      toast.error("No se pudo guardar el chat en este dispositivo.");
    });
  }, 400);
  saveTimers.set(id, timer);
}

function systemPrompt() {
  const { access, journalEnabled } = useSettings.getState();
  const acc = effectiveAccess(access, journalEnabled);
  const lines = SECTION_ORDER.filter((s) => s !== "diario" || journalEnabled).map((s) =>
    acc[s].enabled ? `- ${SECTION_LABELS[s]}: ${acc[s].mode === "write" ? "lectura y escritura" : "solo lectura"}` : `- ${SECTION_LABELS[s]}: sin acceso`,
  );
  const now = new Date();
  return [
    "Eres el asistente de Meld, una app de organización personal. Responde siempre en español, de forma breve y clara, usando Markdown cuando ayude.",
    `Fecha y hora actual: ${now.toLocaleString("es-ES", { dateStyle: "full", timeStyle: "short" })} (zona horaria ${Intl.DateTimeFormat().resolvedOptions().timeZone}, ISO ${now.toISOString()}).`,
    "Acceso a las secciones del usuario:",
    ...lines,
    "Usa solo las herramientas disponibles. Si te piden algo de una sección sin acceso o en solo lectura, explica que el usuario puede cambiarlo con el botón de la llave inglesa.",
  ].join("\n");
}

function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  return messages
    .map((m) => ({
      role: m.role,
      content: m.parts
        .filter((p): p is Extract<ChatPart, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join(""),
    }))
    .filter((m) => m.content.trim().length > 0) as ModelMessage[];
}

function errorMessage(err: unknown): string {
  const e = err as { statusCode?: number; message?: string; responseBody?: string };
  const status = e?.statusCode;
  if (status === 401 || status === 403) return "La clave API no es válida o no tiene permiso para este modelo. Revísala en Ajustes.";
  if (status === 404) return "El modelo elegido no existe para este proveedor. Elige otro en el selector de IA.";
  if (status === 429) return "El proveedor está limitando las peticiones. Espera un momento y vuelve a intentarlo.";
  if (status === 402) return "Tu cuenta del proveedor no tiene saldo suficiente.";
  if (e?.message?.includes("Failed to fetch")) return "No se pudo conectar con el proveedor. Comprueba tu conexión.";
  return e?.message || "Algo salió mal al hablar con la IA.";
}

export const useChat = create<ChatState>()((set, get) => ({
  activeChatId: null,
  messages: [],
  status: "idle",
  actions: {},
  abort: null,

  reset: () => {
    const { activeChatId, messages, actions } = get();
    if (activeChatId) scheduleChatSave(activeChatId, messages, actions);
    get().abort?.abort();
    set({ activeChatId: null, messages: [], status: "idle", actions: {}, abort: null });
  },

  stop: () => {
    get().abort?.abort();
    set({ status: "idle", abort: null });
  },

  reload: async () => {
    const { messages, status } = get();
    if (status !== "idle" || messages.length === 0) return;
    const settings = useSettings.getState();
    if (!settings.apiKeys[settings.provider]) return;
    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index--) {
      if (messages[index]?.role === "user") {
        lastUserIndex = index;
        break;
      }
    }
    if (lastUserIndex < 0) return;
    const text = messages[lastUserIndex]?.parts
      .filter((part): part is Extract<ChatPart, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    if (!text) return;

    const preservedMessages = messages.slice(0, lastUserIndex);
    const preservedActionIds = new Set(
      preservedMessages.flatMap((message) =>
        message.parts.flatMap((part) => (part.type === "action" ? [part.actionId] : [])),
      ),
    );
    const preservedActions = Object.fromEntries(
      Object.entries(get().actions).filter(([id]) => preservedActionIds.has(id)),
    );
    set({ messages: preservedMessages, actions: preservedActions });
    await get().send(text);
  },

  loadChat: (chat) => {
    const { activeChatId, messages, actions, abort } = get();
    if (activeChatId === chat.id) return;
    if (activeChatId) scheduleChatSave(activeChatId, messages, actions);
    abort?.abort();
    set({
      activeChatId: chat.id,
      messages: chat.messages.map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.text ? [{ type: "text", text: message.text }] : [],
      })),
      status: "idle",
      actions: {},
      abort: null,
    });
  },

  undo: async (actionId) => {
    const a = get().actions[actionId];
    if (!a || a.undone) return;
    await a.undo();
    set((s) => ({ actions: { ...s.actions, [actionId]: { ...a, undone: true } } }));
    const { activeChatId, messages, actions } = get();
    if (activeChatId) scheduleChatSave(activeChatId, messages, actions);
  },

  send: async (text) => {
    const settings = useSettings.getState();
    const provider = settings.provider;
    const apiKey = settings.apiKeys[provider];
    if (!apiKey) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", parts: [{ type: "text", text }] };
    const assistantId = uid();
    const chatId = get().activeChatId ?? uid();
    const history = [...get().messages, userMsg];
    const controller = new AbortController();
    set({
      activeChatId: chatId,
      messages: [...history, { id: assistantId, role: "assistant", parts: [] }],
      status: "submitted",
      abort: controller,
    });
    scheduleChatSave(chatId, get().messages, get().actions);

    const patch = (fn: (m: ChatMessage) => ChatMessage) => {
      let updated = false;
      set((s) => {
        if (s.activeChatId !== chatId) return s;
        updated = true;
        return { messages: s.messages.map((m) => (m.id === assistantId ? fn(m) : m)) };
      });
      if (updated) scheduleChatSave(chatId, get().messages, get().actions);
    };

    const report = (a: Omit<AiAction, "id">) => {
      if (get().activeChatId !== chatId) return;
      const id = uid();
      set((s) => ({ actions: { ...s.actions, [id]: { ...a, id, undone: false } } }));
      patch((m) => ({ ...m, parts: [...m.parts, { type: "action", actionId: id }] }));
    };

    try {
      const [{ streamText, isStepCount }, model] = await Promise.all([
        import("ai"),
        createModel(provider, settings.models[provider] ?? PROVIDERS[provider].models[0]?.id ?? "", apiKey),
      ]);
      const tools = buildTools(effectiveAccess(settings.access, settings.journalEnabled), report);
      const result = streamText({
        model,
        instructions: systemPrompt(),
        messages: toModelMessages(history),
        tools,
        stopWhen: isStepCount(20),
        maxRetries: 1,
        abortSignal: controller.signal,
      });

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          if (get().activeChatId === chatId) set({ status: "streaming" });
          patch((m) => {
            const parts = [...m.parts];
            const last = parts[parts.length - 1];
            if (last?.type === "text") parts[parts.length - 1] = { ...last, text: last.text + part.text };
            else parts.push({ type: "text", text: part.text });
            return { ...m, parts };
          });
        } else if (part.type === "tool-call") {
          if (get().activeChatId === chatId) set({ status: "streaming" });
          patch((m) => ({
            ...m,
            parts: [
              ...m.parts,
              { type: "tool", id: part.toolCallId, name: part.toolName, label: TOOL_LABELS[part.toolName] ?? part.toolName, status: "running" },
            ],
          }));
        } else if (part.type === "tool-result" || part.type === "tool-error") {
          const status = part.type === "tool-result" ? "done" : "error";
          patch((m) => ({
            ...m,
            parts: m.parts.map((p) => (p.type === "tool" && p.id === part.toolCallId ? { ...p, status } : p)),
          }));
        } else if (part.type === "error") {
          throw part.error;
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error(err);
        patch((m) => ({ ...m, error: errorMessage(err) }));
      }
    } finally {
      if (get().activeChatId === chatId) {
        await saveChatSnapshot(chatId, get().messages, get().actions).catch((error: unknown) => {
          console.error("No se pudo guardar el chat localmente.", error);
          toast.error("No se pudo guardar el chat en este dispositivo.");
        });
      }
      if (get().abort === controller) set({ status: "idle", abort: null });
    }
  },
}));
