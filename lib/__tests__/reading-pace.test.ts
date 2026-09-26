import { describe, expect, it } from "vitest";
import type { Book, ReadingSession } from "@/types/reading";
import { paceText, readingPace, recentDays } from "@/lib/reading-pace";

const book = { id: "b", pageCount: 700, currentPage: 345 } as Book;
const s = (date: string, pages: number): ReadingSession => ({ id: date, bookId: "b", date, pages });

describe("reading pace", () => {
  it("treats the first logged day as the starting point", () => {
    expect(readingPace(book, [s("2026-09-20", 285)], "2026-09-21")).toBeNull();
    const pace = readingPace(book, [s("2026-09-20", 285), s("2026-09-21", 30), s("2026-09-22", 30)], "2026-09-22");
    expect(pace).toEqual({ perDay: 30, left: 12 });
  });

  it("spreads the pages over every day since the start", () => {
    expect(readingPace(book, [s("2026-09-10", 285), s("2026-09-12", 60)], "2026-09-20")).toEqual({ perDay: 6, left: 60 });
  });

  it("charts the last days without the starting point", () => {
    const days = recentDays([s("2026-09-19", 285), s("2026-09-20", 30)], book, "2026-09-20", 3);
    expect(days).toEqual([
      { date: "2026-09-18", pages: 0 },
      { date: "2026-09-19", pages: 0 },
      { date: "2026-09-20", pages: 30 },
    ]);
  });

  it("counts the rest of the first day once the jump is known", () => {
    const tracked = { ...book, trackedFrom: { date: "2026-09-20", jump: 285 } };
    expect(readingPace(tracked, [s("2026-09-20", 321)], "2026-09-20")).toEqual({ perDay: 36, left: 10 });
  });
});

describe("pace edge cases", () => {
  it("words slow reading and a near finish plainly", () => {
    expect(paceText({ perDay: 0.3, left: 1000 })).toBe("Under a page a day. At this pace you finish in 1,000 days.");
    expect(paceText({ perDay: 1, left: 1 })).toBe("About 1 page a day. At this pace you finish in 1 day.");
    expect(paceText({ perDay: 30, left: 0 })).toBe("About 30 pages a day. At this pace you finish today.");
  });

  it("keeps the fraction so slow books are not rounded up", () => {
    const slow = readingPace(book, [s("2026-09-01", 285), s("2026-09-02", 3)], "2026-09-11");
    expect(slow!.perDay).toBeCloseTo(0.3);
    expect(slow!.left).toBe(1184);
  });

  it("treats a same-day step back below the jump as moving the starting point", () => {
    const tracked = { ...book, trackedFrom: { date: "2026-09-20", jump: 285 } };
    expect(readingPace(tracked, [s("2026-09-20", 270)], "2026-09-21")).toBeNull();
    expect(recentDays([s("2026-09-20", 270)], tracked, "2026-09-20", 1)).toEqual([{ date: "2026-09-20", pages: 0 }]);
  });

  it("counts the first day in full when the book started from a known page", () => {
    const known = { ...book, trackedFrom: { date: "2026-09-20", jump: 0 } };
    expect(readingPace(known, [s("2026-09-20", 30), s("2026-09-21", 30)], "2026-09-21")).toEqual({ perDay: 60, left: 6 });
  });
});
