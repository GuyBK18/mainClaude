import { describe, expect, it } from "vitest";
import type { Book } from "@/types/reading";
import { sortBooks } from "@/lib/library-filter";

const book = (title: string, series?: [string, number]): Book => ({
  id: title,
  title,
  author: "Someone",
  genres: ["Fantasy"],
  pageCount: 300,
  currentPage: 0,
  format: "paperback",
  status: "tbr",
  personalRating: null,
  goodreadsRating: null,
  series: series && { name: series[0], position: series[1] },
  cover: { palette: ["#000", "#fff", "#888"], style: "band" },
  addedAt: "2026-01-01",
  review: "",
  summary: "",
});

const shelf = [
  book("Standalone B"),
  book("The Two Towers", ["The Lord of the Rings", 2]),
  book("Leviathan Wakes", ["The Expanse", 1]),
  book("The Return of the King", ["The Lord of the Rings", 3]),
  book("Standalone A"),
  book("The Fellowship of the Ring", ["The Lord of the Rings", 1]),
  book("Caliban's War", ["The Expanse", 2]),
  book("Gods of Risk", ["The Expanse", 2.5]),
];

const titles = (books: Book[]) => books.map((b) => b.title);

describe("sort by series", () => {
  it("keeps each series together, first to last, with standalone books after", () => {
    expect(titles(sortBooks(shelf, "series", "asc"))).toEqual([
      "Leviathan Wakes",
      "Caliban's War",
      "Gods of Risk",
      "The Fellowship of the Ring",
      "The Two Towers",
      "The Return of the King",
      "Standalone A",
      "Standalone B",
    ]);
  });

  it("flips the order of the series but not the books inside one", () => {
    expect(titles(sortBooks(shelf, "series", "desc"))).toEqual([
      "The Fellowship of the Ring",
      "The Two Towers",
      "The Return of the King",
      "Leviathan Wakes",
      "Caliban's War",
      "Gods of Risk",
      "Standalone A",
      "Standalone B",
    ]);
  });
});
