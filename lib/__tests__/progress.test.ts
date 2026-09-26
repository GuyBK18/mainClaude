import { describe, expect, it } from "vitest";
import { progressPatch, withPages } from "@/lib/progress";
import { mk, ss } from "./fixtures";

const D = "2026-09-26";

describe("saving a page", () => {
  const reading = mk({ status: "reading", pageCount: 300, currentPage: 100, startedAt: "2026-09-01", trackedFrom: { date: "2026-09-01", page: 40 } });

  it("does nothing when the page does not change and clamps to the book", () => {
    expect(progressPatch(reading, 100, D, 60)).toBeNull();
    expect(progressPatch(reading, 999, D, 60)!.delta).toBe(200);
    expect(progressPatch(reading, -5, D, 60)!.patch.currentPage).toBe(0);
  });

  it("logs reading forward", () => {
    expect(progressPatch(reading, 130, D, 60)!.log).toBe(30);
  });

  it("starts tracking from page 0 without logging the jump", () => {
    const fresh = mk({ status: "reading", pageCount: 700, currentPage: 0 });
    const first = progressPatch(fresh, 285, D, 0)!;
    expect(first.patch.trackedFrom).toEqual({ date: D, page: 285 });
    expect(first.log).toBe(0);
  });

  it("starts tracking from a page the form set and logs the rest", () => {
    const added = mk({ status: "reading", pageCount: 300, currentPage: 100 });
    const first = progressPatch(added, 130, D, 0)!;
    expect(first.patch.trackedFrom).toEqual({ date: D, page: 100 });
    expect(first.log).toBe(30);
  });

  it("treats going from page 0 straight to the end as marking it finished", () => {
    const fresh = mk({ status: "reading", pageCount: 300, currentPage: 0 });
    const done = progressPatch(fresh, 300, D, 0)!;
    expect(done.patch).not.toHaveProperty("trackedFrom");
    expect(done.log).toBe(0);
    expect(done.patch).toMatchObject({ status: "completed", finishedAt: D });
  });

  it("steps back off the log first, then off the starting page", () => {
    // Started at 40, 60 logged, at 100.
    expect(progressPatch(reading, 80, D, 60)).toMatchObject({ log: -20 });
    expect(progressPatch(reading, 80, D, 60)!.patch).not.toHaveProperty("trackedFrom");
    const deep = progressPatch(reading, 30, D, 60)!;
    expect(deep.log).toBe(-60);
    expect(deep.patch.trackedFrom).toEqual({ date: "2026-09-01", page: 30 });
  });

  it("starts over when stepped back to page 0 with nothing logged", () => {
    const jumped = mk({ status: "reading", pageCount: 700, currentPage: 285, trackedFrom: { date: D, page: 285 } });
    const back = progressPatch(jumped, 0, D, 0)!;
    expect(back.patch).toHaveProperty("trackedFrom", undefined);
    expect(back.log).toBe(0);
  });

  it("leaves the log alone on a step back that still fits", () => {
    const finishedByStatus = mk({ status: "completed", pageCount: 300, currentPage: 300, trackedFrom: { date: "2026-09-01", page: 40 } });
    const reopened = progressPatch(finishedByStatus, 290, D, 100)!;
    expect(reopened.log).toBe(0);
    expect(reopened.patch).toMatchObject({ status: "reading", finishedAt: undefined, finishedYear: undefined });
  });

  it("finishes the book on its last page", () => {
    expect(progressPatch(reading, 300, D, 60)!.patch).toMatchObject({ status: "completed", finishedAt: D, currentPage: 300 });
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
