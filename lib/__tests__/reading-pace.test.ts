import { describe, expect, it } from "vitest";
import type { Book, ReadingSession } from "@/types/reading";
import { readingPace, recentDays } from "@/lib/reading-pace";

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
