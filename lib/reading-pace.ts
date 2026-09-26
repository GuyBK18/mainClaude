import type { Book, ReadingSession } from "@/types/reading";
import { addDays, daysBetween } from "@/lib/dates";

/**
 * A book's reading days after its first logged day. The first day only records where the
 * reader was when they started tracking, often deep into a book begun elsewhere, so it
 * says nothing about how fast they read.
 */
export function readingDays(sessions: ReadingSession[], book: Pick<Book, "id" | "trackedFrom">) {
  const own = sessions.filter((s) => s.bookId === book.id).sort((a, b) => a.date.localeCompare(b.date));
  const from = book.trackedFrom;
  // Books tracked before trackedFrom existed: the whole first day is the starting point.
  if (!from) return { start: own[0]?.date, days: own.slice(1) };
  const days = own
    .filter((s) => s.date >= from.date)
    .map((s) => (s.date === from.date ? { ...s, pages: s.pages - from.jump } : s))
    .filter((s) => s.pages > 0);
  return { start: from.date, days };
}

/** Pages a day since tracking began, and the days left at that pace. Null until a second day is logged. */
export function readingPace(book: Book, sessions: ReadingSession[], now: string) {
  const { start, days } = readingDays(sessions, book);
  const pages = days.reduce((sum, s) => sum + s.pages, 0);
  if (!start || pages <= 0) return null;
  const perDay = pages / Math.max(1, daysBetween(start, now));
  return { perDay: Math.max(1, Math.round(perDay)), left: Math.ceil((book.pageCount - book.currentPage) / perDay) };
}

/** Pages read on each of the last `count` days, oldest first, leaving out the starting point. */
export function recentDays(sessions: ReadingSession[], book: Pick<Book, "id" | "trackedFrom">, now: string, count = 14) {
  const { days } = readingDays(sessions, book);
  const byDate = new Map(days.map((s) => [s.date, s.pages]));
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(now, i - count + 1);
    return { date, pages: Math.max(0, byDate.get(date) ?? 0) };
  });
}
