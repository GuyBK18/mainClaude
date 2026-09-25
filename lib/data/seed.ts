import type { Book, Highlight, ReadingSession } from "@/types/reading";
import { addDays } from "@/lib/dates";
import type { LibrarySnapshot } from "./repository";
import seed from "./seed.json";

type SeedTimeline = {
  addedDaysAgo?: number;
  startDaysAgo?: number;
  endDaysAgo?: number;
  currentPage?: number;
};

type SeedBook = Omit<Book, "addedAt" | "startedAt" | "finishedAt" | "currentPage"> & {
  timeline: SeedTimeline;
};

type SeedHighlight = Omit<Highlight, "id" | "createdAt"> & { daysAgo: number };

/** Small deterministic PRNG so the seed library looks the same on every first load. */
function mulberry32(seedValue: number) {
  let a = seedValue;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Spreads `pages` over `span + 1` days from `start`, skipping some days the way real reading does. */
function spreadSessions(bookId: string, start: string, pages: number, span: number) {
  const rand = mulberry32(hash(bookId));
  const days = Math.max(1, span + 1);
  const weights = Array.from({ length: days }, (_, i) => {
    const isLast = i === days - 1;
    if (!isLast && days > 2 && rand() < 0.34) return 0;
    return 0.4 + rand() * (rand() < 0.15 ? 2.4 : 1);
  });
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;

  const sessions: ReadingSession[] = [];
  let assigned = 0;
  weights.forEach((weight, i) => {
    if (weight === 0) return;
    const isLast = i === days - 1;
    const share = isLast ? pages - assigned : Math.min(pages - assigned, Math.round((weight / total) * pages));
    if (share <= 0) return;
    assigned += share;
    sessions.push({ id: `s-${bookId}-${i}`, bookId, date: addDays(start, i), pages: share });
  });
  return sessions;
}

/** Turns the relative seed catalog into dated records anchored on `todayISO`. */
export function buildSeed(todayISO: string): LibrarySnapshot {
  const ago = (days: number) => addDays(todayISO, -days);
  const books: Book[] = [];
  const sessions: ReadingSession[] = [];

  for (const entry of seed.books as unknown as SeedBook[]) {
    const { timeline, ...rest } = entry;
    const startedAt = timeline.startDaysAgo !== undefined ? ago(timeline.startDaysAgo) : undefined;
    const finishedAt =
      rest.status === "completed" && timeline.endDaysAgo !== undefined ? ago(timeline.endDaysAgo) : undefined;
    const currentPage =
      rest.status === "completed" ? rest.pageCount : Math.min(rest.pageCount, timeline.currentPage ?? 0);
    const addedAt = ago(timeline.addedDaysAgo ?? (timeline.startDaysAgo ?? 0) + 14);

    books.push({ ...rest, addedAt, startedAt, finishedAt, currentPage });

    if (startedAt && timeline.startDaysAgo !== undefined) {
      // Reading books have sessions up to yesterday so today's slider moves start clean.
      const lastDaysAgo = timeline.endDaysAgo ?? 1;
      const span = timeline.startDaysAgo - lastDaysAgo;
      sessions.push(...spreadSessions(rest.id, startedAt, currentPage, span));
    }
  }

  const highlights: Highlight[] = (seed.highlights as unknown as SeedHighlight[]).map(({ daysAgo, ...h }, i) => ({
    ...h,
    id: `hl-seed-${i}`,
    createdAt: `${ago(daysAgo)}T20:00:00.000Z`,
  }));

  const year = Number(todayISO.slice(0, 4));
  return { books, highlights, sessions, goals: [{ year, target: seed.goal }] };
}
