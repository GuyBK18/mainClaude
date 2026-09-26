import { describe, expect, it } from "vitest";
import type { Book } from "@/types/reading";
import {
  ANGLE_RANGE,
  DEFAULT_LEANING,
  layoutRows,
  MAX_PAGES,
  MIN_PAGES,
  poseAt,
  pullTarget,
  REVEAL_RANGE,
  slabOf,
  spinePages,
  springStep,
  toLeaningSettings,
  TURN_START,
  type LeaningSettings,
  type Placed,
  type Slab,
} from "../leaning-shelf";

type Shape = Pick<Book, "format" | "pageCount">;
// Thin and thick, short and tall, next to each other.
const SHAPES: Shape[] = [
  { format: "hardcover", pageCount: 476 },
  { format: "paperback", pageCount: 112 },
  { format: "hardcover", pageCount: 900 },
  { format: "paperback", pageCount: 180 },
  { format: "ebook", pageCount: 600 },
  { format: "audiobook", pageCount: 320 },
  { format: "hardcover", pageCount: 272 },
  { format: "paperback", pageCount: 864 },
  { format: "paperback", pageCount: 240 },
  { format: "hardcover", pageCount: 757 },
  { format: "paperback", pageCount: 1250 },
  { format: "hardcover", pageCount: 1500 },
  { format: "paperback", pageCount: 96 },
];
const slabs = SHAPES.map(slabOf);

/** The four corners of a book's footprint, seen from above. */
function footprint(slab: Slab, placed: Placed, settings: LeaningSettings, p: number) {
  const pose = poseAt(placed, settings, p);
  const a = (pose.angle * Math.PI) / 180;
  const w = [Math.cos(a), -Math.sin(a)];
  const n = [Math.sin(a), Math.cos(a)];
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([u, v]) => [
    pose.x + (u * slab.w * w[0] + v * slab.t * n[0]) / 2,
    pose.z + (u * slab.w * w[1] + v * slab.t * n[1]) / 2,
  ]);
}

/** Separating axis test for two convex footprints, allowing half a pixel of contact. */
function overlaps(a: number[][], b: number[][]) {
  for (const shape of [a, b]) {
    for (let k = 0; k < 4; k++) {
      const [x1, y1] = shape[k];
      const [x2, y2] = shape[(k + 1) % 4];
      const axis = [y1 - y2, x2 - x1];
      const len = Math.hypot(axis[0], axis[1]);
      const pa = a.map(([x, y]) => x * axis[0] + y * axis[1]);
      const pb = b.map(([x, y]) => x * axis[0] + y * axis[1]);
      if (Math.max(...pa) < Math.min(...pb) + 0.5 * len || Math.max(...pb) < Math.min(...pa) + 0.5 * len) return false;
    }
  }
  return true;
}

const settingsGrid = (): LeaningSettings[] => {
  const all: LeaningSettings[] = [];
  for (const mode of ["turn", "slide"] as const)
    for (let angle = ANGLE_RANGE.min; angle <= ANGLE_RANGE.max; angle += 5)
      for (let reveal = REVEAL_RANGE.min; reveal <= REVEAL_RANGE.max; reveal += 10) all.push({ mode, angle, reveal });
  return all;
};

describe("spine thickness", () => {
  const t = (pageCount: number, format: Shape["format"] = "paperback") => slabOf({ format, pageCount }).t;

  it("follows page count past 600 pages", () => {
    // Red Rising Saga: Iron Gold, Light Bringer, Dark Age.
    expect(t(600)).toBe(60);
    expect(t(680)).toBe(68);
    expect(t(757)).toBe(76);
    expect(t(1200) / t(600)).toBe(2);
  });

  it("keeps a readable spine for short books and a bound for mistyped counts", () => {
    expect(t(40)).toBe(t(MIN_PAGES));
    expect(t(MIN_PAGES + 40)).toBeGreaterThan(t(MIN_PAGES));
    expect(t(90000)).toBe(t(MAX_PAGES));
  });

  it("gives a book with no page count a typical spine", () => {
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(spinePages(bad)).toBe(320);
      expect(Number.isFinite(t(bad))).toBe(true);
    }
  });

  it("fits the thickest book alone on a phone-width row at every angle", () => {
    const thickest = slabOf({ format: "hardcover", pageCount: MAX_PAGES });
    for (let angle = ANGLE_RANGE.min; angle <= ANGLE_RANGE.max; angle++) {
      const settings = { ...DEFAULT_LEANING, angle };
      const [row] = layoutRows([thickest], settings, 288, 40);
      const a = (angle * Math.PI) / 180;
      expect(row[0].x + (thickest.w * Math.cos(a) + thickest.t * Math.sin(a)) / 2).toBeLessThanOrEqual(288 - 12);
    }
  });
});

describe("leaning shelf", () => {
  it("defaults to turning, 62° and 14 px, and repairs stored settings", () => {
    expect(DEFAULT_LEANING).toEqual({ mode: "turn", angle: 62, reveal: 14 });
    expect(toLeaningSettings(null)).toEqual(DEFAULT_LEANING);
    expect(toLeaningSettings({ mode: "slide", angle: 90, reveal: -3 })).toEqual({ mode: "slide", angle: 75, reveal: 0 });
  });

  it("wraps books into rows that fit the width", () => {
    const rows = layoutRows(slabs, DEFAULT_LEANING, 400, 40);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.flat().map((p) => p.index)).toEqual(slabs.map((_, i) => i));
    for (const row of rows) {
      const last = row[row.length - 1];
      const s = slabs[last.index];
      const a = (DEFAULT_LEANING.angle * Math.PI) / 180;
      expect(last.x + (s.w * Math.cos(a) + s.t * Math.sin(a)) / 2).toBeLessThanOrEqual(400 - 12 + 0.01);
    }
  });

  it("never pushes one book into another, at rest or while one is pulled out", () => {
    let checks = 0;
    const hits: string[] = [];
    for (const settings of settingsGrid()) {
      const [row] = layoutRows(slabs, settings, 5000, 8);
      const still = row.map((placed) => footprint(slabs[placed.index], placed, settings, 0));
      for (let i = 0; i < row.length; i++) {
        for (let p = 0; p <= 1.0001; p += 0.02) {
          const moving = footprint(slabs[row[i].index], row[i], settings, p);
          for (let j = 0; j < row.length; j++) {
            if (j === i) continue;
            checks++;
            if (overlaps(moving, still[j])) hits.push(`${settings.mode} ${settings.angle}° ${settings.reveal}px: book ${i} into ${j} at ${p.toFixed(2)}`);
          }
        }
      }
    }
    expect(hits.slice(0, 5)).toEqual([]);
    expect(checks).toBeGreaterThan(10000);
  });

  it("keeps books of any length apart while one turns out", () => {
    // Forty books from 100 to 1500 pages in a scrambled order.
    const mixed = Array.from({ length: 40 }, (_, i) =>
      slabOf({ format: (["hardcover", "paperback", "ebook", "audiobook"] as const)[i % 4], pageCount: 100 + ((i * 373) % 1400) }),
    );
    const hits: string[] = [];
    for (const settings of settingsGrid().filter((s) => s.reveal % 20 === 0)) {
      const [row] = layoutRows(mixed, settings, 50000, 8);
      const still = row.map((placed) => footprint(mixed[placed.index], placed, settings, 0));
      for (let i = 0; i < row.length; i++) {
        for (let p = 0; p <= 1.0001; p += 0.02) {
          const moving = footprint(mixed[row[i].index], row[i], settings, p);
          for (let j = Math.max(0, i - 2); j <= Math.min(row.length - 1, i + 2); j++) {
            if (j !== i && overlaps(moving, still[j])) hits.push(`${settings.mode} ${settings.angle}° ${settings.reveal}px: book ${i} into ${j} at ${p.toFixed(2)}`);
          }
        }
      }
    }
    expect(hits.slice(0, 5)).toEqual([]);
  });

  it("would catch a book that comes straight out toward the reader", () => {
    const [row] = layoutRows(slabs, DEFAULT_LEANING, 5000, 8);
    const straight = footprint(slabs[row[0].index], row[0], DEFAULT_LEANING, 0).map(([x, z]) => [x, z + 60]);
    expect(overlaps(straight, footprint(slabs[row[1].index], row[1], DEFAULT_LEANING, 0))).toBe(true);
  });

  it("lets one book turn at a time", () => {
    expect(pullTarget(false, 0.5, [0, 0], "turn")).toBe(0);
    expect(pullTarget(true, 0, [0, 0], "turn")).toBe(1);
    // Another book is turned: wait on the shelf.
    expect(pullTarget(true, 0, [0.8, 0], "turn")).toBe(0);
    // Another book is sliding home, no longer turned: slide out, but do not turn yet.
    expect(pullTarget(true, 0, [0.3, 0], "turn")).toBeLessThan(TURN_START);
    // Books that only slide never turn, so they need not wait.
    expect(pullTarget(true, 0, [0.8, 0], "slide")).toBe(1);
  });

  it("keeps books apart when the pointer moves from one book to the next", () => {
    const hits: string[] = [];
    for (const settings of settingsGrid()) {
      const [row] = layoutRows(slabs, settings, 5000, 8);
      for (const [from, to] of [[3, 4], [4, 3]]) {
        const state = row.map(() => ({ p: 0, v: 0 }));
        for (let step = 0; step < 360; step++) {
          const up = step < 120 ? from : to;
          const ps = state.map((s) => s.p);
          state.forEach((s, i) => {
            const target = pullTarget(i === up, s.p, ps.filter((_, j) => j !== i), settings.mode);
            Object.assign(s, springStep(s.p, s.v, target, 1 / 120));
          });
          const prints = row.map((placed, i) => footprint(slabs[placed.index], placed, settings, state[i].p));
          for (let i = 0; i < row.length; i++)
            for (let j = i + 1; j < row.length; j++)
              if ((state[i].p > 0 || state[j].p > 0) && overlaps(prints[i], prints[j]))
                hits.push(`${settings.mode} ${settings.angle}° ${settings.reveal}px step ${step}: ${i} and ${j}`);
        }
        expect(state[to].p).toBeGreaterThan(0.99);
      }
    }
    expect(hits.slice(0, 5)).toEqual([]);
  }, 30000);
});
