import type { LibrarySnapshot } from "./repository";

/** Raise this with a new step below when stored libraries need a one-time change on load. */
export const CURRENT_VERSION = 4;

// The sample library that the first version wrote on first load. Listed only so it can be removed.
const SAMPLE_BOOK_IDS = new Set([
  "a-wizard-of-earthsea",
  "anna-karenina",
  "bluets",
  "braiding-sweetgrass",
  "bring-up-the-bodies",
  "children-of-time",
  "gilead",
  "h-is-for-hawk",
  "klara-and-the-sun",
  "meditations",
  "middlemarch",
  "pachinko",
  "piranesi",
  "project-hail-mary",
  "stoner",
  "the-anthropocene-reviewed",
  "the-brothers-karamazov",
  "the-dispossessed",
  "the-hearing-trumpet",
  "the-left-hand-of-darkness",
  "the-master-and-margarita",
  "the-mirror-and-the-light",
  "the-name-of-the-rose",
  "the-overstory",
  "the-remains-of-the-day",
  "the-secret-history",
  "the-tombs-of-atuan",
  "the-waves",
  "the-years",
  "tomorrow-and-tomorrow-and-tomorrow",
  "wolf-hall",
]);
const SAMPLE_GOAL = 26;

/**
 * Version 2 removes the sample books with their highlights and reading sessions, and the sample
 * yearly goal. Books the reader added stay. Sample books never had a source link, so a book with a
 * sample id and a link is one the reader added after deleting the sample, and it stays too.
 */
function removeSamples(data: LibrarySnapshot): LibrarySnapshot {
  const gone = new Set(data.books.filter((b) => SAMPLE_BOOK_IDS.has(b.id) && !b.sourceUrl).map((b) => b.id));
  return {
    ...data,
    books: data.books.filter((b) => !gone.has(b.id)),
    highlights: data.highlights.filter((h) => !gone.has(h.bookId)),
    sessions: data.sessions.filter((s) => !gone.has(s.bookId)),
    goals: data.goals.filter((g) => g.target !== SAMPLE_GOAL),
  };
}

/**
 * Version 3 removes reading dates the app made up. Marking a book Finished used to date both
 * its start and finish to that day, and adding one as Finished also logged every page as read
 * that day. A finished book with the same start and finish day, and either no reading logged or
 * exactly its page count logged that day, got its dates this way: they are cleared, and that
 * one session is removed. A book really read in a day with the slider logs its pages the same
 * way, which is rare; daily backup copies keep the old library.
 */
function clearStampedDates(data: LibrarySnapshot): LibrarySnapshot {
  const stamped = new Map<string, string>();
  for (const b of data.books) {
    if (b.status !== "completed" || !b.startedAt || b.startedAt !== b.finishedAt) continue;
    const own = data.sessions.filter((s) => s.bookId === b.id);
    if (own.length === 0 || (own.length === 1 && own[0].date === b.finishedAt && own[0].pages === b.pageCount)) stamped.set(b.id, b.finishedAt);
  }
  return {
    ...data,
    books: data.books.map((b) => (stamped.has(b.id) ? { ...b, startedAt: undefined, finishedAt: undefined } : b)),
    sessions: data.sessions.filter((s) => stamped.get(s.bookId) !== s.date),
  };
}

type Session = LibrarySnapshot["sessions"][number];
/** How version 3 stored the start of tracking: the first save's jump, logged on that day. */
type OldStart = { date: string; jump?: number; page?: number };

/**
 * Version 4 takes starting points out of the reading log. The first save of a book at page 0
 * says where the reader already was, not what they read that day, so it now sets where tracking
 * began and is never logged: those pages count in all-time totals only.
 * - A book tracked in version 3 has its jump taken off its first day.
 * - A book being read (or set aside) from before that has its whole first day taken as its
 *   starting point, which is how the reading card already treated it.
 * - A book in Want to read loses its reading days, as moving one there now does.
 * Daily backup copies keep the old library.
 */
function separateStartingPoints(data: LibrarySnapshot): LibrarySnapshot {
  let sessions = data.sessions;
  const own = (id: string) => sessions.filter((s) => s.bookId === id).sort((a, b) => a.date.localeCompare(b.date));
  const total = (list: Session[]) => list.reduce((sum, s) => sum + s.pages, 0);

  const books = data.books.map((b) => {
    if (b.status === "tbr") {
      sessions = sessions.filter((s) => s.bookId !== b.id);
      return { ...b, trackedFrom: undefined };
    }
    const old = b.trackedFrom as OldStart | undefined;
    if (old && old.jump !== undefined) {
      if (old.jump > 0) {
        const jump = old.jump;
        sessions = sessions
          .map((s) => (s.bookId === b.id && s.date === old.date ? { ...s, pages: s.pages - jump } : s))
          .filter((s) => s.pages > 0);
        return { ...b, trackedFrom: { date: old.date, page: jump } };
      }
      // Started from a page the form set. That page was not kept, so it is where the book stands less what was read since.
      const page = b.status === "completed" ? 0 : Math.max(0, b.currentPage - total(own(b.id)));
      return { ...b, trackedFrom: { date: old.date, page } };
    }
    const log = own(b.id);
    if (!old && (b.status === "reading" || b.status === "dnf") && log.length > 0) {
      const [first, ...rest] = log;
      sessions = sessions.filter((s) => s !== first);
      return { ...b, trackedFrom: { date: first.date, page: Math.max(0, b.currentPage - total(rest)) } };
    }
    return b;
  });
  return { ...data, books, sessions };
}

/** Brings a stored library up to the current version. Each step runs once, since the version is saved with it. */
export function migrate(data: LibrarySnapshot): LibrarySnapshot {
  let next = data;
  if ((next.version ?? 1) < 2) next = removeSamples(next);
  if ((next.version ?? 1) < 3) next = clearStampedDates(next);
  if ((next.version ?? 1) < 4) next = separateStartingPoints(next);
  return { ...next, version: CURRENT_VERSION };
}

export function emptyLibrary(): LibrarySnapshot {
  return { version: CURRENT_VERSION, books: [], highlights: [], sessions: [], goals: [] };
}
