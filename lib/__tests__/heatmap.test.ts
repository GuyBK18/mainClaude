import { describe, expect, it } from "vitest";
import { heatmap, lastYear, streaks } from "@/lib/stats";
import { ss } from "./fixtures";

describe("heatmap", () => {
  // 2026-09-26 is a Saturday.
  const grid = heatmap([ss("a", "2026-09-26", 25), ss("b", "2026-09-26", 50), ss("a", "2026-09-20", 1), ss("a", "2025-01-01", 500)], "2026-09-26");

  it("ends with the current week, Sunday first", () => {
    expect(grid).toHaveLength(53);
    const last = grid[52];
    expect(last[0].date).toBe("2026-09-20");
    expect(last[6].date).toBe("2026-09-26");
    expect(grid[0][0].date).toBe("2025-09-21");
  });

  it("adds up the books read on one day and steps the shade by pages", () => {
    expect(grid[52][6]).toMatchObject({ pages: 75, level: 4, future: false });
    expect(grid[52][0]).toMatchObject({ pages: 1, level: 1 });
    const levels = heatmap([19, 20, 39, 40, 69, 70].map((p, i) => ss("a", `2026-09-0${i + 1}`, p)), "2026-09-26")
      .flat()
      .filter((c) => c.pages)
      .map((c) => c.level);
    expect(levels).toEqual([1, 2, 2, 3, 3, 4]);
  });

  it("marks days after today as future", () => {
    const wed = heatmap([], "2026-09-23");
    expect(wed[52][3].future).toBe(false);
    expect(wed[52][4].future).toBe(true);
  });
});

describe("the last year", () => {
  it("covers today and the 364 days before it", () => {
    const sessions = [ss("a", "2026-09-26", 10), ss("a", "2025-09-27", 5), ss("a", "2025-09-26", 100), ss("b", "2026-09-26", 3), ss("a", "2026-01-02", 0)];
    expect(lastYear(sessions, "2026-09-26")).toEqual({ pages: 18, days: 2 });
  });
});

describe("streaks", () => {
  const days = (...d: string[]) => d.map((x) => ss("a", x, 10));

  it("keeps the streak alive until today is over", () => {
    expect(streaks(days("2026-09-24", "2026-09-25"), "2026-09-26").current).toBe(2);
    expect(streaks(days("2026-09-24", "2026-09-25", "2026-09-26"), "2026-09-26").current).toBe(3);
    expect(streaks(days("2026-09-23", "2026-09-24"), "2026-09-26").current).toBe(0);
  });

  it("finds the longest run and ignores empty days", () => {
    const s = [...days("2026-01-01", "2026-01-02", "2026-01-03", "2026-02-01"), ss("a", "2026-01-04", 0)];
    expect(streaks(s, "2026-09-26")).toEqual({ current: 0, longest: 3, activeDays: 4 });
  });

  it("counts a streak across a month and a year end", () => {
    expect(streaks(days("2025-12-31", "2026-01-01"), "2026-01-01")).toMatchObject({ current: 2, longest: 2 });
  });
});
