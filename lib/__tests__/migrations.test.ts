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
    book("red-rising", { sourceUrl: "https://www.goodreads.com/book/show/15839976" }),
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
