import type { Book, BookPatch, ReadingSession } from "@/types/reading";

/**
 * The book changes that come with moving to a page, and the pages to log for it. The first save
 * of a book with no logged reading, from page 0, records its jump as the starting point. Reaching the last
 * page finishes the book today; stepping back from it reopens the book. A step back takes
 * pages off the log only when the log would otherwise run past the new page.
 */
export function progressPatch(book: Book, page: number, date: string, logged: number) {
  const next = Math.round(Math.min(book.pageCount, Math.max(0, page)));
  const delta = next - book.currentPage;
  if (delta === 0) return null;

  const patch: BookPatch = { currentPage: next };
  const log = delta > 0 ? delta : Math.min(0, next - logged);
  // A book already past page 0 has its starting point, from the form, so all of this is reading.
  if (logged === 0) patch.trackedFrom = delta > 0 ? { date, jump: book.currentPage === 0 ? delta : 0 } : undefined;
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
