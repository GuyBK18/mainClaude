import { describe, expect, it } from "vitest";
import { progressPatch, withPages } from "@/lib/progress";
import { mk, ss } from "./fixtures";

describe("saving a page", () => {
  const reading = mk({ status: "reading", pageCount: 300, currentPage: 100, startedAt: "2026-09-01" });

  it("does nothing when the page does not change and clamps to the book", () => {
    expect(progressPatch(reading, 100, "2026-09-26", 60)).toBeNull();
    expect(progressPatch(reading, 999, "2026-09-26", 60)!.delta).toBe(200);
    expect(progressPatch(reading, -5, "2026-09-26", 60)!.patch.currentPage).toBe(0);
  });

  it("records the first jump only when nothing is logged yet", () => {
    expect(progressPatch(reading, 150, "2026-09-26", 0)!.patch.trackedFrom).toEqual({ date: "2026-09-26", jump: 50 });
    expect(progressPatch(reading, 150, "2026-09-26", 60)!.patch).not.toHaveProperty("trackedFrom");
  });

  it("finishes the book on its last page and reopens it on a step back", () => {
    const done = progressPatch(reading, 300, "2026-09-26", 60)!.patch;
    expect(done).toMatchObject({ status: "completed", finishedAt: "2026-09-26", currentPage: 300 });
    const finished = mk({ status: "completed", pageCount: 300, currentPage: 300, finishedAt: "2026-09-20", finishedYear: 2026 });
    expect(progressPatch(finished, 290, "2026-09-26", 60)!.patch).toMatchObject({ status: "reading", finishedAt: undefined, finishedYear: undefined });
  });

  it("takes a step back off the log only past the new page", () => {
    expect(progressPatch(reading, 80, "2026-09-26", 100)!.log).toBe(-20);
    expect(progressPatch(reading, 80, "2026-09-26", 60)!.log).toBe(0);
    expect(progressPatch(reading, 120, "2026-09-26", 60)!.log).toBe(20);
  });
});

describe("logging pages", () => {
  const base = [ss("a", "2026-09-20", 30), ss("a", "2026-09-24", 20), ss("b", "2026-09-25", 50)];

  it("adds to the day or starts it", () => {
    expect(withPages(base, "a", "2026-09-24", 5, "n").find((s) => s.date === "2026-09-24")!.pages).toBe(25);
    expect(withPages(base, "a", "2026-09-26", 5, "n")).toHaveLength(4);
  });

  it("takes a step back off today, then earlier days, latest first", () => {
    const today = [...base, ss("a", "2026-09-26", 10)];
    const after = withPages(today, "a", "2026-09-26", -35, "n");
    expect(after.filter((s) => s.bookId === "a").map((s) => [s.date, s.pages])).toEqual([["2026-09-20", 25]]);
    expect(after.find((s) => s.bookId === "b")!.pages).toBe(50);
  });

  it("stops when nothing is left to take", () => {
    expect(withPages(base, "a", "2026-09-26", -500, "n").filter((s) => s.bookId === "a")).toHaveLength(0);
  });
});
