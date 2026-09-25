import type { LibrarySnapshot } from "@/lib/data";
import { addDays } from "@/lib/dates";
import { genreDistribution, velocity } from "@/lib/stats";

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
  const earliest = data.sessions.reduce((min, s) => (s.date < min ? s.date : min), todayISO);
  const start = rangeStart(range, todayISO, earliest);
  const inRange = (date?: string) => Boolean(date && date >= start && date <= todayISO);

  const finished = data.books.filter((b) => b.status === "completed" && inRange(b.finishedAt));
  const sessions = data.sessions.filter((s) => inRange(s.date));

  const pages = sessions.reduce((sum, s) => sum + s.pages, 0);
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

  return {
    start,
    finishedCount: finished.length,
    pages,
    pagesPerReadingDay: activeDays ? Math.round(pages / activeDays) : null,
    averageLength: finished.length ? Math.round(finished.reduce((s, b) => s + b.pageCount, 0) / finished.length) : null,
    medianDays: median(speeds.map((v) => v.days)),
    genres: genreDistribution(finished),
    velocity: speeds,
    months,
  };
}
