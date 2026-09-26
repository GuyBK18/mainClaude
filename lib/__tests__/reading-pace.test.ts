import { describe, expect, it } from "vitest";
import type { Book, ReadingSession } from "@/types/reading";
import { paceText, readingPace, recentDays } from "@/lib/reading-pace";

const book = { id: "b", pageCount: 700, currentPage: 345, trackedFrom: { date: "2026-09-20", page: 285 } } as Book;
const s = (date: string, pages: number): ReadingSession => ({ id: date, bookId: "b", date, pages });

describe("reading pace", () => {
  it("waits for some reading after the starting point", () => {
    expect(readingPace(book, [], "2026-09-21")).toBeNull();
  });

  it("spreads the logged pages over every day since tracking began", () => {
    expect(readingPace(book, [s("2026-09-21", 30), s("2026-09-22", 30)], "2026-09-22")).toEqual({ perDay: 30, left: 12 });
    expect(readingPace(book, [s("2026-09-22", 60)], "2026-09-30")).toEqual({ perDay: 6, left: 60 });
  });

  it("counts reading on the day tracking began", () => {
    expect(readingPace(book, [s("2026-09-20", 36)], "2026-09-20")).toEqual({ perDay: 36, left: 10 });
  });

  it("starts an older book without a starting point at its first logged day", () => {
    const old = { ...book, trackedFrom: undefined };
    expect(readingPace(old, [s("2026-09-10", 20), s("2026-09-12", 20)], "2026-09-20")).toEqual({ perDay: 4, left: 89 });
  });

  it("charts the last days", () => {
    const early = { ...book, trackedFrom: { date: "2026-09-01", page: 285 } };
    expect(recentDays([s("2026-09-19", 5), s("2026-09-20", 30)], early, "2026-09-20", 3)).toEqual([
      { date: "2026-09-18", pages: 0 },
      { date: "2026-09-19", pages: 5 },
      { date: "2026-09-20", pages: 30 },
    ]);
  });
});

describe("pace edge cases", () => {
  it("words slow reading and a near finish plainly", () => {
    expect(paceText({ perDay: 0.3, left: 1000 })).toBe("Under a page a day. At this pace you finish in 1,000 days.");
    expect(paceText({ perDay: 1, left: 1 })).toBe("About 1 page a day. At this pace you finish in 1 day.");
    expect(paceText({ perDay: 30, left: 0 })).toBe("About 30 pages a day. At this pace you finish today.");
  });

  it("keeps the fraction so slow books are not rounded up", () => {
    const slow = readingPace(book, [s("2026-09-21", 3)], "2026-09-30");
    expect(slow!.perDay).toBeCloseTo(0.3);
    expect(slow!.left).toBe(1184);
  });
});
