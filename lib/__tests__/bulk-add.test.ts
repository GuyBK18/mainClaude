import { describe, expect, it } from "vitest";
import type { Book } from "@/types/reading";
import { findInLibrary, goodreadsBookId, parseLinks, runQueue, sameBook } from "@/lib/bulk-add";

describe("parseLinks", () => {
  it("pulls links out of surrounding text and keeps their order", () => {
    const text = `My shelf:
      1. https://www.goodreads.com/book/show/5907.The_Hobbit (loved it)
      2. https://www.goodreads.com/book/show/13651.The_Dispossessed?from_search=true,
      and https://openlibrary.org/isbn/9780547928227.`;
    expect(parseLinks(text)).toEqual([
      { url: "https://www.goodreads.com/book/show/5907.The_Hobbit", goodreadsId: "5907" },
      { url: "https://www.goodreads.com/book/show/13651.The_Dispossessed?from_search=true", goodreadsId: "13651" },
      { url: "https://openlibrary.org/isbn/9780547928227", goodreadsId: undefined },
    ]);
  });

  it("adds the scheme to links pasted without one", () => {
    expect(parseLinks("www.goodreads.com/book/show/1 goodreads.com/book/show/2-dune")).toEqual([
      { url: "https://www.goodreads.com/book/show/1", goodreadsId: "1" },
      { url: "https://goodreads.com/book/show/2-dune", goodreadsId: "2" },
    ]);
  });

  it("counts the same Goodreads book once, whatever the slug or query", () => {
    const links = parseLinks(
      "https://www.goodreads.com/book/show/5907.The_Hobbit\nhttps://www.goodreads.com/en/book/show/5907?ref=share\nhttps://www.goodreads.com/book/show/5907",
    );
    expect(links).toHaveLength(1);
  });

  it("finds nothing in text without links", () => {
    expect(parseLinks("The Hobbit, Dune, הארי פוטר")).toEqual([]);
  });
});

describe("goodreadsBookId", () => {
  it("reads the id from book pages only", () => {
    expect(goodreadsBookId("https://www.goodreads.com/book/show/5907.The_Hobbit")).toBe("5907");
    expect(goodreadsBookId("https://m.goodreads.com/book/show/5907")).toBe("5907");
    expect(goodreadsBookId("https://www.goodreads.com/author/show/656983.J_R_R_Tolkien")).toBeUndefined();
    expect(goodreadsBookId("https://notgoodreads.com/book/show/5907")).toBeUndefined();
    expect(goodreadsBookId(undefined)).toBeUndefined();
  });
});

const book = (over: Partial<Book>): Book => ({
  id: "x",
  title: "The Hobbit",
  author: "J.R.R. Tolkien",
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

describe("sameBook", () => {
  it("matches on the Goodreads page, the ISBN in either form, or title and author", () => {
    const hobbit = { title: "The Hobbit", author: "J.R.R. Tolkien" };
    expect(sameBook({ ...hobbit, goodreadsId: "1" }, { title: "Other", author: "Else", goodreadsId: "1" })).toBe(true);
    expect(sameBook({ title: "A", author: "B", isbn: "0-547-92822-4" }, { title: "C", author: "D", isbn: "9780547928227" })).toBe(true);
    expect(sameBook(hobbit, { title: "Hobbit: or There and Back Again", author: "J. R. R. Tolkien" })).toBe(true);
    expect(sameBook(hobbit, { title: "The Hobbit", author: "Someone Else" })).toBe(false);
  });

  it("does not match two Hebrew titles that differ", () => {
    expect(sameBook({ title: "הארי פוטר ואבן החכמים", author: "ג'יי קיי רולינג" }, { title: "הארי פוטר וחדר הסודות", author: "ג'יי קיי רולינג" })).toBe(
      false,
    );
  });
});

describe("findInLibrary", () => {
  it("finds a book saved from the same Goodreads page", () => {
    const shelf = [book({ id: "hobbit", title: "Hobbit", sourceUrl: "https://www.goodreads.com/book/show/5907.The_Hobbit" })];
    expect(findInLibrary(shelf, { title: "Something", author: "Else", goodreadsId: "5907" })?.id).toBe("hobbit");
    expect(findInLibrary(shelf, { title: "Dune", author: "Frank Herbert", goodreadsId: "44767458" })).toBeUndefined();
  });
});

describe("runQueue", () => {
  it("runs every item with at most the given number at once", async () => {
    let running = 0;
    let peak = 0;
    const seen: number[] = [];
    await runQueue([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      seen.push(n);
      running--;
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it("starts nothing new once aborted", async () => {
    const controller = new AbortController();
    const seen: number[] = [];
    await runQueue(
      [1, 2, 3, 4],
      1,
      async (n) => {
        seen.push(n);
        if (n === 2) controller.abort();
      },
      controller.signal,
    );
    expect(seen).toEqual([1, 2]);
  });
});
