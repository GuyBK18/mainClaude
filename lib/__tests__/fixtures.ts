import type { Book, ReadingSession } from "@/types/reading";

let n = 0;
export const mk = (over: Partial<Book> = {}): Book =>
  ({
    id: `b${++n}`, title: "T", author: "A", genres: ["Fantasy"], pageCount: 300, currentPage: 0, format: "paperback",
    status: "tbr", personalRating: null, goodreadsRating: null, cover: { palette: ["#000", "#fff", "#f00"], style: "band" },
    addedAt: "2026-01-01", review: "", summary: "", ...over,
  }) as Book;
export const ss = (bookId: string, date: string, pages: number): ReadingSession => ({ id: `${bookId}-${date}`, bookId, date, pages });
