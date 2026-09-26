import type { Book, BookPatch, ReadingStatus } from "@/types/reading";
import { today } from "@/lib/dates";

/** When a book was read. Either date may be unknown. */
export interface ReadDates {
  startedAt?: string;
  finishedAt?: string;
}

/**
 * Dates to offer when a book moves to Finished. A book you were reading most likely ended
 * today. A book you had not started, or had set aside, was read at some time the app cannot
 * know, so it offers no finish date rather than guess one.
 */
export function finishDefaults(book: Pick<Book, "status" | "startedAt" | "finishedAt">): ReadDates {
  return {
    startedAt: book.startedAt,
    finishedAt: book.finishedAt ?? (book.status === "reading" ? today() : undefined),
  };
}

/** Why a pair of reading dates cannot be saved, or null when they can. */
export function datesProblem({ startedAt, finishedAt }: ReadDates) {
  const now = today();
  if (startedAt && startedAt > now) return "The start date is in the future.";
  if (finishedAt && finishedAt > now) return "The finish date is in the future.";
  if (startedAt && finishedAt && finishedAt < startedAt) return "The book finishes before it starts.";
  return null;
}

/**
 * The date and page changes that come with moving a book to a new status. Starting to read
 * happens now, so it is dated today. Finishing takes the dates the reader gives, and none
 * when they do not remember: an undated book counts in all-time totals but in no time range.
 */
export function statusPatch(book: Book, status: ReadingStatus, dates?: ReadDates): BookPatch {
  switch (status) {
    case "completed": {
      const { startedAt, finishedAt } = dates ?? finishDefaults(book);
      return { status, currentPage: book.pageCount, startedAt, finishedAt };
    }
    case "reading":
      return { status, startedAt: book.startedAt ?? today(), finishedAt: undefined };
    case "dnf":
      return { status, finishedAt: undefined };
    case "tbr":
      return { status, currentPage: 0, startedAt: undefined, finishedAt: undefined, finishedYear: undefined };
  }
}
