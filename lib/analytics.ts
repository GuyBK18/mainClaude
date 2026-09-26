import type { LibrarySnapshot } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { allTimePages, genreDistribution, loggedByBook, velocity } from "@/lib/stats";

export type Range = "year" | "12m" | "all";

export const RANGE_LABEL: Record<Range, string> = {
  year: "This year",
  "12m": "Last 12 months",
  all: "All time",
};

const MONTH = new Intl.DateTimeFormat("en", { month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" });

function rangeStart(range: Range, todayISO: string, earliest: string) {
  if (range === "year") return `${todayISO.slice(0, 4)}-01-01`;
  if (range === "12m") return addDays(todayISO, -364);
  return earliest;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function analyticsFor(data: LibrarySnapshot, range: Range, todayISO: string) {
  const past = data.sessions.filter((s) => s.date <= todayISO);
  // All time starts with the first day anything was read: a logged day, or a book's start or finish.
  const dates = [...past.map((s) => s.date), ...data.books.flatMap((b) => [b.startedAt, b.finishedAt])];
  const earliest = dates.reduce<string>((min, d) => (d && d < min ? d : min), todayISO);
  const start = rangeStart(range, todayISO, earliest);
  const inRange = (date?: string) => Boolean(date && date >= start && date <= todayISO);

  // A finished book counts in a range when its finish date, or only its year for "This year",
  // falls in it. With neither it counts in all time only.
  const thisYear = Number(todayISO.slice(0, 4));
  const finishedInRange = (b: LibrarySnapshot["books"][number]) =>
    range === "all" || (b.finishedAt ? inRange(b.finishedAt) : range === "year" && b.finishedYear === thisYear);
  const finished = data.books.filter((b) => b.status === "completed" && finishedInRange(b));
  const sessions = data.sessions.filter((s) => inRange(s.date));

  // A finished book was read in full. Pages it has no logged reading for count when it was finished.
  const logged = loggedByBook(past);
  // Pages before tracking began were read at unknown times, so they count in all time only.
  const unlogged = finished.map((b) => ({ b, pages: Math.max(0, b.pageCount - (logged.get(b.id) ?? 0) - (b.trackedFrom?.page ?? 0)) }));

  const loggedPages = sessions.reduce((sum, s) => sum + s.pages, 0);
  // All time also counts pages of unfinished books that were never logged, as the dashboard does.
  const pages = range === "all" ? allTimePages(data.books, past) : loggedPages + unlogged.reduce((sum, u) => sum + u.pages, 0);
  const activeDays = new Set(sessions.filter((s) => s.pages > 0).map((s) => s.date)).size;
  const speeds = velocity(finished);

  // Monthly totals from the first month of the range to the current month.
  const months: { key: string; label: string; pages: number }[] = [];
  const cursor = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
  const last = new Date(Number(todayISO.slice(0, 4)), Number(todayISO.slice(5, 7)) - 1, 1);
  const spansYears = cursor.getFullYear() !== last.getFullYear();
  while (cursor <= last) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, label: (spansYears ? MONTH_YEAR : MONTH).format(cursor), pages: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const s of sessions) {
    const m = byKey.get(s.date.slice(0, 7));
    if (m) m.pages += s.pages;
  }
  for (const u of unlogged) {
    const m = u.b.finishedAt && byKey.get(u.b.finishedAt.slice(0, 7));
    if (m) m.pages += u.pages;
  }

  return {
    start,
    finished,
    finishedCount: finished.length,
    pages,
    // Only logged reading has days.
    pagesPerReadingDay: activeDays ? Math.round(loggedPages / activeDays) : null,
    averageLength: finished.length ? Math.round(finished.reduce((s, b) => s + b.pageCount, 0) / finished.length) : null,
    medianDays: median(speeds.map((v) => v.days)),
    genres: genreDistribution(finished),
    velocity: speeds,
    months,
  };
}
