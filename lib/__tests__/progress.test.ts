import { describe, expect, it } from "vitest";
import { booksForDay, dayPatch, progressPatch, withPages } from "@/lib/progress";
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

describe("a day the reader missed", () => {
  const reading = mk({ status: "reading", pageCount: 300, currentPage: 100, startedAt: "2026-09-20", trackedFrom: { date: "2026-09-20", page: 40 } });

  it("dates a save to the chosen day and moves the start back when needed", () => {
    const change = progressPatch(reading, 120, "2026-09-18", 60)!;
    expect(change.log).toBe(20);
    expect(change.patch).toMatchObject({ startedAt: "2026-09-18", trackedFrom: { date: "2026-09-18", page: 40 } });
    expect(progressPatch(reading, 120, "2026-09-25", 60)!.patch).not.toHaveProperty("startedAt");
  });

  it("finishes a book on the chosen day", () => {
    expect(progressPatch(reading, 300, "2026-09-24", 60)!.patch).toMatchObject({ status: "completed", finishedAt: "2026-09-24" });
  });

  it("sets a day's pages and moves the book by the difference", () => {
    const sessions = [ss(reading.id, "2026-09-22", 30), ss(reading.id, "2026-09-24", 30)];
    expect(dayPatch(reading, "2026-09-22", 50, sessions)).toEqual({ patch: { currentPage: 120 }, log: 20 });
    expect(dayPatch(reading, "2026-09-22", 10, sessions)).toEqual({ patch: { currentPage: 80 }, log: -20 });
    expect(dayPatch(reading, "2026-09-23", 15, sessions)).toEqual({ patch: { currentPage: 115 }, log: 15 });
    expect(dayPatch(reading, "2026-09-22", 30, sessions)).toBeNull();
  });

  it("starts tracking where the book stood when nothing was logged", () => {
    const fresh = mk({ status: "reading", pageCount: 300, currentPage: 50, startedAt: "2026-09-25" });
    expect(dayPatch(fresh, "2026-09-23", 20, [])!.patch).toEqual({ currentPage: 70, trackedFrom: { date: "2026-09-23", page: 50 }, startedAt: "2026-09-23" });
  });

  it("finishes on the last day of reading when a filled-in day reaches the end", () => {
    const near = mk({ status: "reading", pageCount: 300, currentPage: 290, startedAt: "2026-09-01" });
    const sessions = [ss(near.id, "2026-09-25", 30)];
    expect(dayPatch(near, "2026-09-20", 10, sessions)!.patch).toMatchObject({ status: "completed", finishedAt: "2026-09-25" });
  });

  it("gives a finished book's day only pages that were never logged", () => {
    const done = mk({ status: "completed", pageCount: 300, currentPage: 300, startedAt: "2026-09-10", finishedAt: "2026-09-20", trackedFrom: { date: "2026-09-10", page: 100 } });
    const sessions = [ss(done.id, "2026-09-12", 150)];
    // 300 pages: 100 before tracking, 150 logged, 50 never logged.
    expect(dayPatch(done, "2026-09-15", 80, sessions)).toEqual({ patch: {}, log: 50 });
    expect(dayPatch(done, "2026-09-12", 100, sessions)).toEqual({ patch: {}, log: -50 });
  });
});

describe("books for a day", () => {
  it("lists logged books first, then books being read, then finished books spanning the day", () => {
    const logged = mk({ status: "completed", finishedAt: "2026-05-01" });
    const reading = mk({ status: "reading" });
    const spanning = mk({ status: "completed", startedAt: "2026-09-01", finishedAt: "2026-09-30" });
    const later = mk({ status: "completed", startedAt: "2026-09-25", finishedAt: "2026-09-30" });
    const undatedStart = mk({ status: "completed", finishedAt: "2026-12-30" });
    const unread = mk({ status: "tbr" });
    const list = booksForDay([unread, later, undatedStart, spanning, reading, logged], [ss(logged.id, "2026-09-20", 12)], "2026-09-20");
    expect(list.map((x) => [x.book.id, x.pages])).toEqual([[logged.id, 12], [reading.id, 0], [spanning.id, 0]]);
  });
});
