import type { Book, Genre, ReadingSession } from "@/types/reading";
import { addDays, daysBetween, parseISODate, yearOf } from "@/lib/dates";

export function pagesRead(book: Book) {
  return book.status === "completed" ? book.pageCount : book.currentPage;
}

export function progressOf(book: Book) {
  return book.pageCount > 0 ? pagesRead(book) / book.pageCount : 0;
}

export function completedIn(books: Book[], year: number) {
  return books.filter((b) => b.status === "completed" && (b.finishedAt ? yearOf(b.finishedAt) : b.finishedYear) === year);
}

export function goalProgress(books: Book[], target: number, todayISO: string) {
  const year = yearOf(todayISO);
  const done = completedIn(books, year).length;
  const dayOfYear = daysBetween(`${year}-01-01`, todayISO) + 1;
  const daysInYear = daysBetween(`${year}-01-01`, `${year + 1}-01-01`);
  const expected = (target * dayOfYear) / daysInYear;
  return { year, done, target, expected, ahead: done - expected };
}

/** Pages logged for each book, all time. */
export function loggedByBook(sessions: ReadingSession[]) {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(s.bookId, (map.get(s.bookId) ?? 0) + s.pages);
  return map;
}

/**
 * Pages read in each book, all time: where the book stands, or what was logged for it when
 * that is more, as for a book moved back to Want to read after some reading.
 */
export function allTimePages(books: Book[], sessions: ReadingSession[]) {
  const logged = loggedByBook(sessions);
  return books.reduce((sum, b) => sum + Math.max(pagesRead(b), logged.get(b.id) ?? 0), 0);
}

export function kpis(books: Book[], sessions: ReadingSession[] = []) {
  const completed = books.filter((b) => b.status === "completed");
  const rated = books.filter((b) => b.personalRating !== null);
  const avg = rated.length ? rated.reduce((s, b) => s + (b.personalRating ?? 0), 0) / rated.length : null;
  return {
    totalBooks: completed.length,
    totalPages: allTimePages(books, sessions),
    averageRating: avg,
    ratedCount: rated.length,
  };
}

export type HeatCell = { date: string; pages: number; level: 0 | 1 | 2 | 3 | 4; future: boolean };

/** Page thresholds for the heatmap's five steps. Fixed so the legend can name them. */
export const HEAT_STEPS = [1, 20, 40, 70] as const;

function levelFor(pages: number): HeatCell["level"] {
  if (pages <= 0) return 0;
  if (pages < HEAT_STEPS[1]) return 1;
  if (pages < HEAT_STEPS[2]) return 2;
  if (pages < HEAT_STEPS[3]) return 3;
  return 4;
}

export function pagesByDay(sessions: ReadingSession[]) {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.pages);
  return map;
}

/** Weeks (columns) of seven days (rows, Sunday first) ending with the current week. */
export function heatmap(sessions: ReadingSession[], todayISO: string, weeks = 53) {
  const byDay = pagesByDay(sessions);
  const weekday = parseISODate(todayISO).getDay();
  const start = addDays(todayISO, -(weeks - 1) * 7 - weekday);
  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const pages = byDay.get(date) ?? 0;
      column.push({ date, pages, level: levelFor(pages), future: date > todayISO });
    }
    grid.push(column);
  }
  return grid;
}

/** Pages and reading days from today back 364 days, one full year. */
export function lastYear(sessions: ReadingSession[], todayISO: string) {
  const from = addDays(todayISO, -364);
  const inYear = [...pagesByDay(sessions)].filter(([date, p]) => date >= from && date <= todayISO && p > 0);
  return { pages: inYear.reduce((sum, [, p]) => sum + p, 0), days: inYear.length };
}

export function streaks(sessions: ReadingSession[], todayISO: string) {
  const days = new Set([...pagesByDay(sessions).entries()].filter(([, p]) => p > 0).map(([d]) => d));
  // A streak stays alive through today until the day is over.
  let current = 0;
  let cursor = days.has(todayISO) ? todayISO : addDays(todayISO, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let longest = 0;
  for (const day of days) {
    if (days.has(addDays(day, -1))) continue;
    let run = 1;
    while (days.has(addDays(day, run))) run++;
    longest = Math.max(longest, run);
  }
  return { current, longest, activeDays: days.size };
}

export function genreDistribution(books: Book[]) {
  const counts = new Map<Genre, { books: number; pages: number }>();
  for (const book of books) {
    for (const genre of book.genres) {
      const entry = counts.get(genre) ?? { books: 0, pages: 0 };
      entry.books += 1;
      entry.pages += pagesRead(book);
      counts.set(genre, entry);
    }
  }
  return [...counts.entries()]
    .map(([genre, v]) => ({ genre, ...v }))
    .sort((a, b) => b.books - a.books || b.pages - a.pages);
}

export function velocity(books: Book[]) {
  return books
    .filter((b) => b.status === "completed" && b.startedAt && b.finishedAt)
    .map((b) => {
      const days = daysBetween(b.startedAt!, b.finishedAt!) + 1;
      return {
        id: b.id,
        title: b.title,
        author: b.author,
        pageCount: b.pageCount,
        days,
        pagesPerDay: Math.round((b.pageCount / days) * 10) / 10,
      };
    });
}

export function pagesByMonth(sessions: ReadingSession[], year: number) {
  const months = Array.from({ length: 12 }, (_, m) => ({ month: m, pages: 0 }));
  for (const s of sessions) {
    if (yearOf(s.date) === year) months[Number(s.date.slice(5, 7)) - 1].pages += s.pages;
  }
  return months;
}

export type LengthBucket = "short" | "medium" | "long";

export const LENGTH_BUCKETS: Record<LengthBucket, { label: string; test: (pages: number) => boolean }> = {
  short: { label: "Under 250 pages", test: (p) => p < 250 },
  medium: { label: "250–450 pages", test: (p) => p >= 250 && p <= 450 },
  long: { label: "Over 450 pages", test: (p) => p > 450 },
};
