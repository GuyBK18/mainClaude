import type { Book, BookPatch, ReadingStatus } from "@/types/reading";
import { today } from "@/lib/dates";

/** The date and page changes that come with moving a book to a new status. */
export function statusPatch(book: Book, status: ReadingStatus): BookPatch {
  const date = today();
  switch (status) {
    case "completed":
      return { status, currentPage: book.pageCount, startedAt: book.startedAt ?? date, finishedAt: book.finishedAt ?? date };
    case "reading":
      return { status, startedAt: book.startedAt ?? date, finishedAt: undefined };
    case "dnf":
      return { status, startedAt: book.startedAt ?? date, finishedAt: undefined };
    case "tbr":
      return { status, currentPage: 0, startedAt: undefined, finishedAt: undefined };
  }
}
