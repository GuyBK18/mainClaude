import type { Book, BookPatch, ReadingSession } from "@/types/reading";

/**
 * The book changes that come with moving to a page, and the pages to log for it.
 *
 * The first save of a book records where tracking begins. From page 0, the new page is where
 * the reader already was, so nothing is logged; from a page the form set, that page is the start
 * and the rest is reading. Going straight from page 0 to the end is the same as marking the book
 * finished, so it records no start. A step back takes pages off the log, then off the start, only
 * as far as needed for the two to fit under the new page. Reaching the last page finishes the
 * book today; stepping back from it reopens the book.
 */
export function progressPatch(book: Book, page: number, date: string, logged: number) {
  const next = Math.round(Math.min(book.pageCount, Math.max(0, page)));
  const delta = next - book.currentPage;
  if (delta === 0) return null;

  const patch: BookPatch = { currentPage: next };
  const from = book.trackedFrom;
  let log = 0;
  if (!from && logged === 0) {
    const start = book.currentPage === 0 ? next : book.currentPage;
    if (delta > 0 && start < book.pageCount) {
      patch.trackedFrom = { date, page: start };
      log = next - start;
    }
  } else if (delta > 0) {
    log = delta;
  } else {
    const excess = Math.max(0, (from?.page ?? 0) + logged - next);
    const offLog = Math.min(excess, logged);
    if (offLog) log = -offLog;
    const offStart = excess - offLog;
    if (from && offStart > 0) {
      const start = from.page - offStart;
      // Back to page 0 with nothing logged: the next save starts tracking afresh.
      patch.trackedFrom = start === 0 && logged === offLog ? undefined : { ...from, page: start };
    }
  }

  if (book.status === "tbr" && next > 0) {
    patch.status = "reading";
    patch.startedAt = date;
  }
  if (next === book.pageCount) {
    patch.status = "completed";
    patch.finishedAt = date;
    patch.finishedYear = undefined;
  } else if (book.status === "completed") {
    patch.status = "reading";
    patch.finishedAt = undefined;
    patch.finishedYear = undefined;
  }
  return { patch, delta, log };
}

/**
 * Sessions after logging `pages` against a book on a date. A step back takes the pages off
 * that day first, then off earlier days, latest first, so the logged total never runs past
 * where the book stands. Days that reach zero are dropped.
 */
export function withPages(sessions: ReadingSession[], bookId: string, date: string, pages: number, id: string) {
  if (pages > 0) {
    const existing = sessions.find((s) => s.bookId === bookId && s.date === date);
    return existing
      ? sessions.map((s) => (s === existing ? { ...s, pages: s.pages + pages } : s))
      : [...sessions, { id, bookId, date, pages }];
  }
  let left = -pages;
  const own = sessions
    .filter((s) => s.bookId === bookId && s.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const cut = new Map<ReadingSession, number>();
  for (const s of own) {
    if (left <= 0) break;
    const take = Math.min(left, s.pages);
    cut.set(s, s.pages - take);
    left -= take;
  }
  return sessions.flatMap((s) => {
    if (!cut.has(s)) return [s];
    const rest = cut.get(s)!;
    return rest > 0 ? [{ ...s, pages: rest }] : [];
  });
}
