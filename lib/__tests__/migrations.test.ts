import { describe, expect, it } from "vitest";
import type { Book } from "@/types/reading";
import type { LibrarySnapshot } from "@/lib/data/repository";
import { CURRENT_VERSION, emptyLibrary, migrate } from "@/lib/data/migrations";

const book = (id: string, over: Partial<Book> = {}): Book => ({
  id,
  title: id,
  author: "Someone",
  genres: ["Fantasy"],
  pageCount: 300,
  currentPage: 0,
  format: "paperback",
  status: "tbr",
  personalRating: null,
  goodreadsRating: null,
  cover: { palette: ["#000", "#fff", "#888"], style: "band" },
  addedAt: "2026-01-01",
  review: "",
  summary: "",
  ...over,
});

const stored: LibrarySnapshot = {
  books: [
    book("piranesi"),
    book("wolf-hall"),
    book("red-rising", { status: "completed", sourceUrl: "https://www.goodreads.com/book/show/15839976" }),
    book("stoner", { sourceUrl: "https://www.goodreads.com/book/show/166997" }),
  ],
  highlights: [
    { id: "hl-seed-0", bookId: "piranesi", text: "a", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: "hl-1", bookId: "red-rising", text: "b", createdAt: "2026-01-01T00:00:00.000Z" },
  ],
  sessions: [
    { id: "s-1", bookId: "wolf-hall", date: "2026-01-02", pages: 20 },
    { id: "s-2", bookId: "red-rising", date: "2026-01-03", pages: 40 },
  ],
  goals: [
    { year: 2026, target: 26 },
    { year: 2025, target: 40 },
  ],
};

describe("migrate to version 2", () => {
  it("removes the sample books with their highlights, sessions and goal, and keeps the reader's", () => {
    const next = migrate(stored);
    expect(next.version).toBe(CURRENT_VERSION);
    expect(next.books.map((b) => b.id)).toEqual(["red-rising", "stoner"]);
    expect(next.highlights.map((h) => h.id)).toEqual(["hl-1"]);
    expect(next.sessions.map((s) => s.id)).toEqual(["s-2"]);
    expect(next.goals).toEqual([{ year: 2025, target: 40 }]);
  });

  it("leaves a current library alone, even a book whose id matches a sample", () => {
    const current = { ...emptyLibrary(), books: [book("piranesi")] };
    expect(migrate(current).books).toHaveLength(1);
  });
});

describe("version 3", () => {
  it("clears dates and the page log the app made up for books marked finished", async () => {
    const { migrate } = await import("@/lib/data/migrations");
    const book = (id: string, startedAt: string, finishedAt: string) =>
      ({ id, title: id, status: "completed", pageCount: 300, startedAt, finishedAt }) as never;
    const out = migrate({
      version: 2,
      books: [book("stamped", "2026-09-26", "2026-09-26"), book("added", "2026-09-26", "2026-09-26"), book("real", "2026-09-01", "2026-09-20")],
      sessions: [
        { id: "s1", bookId: "added", date: "2026-09-26", pages: 300 },
        { id: "s2", bookId: "real", date: "2026-09-10", pages: 120 },
      ],
      highlights: [],
      goals: [],
    });
    const dates = Object.fromEntries(out.books.map((b) => [b.id, [b.startedAt, b.finishedAt]]));
    expect(dates.stamped).toEqual([undefined, undefined]);
    expect(dates.added).toEqual([undefined, undefined]);
    expect(dates.real).toEqual(["2026-09-01", "2026-09-20"]);
    expect(out.sessions.map((s) => s.id)).toEqual(["s2"]);
  });
});

describe("version 4", () => {
  const out = migrate({
    version: 3,
    books: [
      book("tracked", { status: "reading", currentPage: 321, trackedFrom: { date: "2026-09-25", jump: 285 } as never }),
      book("from-form", { status: "reading", currentPage: 130, trackedFrom: { date: "2026-09-25", jump: 0 } as never }),
      book("legacy", { status: "reading", currentPage: 340, startedAt: "2026-09-01" }),
      book("done", { status: "completed", currentPage: 300 }),
      book("unread", { status: "tbr", trackedFrom: { date: "2026-09-25", jump: 50 } as never }),
    ],
    sessions: [
      { id: "t1", bookId: "tracked", date: "2026-09-25", pages: 300 },
      { id: "t2", bookId: "tracked", date: "2026-09-26", pages: 21 },
      { id: "f1", bookId: "from-form", date: "2026-09-25", pages: 30 },
      { id: "l1", bookId: "legacy", date: "2026-09-20", pages: 300 },
      { id: "l2", bookId: "legacy", date: "2026-09-22", pages: 40 },
      { id: "d1", bookId: "done", date: "2026-05-01", pages: 120 },
      { id: "u1", bookId: "unread", date: "2026-09-25", pages: 50 },
    ],
    highlights: [],
    goals: [],
  });
  const start = Object.fromEntries(out.books.map((b) => [b.id, b.trackedFrom]));
  const log = (id: string) => out.sessions.filter((s) => s.bookId === id).map((s) => s.pages);

  it("takes the first jump out of the log and keeps it as the starting page", () => {
    expect(start.tracked).toEqual({ date: "2026-09-25", page: 285 });
    expect(log("tracked")).toEqual([15, 21]);
  });

  it("keeps reading from a page the form set, and estimates that page", () => {
    expect(start["from-form"]).toEqual({ date: "2026-09-25", page: 100 });
    expect(log("from-form")).toEqual([30]);
  });

  it("takes the first day of an older book being read as its starting point", () => {
    expect(start.legacy).toEqual({ date: "2026-09-20", page: 300 });
    expect(log("legacy")).toEqual([40]);
  });

  it("leaves finished books alone and clears Want to read", () => {
    expect(start.done).toBeUndefined();
    expect(log("done")).toEqual([120]);
    expect(start.unread).toBeUndefined();
    expect(log("unread")).toEqual([]);
  });
});
