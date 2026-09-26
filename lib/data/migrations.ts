import type { LibrarySnapshot } from "./repository";

/** Raise this with a new step below when stored libraries need a one-time change on load. */
export const CURRENT_VERSION = 3;

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

/** Brings a stored library up to the current version. Each step runs once, since the version is saved with it. */
export function migrate(data: LibrarySnapshot): LibrarySnapshot {
  let next = data;
  if ((next.version ?? 1) < 2) next = removeSamples(next);
  if ((next.version ?? 1) < 3) next = clearStampedDates(next);
  return { ...next, version: CURRENT_VERSION };
}

export function emptyLibrary(): LibrarySnapshot {
  return { version: CURRENT_VERSION, books: [], highlights: [], sessions: [], goals: [] };
}
