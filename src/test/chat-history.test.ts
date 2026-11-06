import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db, type StoredChat } from "@/lib/db";
import { useChat } from "@/lib/ai/chat-store";
import { saveJournal } from "@/lib/journal";
import { useSettings } from "@/lib/settings";

describe("chat history", () => {
  afterEach(async () => {
    await db.chats.clear();
    useChat.setState({
      activeChatId: null,
      messages: [],
      status: "idle",
      actions: {},
      abort: null,
    });
  });

  it("stores chats locally and restores their messages", async () => {
    const chat: StoredChat = {
      id: "local-chat",
      title: "Planear la semana",
      messages: [
        { id: "user-1", role: "user", text: "Ayúdame a planear la semana" },
        { id: "assistant-1", role: "assistant", text: "Claro, empecemos por tus prioridades." },
      ],
      updatedAt: Date.now(),
    };

    await db.chats.put(chat);
    const saved = await db.chats.get(chat.id);
    expect(saved).toEqual(chat);
    if (!saved) throw new Error("No se guardó el chat de prueba.");

    useChat.getState().loadChat(saved);
    expect(useChat.getState().activeChatId).toBe(chat.id);
    expect(useChat.getState().messages.map((message) => message.parts)).toEqual([
      [{ type: "text", text: "Ayúdame a planear la semana" }],
      [{ type: "text", text: "Claro, empecemos por tus prioridades." }],
    ]);
  });

  it("rejects writes to past journal entries while locking is enabled", async () => {
    const original = useSettings.getState().lockPastJournalEntries;
    try {
      useSettings.getState().setLockPastJournalEntries(true);
      await expect(
        saveJournal("2000-01-01", { html: "<p>Texto</p>", markdown: "Texto" }),
      ).rejects.toThrow("protegida");
    } finally {
      useSettings.getState().setLockPastJournalEntries(original);
    }
  });
});
