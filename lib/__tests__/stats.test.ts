import { describe, expect, it } from "vitest";
import { completedIn, goalProgress, kpis, pagesRead, progressOf, velocity } from "@/lib/stats";
import { mk, ss } from "./fixtures";

describe("pages read", () => {
  it("uses the page count once finished and the current page otherwise", () => {
    expect(pagesRead(mk({ status: "completed", currentPage: 10 }))).toBe(300);
    expect(pagesRead(mk({ status: "reading", currentPage: 120 }))).toBe(120);
    expect(pagesRead(mk({ status: "dnf", currentPage: 40 }))).toBe(40);
    expect(pagesRead(mk({ status: "tbr" }))).toBe(0);
  });

  it("gives no progress for a book without pages", () => {
    expect(progressOf(mk({ pageCount: 0, status: "reading" }))).toBe(0);
    expect(progressOf(mk({ status: "reading", currentPage: 150 }))).toBe(0.5);
  });
});

describe("finished in a year", () => {
  it("dates a book by its finish date, then by its year", () => {
    const books = [
      mk({ status: "completed", finishedAt: "2026-03-01" }),
      mk({ status: "completed", finishedYear: 2026 }),
      mk({ status: "completed", finishedAt: "2025-12-31", finishedYear: 2026 }),
      mk({ status: "completed" }),
      mk({ status: "reading", finishedYear: 2026 }),
      mk({ status: "dnf", finishedAt: "2026-02-01" }),
    ];
    expect(completedIn(books, 2026)).toHaveLength(2);
    expect(completedIn(books, 2025)).toHaveLength(1);
  });
});

describe("yearly goal", () => {
  const done = [mk({ status: "completed", finishedAt: "2026-02-01" }), mk({ status: "completed", finishedYear: 2026 })];

  it("expects a share of the goal by the day of the year", () => {
    expect(goalProgress(done, 365, "2026-01-01")).toMatchObject({ year: 2026, done: 2, expected: 1, ahead: 1 });
    expect(goalProgress(done, 365, "2026-12-31").expected).toBe(365);
    expect(goalProgress([], 366, "2028-12-31").expected).toBe(366);
  });
});

describe("dashboard tiles", () => {
  it("counts finished books, pages and your own ratings", () => {
    const k = kpis([
      mk({ status: "completed", personalRating: 4 }),
      mk({ status: "completed", personalRating: 3 }),
      mk({ status: "reading", currentPage: 50 }),
      mk({ status: "tbr" }),
    ]);
    expect(k).toEqual({ totalBooks: 2, totalPages: 650, averageRating: 3.5, ratedCount: 2 });
  });

  it("counts reading logged on a book later moved back to Want to read", () => {
    const b = mk({ status: "tbr", currentPage: 0 });
    expect(kpis([b], [ss(b.id, "2026-03-01", 80)]).totalPages).toBe(80);
  });
});

describe("velocity", () => {
  it("counts the start and finish days", () => {
    const [v] = velocity([mk({ status: "completed", startedAt: "2026-03-01", finishedAt: "2026-03-10" })]);
    expect(v).toMatchObject({ days: 10, pagesPerDay: 30 });
    expect(velocity([mk({ status: "completed", finishedAt: "2026-03-10" })])).toHaveLength(0);
  });
});
