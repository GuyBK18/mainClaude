import type { Book, ReadingSession } from "@/types/reading";
import { addDays, daysBetween } from "@/lib/dates";

/**
 * A book's reading days since tracking began. Where the reader already was when they started
 * tracking is never logged, so every logged day is reading.
 */
export function readingDays(sessions: ReadingSession[], book: Pick<Book, "id" | "trackedFrom">) {
  const own = sessions.filter((s) => s.bookId === book.id && s.pages > 0).sort((a, b) => a.date.localeCompare(b.date));
  const start = book.trackedFrom?.date ?? own[0]?.date;
  return { start, days: start ? own.filter((s) => s.date >= start) : [] };
}

/** Pages a day since tracking began, and the days left at that pace. Null until some reading is logged. */
export function readingPace(book: Book, sessions: ReadingSession[], now: string) {
  const { start, days } = readingDays(sessions, book);
  const pages = days.reduce((sum, s) => sum + s.pages, 0);
  if (!start || pages <= 0) return null;
  const perDay = pages / Math.max(1, daysBetween(start, now));
  return { perDay, left: Math.max(0, Math.ceil((book.pageCount - book.currentPage) / perDay)) };
}

const plural = (n: number, word: string) => `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;

/** The pace line under the progress slider. */
export function paceText({ perDay, left }: { perDay: number; left: number }) {
  const rate = perDay < 1 ? "Under a page a day." : `About ${plural(Math.round(perDay), "page")} a day.`;
  return `${rate} At this pace you finish ${left === 0 ? "today" : `in ${plural(left, "day")}`}.`;
}

/** Pages read on each of the last `count` days, oldest first. */
export function recentDays(sessions: ReadingSession[], book: Pick<Book, "id" | "trackedFrom">, now: string, count = 14) {
  const { days } = readingDays(sessions, book);
  const byDate = new Map(days.map((s) => [s.date, s.pages]));
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(now, i - count + 1);
    return { date, pages: Math.max(0, byDate.get(date) ?? 0) };
  });
}
