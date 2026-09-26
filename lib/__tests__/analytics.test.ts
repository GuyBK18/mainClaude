import { describe, expect, it } from "vitest";
import type { LibrarySnapshot } from "@/lib/data";
import { analyticsFor } from "@/lib/analytics";
import { kpis } from "@/lib/stats";
import { mk, ss } from "./fixtures";

const TODAY = "2026-09-26";
const snap = (books: LibrarySnapshot["books"], sessions: LibrarySnapshot["sessions"] = []): LibrarySnapshot =>
  ({ version: 3, books, sessions, highlights: [], goals: [] }) as LibrarySnapshot;

// A: finished this year, all 300 pages logged in March and April.
const A = mk({ status: "completed", pageCount: 300, startedAt: "2026-03-01", finishedAt: "2026-04-10", genres: ["Fantasy"] });
// B: finished last December, nothing logged.
const B = mk({ status: "completed", pageCount: 200, startedAt: "2025-12-01", finishedAt: "2025-12-20", genres: ["Memoir"] });
// C: finished this year, the year only.
const C = mk({ status: "completed", pageCount: 400, finishedYear: 2026, genres: ["Fantasy", "Mystery"] });
// D: finished at an unknown time.
const D = mk({ status: "completed", pageCount: 100 });
// E: reading, 150 of 500 pages, 60 of them logged.
const E = mk({ status: "reading", pageCount: 500, currentPage: 150, startedAt: "2026-09-01" });
// F: finished in 2024, 100 of its 250 pages logged then.
const F = mk({ status: "completed", pageCount: 250, startedAt: "2024-05-01", finishedAt: "2024-05-31" });
const sessions = [
  ss(A.id, "2026-03-15", 100), ss(A.id, "2026-04-10", 200),
  ss(E.id, "2026-09-20", 40), ss(E.id, "2026-09-26", 20),
  ss(F.id, "2024-05-10", 100),
];
const data = snap([A, B, C, D, E, F], sessions);

describe("analytics ranges", () => {
  it("this year: dated and year-only books, logged pages plus the unlogged rest of finished books", () => {
    const a = analyticsFor(data, "year", TODAY);
    expect(a.start).toBe("2026-01-01");
    expect(a.finished.map((b) => b.id).sort()).toEqual([A.id, C.id].sort());
    expect(a.pages).toBe(300 + 60 + 400);
    expect(a.pagesPerReadingDay).toBe(Math.round(360 / 4));
    expect(a.averageLength).toBe(350);
    expect(a.medianDays).toBe(41);
    expect(a.months).toHaveLength(9);
    expect(a.months.map((m) => m.pages)).toEqual([0, 0, 100, 200, 0, 0, 0, 0, 60]);
  });

  it("last 12 months: back 364 days, dated books only", () => {
    const a = analyticsFor(data, "12m", TODAY);
    expect(a.start).toBe("2025-09-27");
    expect(a.finished.map((b) => b.id).sort()).toEqual([A.id, B.id].sort());
    expect(a.pages).toBe(300 + 60 + 200);
    expect(a.months[0].label).toBe("Sep 25");
    expect(a.months.at(-1)!.label).toBe("Sep 26");
    expect(a.months.find((m) => m.key === "2025-12")!.pages).toBe(200);
  });

  it("all time: every book, matching the dashboard's pages", () => {
    const a = analyticsFor(data, "all", TODAY);
    expect(a.finishedCount).toBe(5);
    expect(a.pages).toBe(kpis(data.books, data.sessions).totalPages);
    expect(a.pages).toBe(300 + 200 + 400 + 100 + 150 + 250);
    expect(a.start).toBe("2024-05-01");
    expect(a.months.find((m) => m.key === "2024-05")!.pages).toBe(250);
  });

  it("leaves out reading dated after today", () => {
    const later = snap(data.books, [...sessions, ss(E.id, "2026-09-27", 999)]);
    expect(analyticsFor(later, "year", TODAY).pages).toBe(760);
  });

  it("finds the middle of an even number of books", () => {
    const books = [4, 6, 10, 20].map((d) => mk({ status: "completed", startedAt: "2026-01-01", finishedAt: `2026-01-${String(d).padStart(2, "0")}` }));
    expect(analyticsFor(snap(books), "year", TODAY).medianDays).toBe(8);
  });

  it("shows nothing for an empty library", () => {
    const a = analyticsFor(snap([]), "all", TODAY);
    expect(a).toMatchObject({ finishedCount: 0, pages: 0, pagesPerReadingDay: null, averageLength: null, medianDays: null, start: TODAY });
    expect(a.months).toHaveLength(1);
  });
});
