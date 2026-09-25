import type { LibrarySnapshot } from "./repository";

/** Raise this with a new step below when stored libraries need a one-time change on load. */
export const CURRENT_VERSION = 2;

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

/** Brings a stored library up to the current version. Each step runs once, since the version is saved with it. */
export function migrate(data: LibrarySnapshot): LibrarySnapshot {
  let next = data;
  if ((next.version ?? 1) < 2) next = removeSamples(next);
  return { ...next, version: CURRENT_VERSION };
}

export function emptyLibrary(): LibrarySnapshot {
  return { version: CURRENT_VERSION, books: [], highlights: [], sessions: [], goals: [] };
}
