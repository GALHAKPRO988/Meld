import "fake-indexeddb/auto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db, newTask } from "@/lib/db";
import { toggleTask } from "@/lib/tasks";
import { fireConfetti } from "@/lib/confetti";
import { haptic } from "@/lib/haptics";
import { toast } from "sonner";

vi.mock("@/lib/confetti", () => ({ fireConfetti: vi.fn() }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

describe("task completion feedback", () => {
  beforeEach(async () => {
    await db.tasks.clear();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    db.close();
    await db.delete();
  });

  it("celebrates only after every task due today is completed", async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const [first, last] = [
      newTask({ id: "today-1", due: today.getTime() }),
      newTask({ id: "today-2", due: today.getTime() + 1 }),
    ];
    await db.tasks.bulkAdd([
      first,
      last,
      newTask({ id: "tomorrow", due: tomorrow.getTime() }),
      newTask({ id: "undated" }),
    ]);

    await toggleTask(first);
    expect(haptic).toHaveBeenCalledWith(15);
    expect(fireConfetti).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();

    await toggleTask(last);
    expect(haptic).toHaveBeenCalledTimes(2);
    expect(fireConfetti).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith("¡Todas las tareas de hoy completadas! 🎉", {
      duration: 3500,
    });
  });
});
