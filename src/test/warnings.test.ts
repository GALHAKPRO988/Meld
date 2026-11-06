import { describe, expect, it } from "vitest";
import { taskWarnings, warnText } from "@/lib/reminders";
import type { Task } from "@/lib/db";

const task = (due: number) => ({ id: "t1", title: "Informe", status: "todo", hasTime: true, due }) as unknown as Task;

describe("aviso anticipado de tareas", () => {
  it("avisa 2 horas antes del vencimiento", () => {
    const due = 10 * 3600_000;
    expect(taskWarnings([task(due)], 2, due - 2 * 3600_000 - 1000, due - 2 * 3600_000)).toHaveLength(1);
    expect(taskWarnings([task(due)], 2, 0, due - 3 * 3600_000)).toHaveLength(0);
  });
  it("con 0 horas no avisa", () => {
    expect(taskWarnings([task(5000)], 0, 0, 10_000)).toHaveLength(0);
  });
  it("texto del aviso", () => {
    expect(warnText("Informe", 2)).toBe('Hey, te quedan 2 horas para hacer "Informe"');
  });
});
