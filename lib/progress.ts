import type { Book, BookPatch, ReadingSession } from "@/types/reading";
import { daysBetween } from "@/lib/dates";

/**
 * The book changes that come with moving to a page, and the pages to log for it.
 *
 * The first save of a book records where tracking begins. From page 0, the new page is where
 * the reader already was, so nothing is logged; from a page the form set, that page is the start
 * and the rest is reading. Going straight from page 0 to the end is the same as marking the book
 * finished, so it records no start. A step back takes pages off the log, then off the start, only
 * as far as needed for the two to fit under the new page. Reaching the last page finishes the
 * book on that day; stepping back from it reopens the book.
 *
 * `date` is the day the reading happened, today or a day the reader missed. Reading dated before
 * the book's start, or before tracking began, moves those back to that day.
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

  if (log > 0) Object.assign(patch, startsBy(book, date, "trackedFrom" in patch ? patch.trackedFrom : from));
  if (book.status === "tbr" && next > 0) {
    patch.status = "reading";
    patch.startedAt = date;
  }
  Object.assign(patch, finishing(book, next, date));
  return { patch, delta, log };
}

/** Moves the start date and the start of tracking back to a day with reading, when they are later. */
function startsBy(book: Book, date: string, from: Book["trackedFrom"]): BookPatch {
  const patch: BookPatch = {};
  if (!book.startedAt || date < book.startedAt) patch.startedAt = date;
  if (from && date < from.date) patch.trackedFrom = { ...from, date };
  return patch;
}

/** Finishes a book that reaches its last page on `date`, or reopens a finished one that leaves it. */
function finishing(book: Book, next: number, date: string): BookPatch {
  if (next === book.pageCount && book.status !== "completed") return { status: "completed", finishedAt: date, finishedYear: undefined };
  if (next < book.pageCount && book.status === "completed") return { status: "reading", finishedAt: undefined, finishedYear: undefined };
  return {};
}

/**
 * Sets the pages read in a book on one day, as when the reader fills in a day they missed.
 * A book in progress moves its page by the difference. A finished book stays on its last page,
 * so a day can only take pages that were never logged. Returns the book changes and the pages
 * to add to that day (negative to take off), or null when nothing changes.
 */
export function dayPatch(book: Book, date: string, pages: number, sessions: ReadingSession[]) {
  const own = sessions.filter((s) => s.bookId === book.id);
  const that = own.find((s) => s.date === date)?.pages ?? 0;
  const logged = own.reduce((sum, s) => sum + s.pages, 0);
  const start = book.trackedFrom?.page ?? 0;
  const want = Math.max(0, Math.round(pages));

  if (book.status === "completed") {
    const room = Math.max(0, book.pageCount - start - (logged - that));
    const log = Math.min(want, room) - that;
    if (log === 0) return null;
    const patch: BookPatch = log > 0 && book.startedAt && date < book.startedAt ? { startedAt: date } : {};
    return { patch, log };
  }

  const next = Math.min(book.pageCount, Math.max(0, book.currentPage + want - that));
  const log = next - book.currentPage;
  if (log === 0) return null;
  const patch: BookPatch = { currentPage: next };
  if (log > 0) {
    // With nothing logged yet, tracking begins where the book stood.
    const from = book.trackedFrom ?? (logged === 0 ? { date, page: book.currentPage } : undefined);
    if (from && !book.trackedFrom) patch.trackedFrom = from;
    Object.assign(patch, startsBy(book, date, from));
  }
  // A book finished by a filled-in day ends on its last day of reading.
  const lastDay = own.reduce((max, s) => (s.date > max ? s.date : max), date);
  Object.assign(patch, finishing(book, next, lastDay));
  return { patch, log };
}

/**
 * The books a reader could have read on a day: any with reading logged that day, every book
 * being read or set aside, and finished books whose reading spans the day. Logged ones first.
 */
export function booksForDay(books: Book[], sessions: ReadingSession[], date: string) {
  const onDay = new Map(sessions.filter((s) => s.date === date).map((s) => [s.bookId, s.pages]));
  const spans = (b: Book) =>
    Boolean(b.finishedAt && b.finishedAt >= date && (b.startedAt ? b.startedAt <= date : daysBetween(date, b.finishedAt) <= 30));
  return books
    .filter((b) => onDay.has(b.id) || b.status === "reading" || b.status === "dnf" || (b.status === "completed" && spans(b)))
    .map((b) => ({ book: b, pages: onDay.get(b.id) ?? 0 }))
    .sort((a, b) => b.pages - a.pages || rank(a.book) - rank(b.book));
}

const rank = (b: Book) => (b.status === "reading" ? 0 : b.status === "dnf" ? 1 : 2);

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
