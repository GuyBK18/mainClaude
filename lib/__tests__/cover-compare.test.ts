import { describe, expect, it } from "vitest";
import { cellDistance, distinctCovers, fitsAsCover, GRID, hamming, hashFromGray, looksAlike, type CoverCheck, type CoverPrint } from "../cover-compare";

const gradient = Array.from({ length: 72 }, (_, i) => (i * 37) % 255);
/** A cover whose regions are one color, except the top two rows (the title band). */
const paint = (ground: number[], band: number[]) =>
  new Float32Array(Array.from({ length: GRID.cols * GRID.rows }, (_, i) => (i < GRID.cols * 2 ? band : ground)).flat());
const base: CoverPrint = { width: 300, height: 450, bits: hashFromGray(gradient), cells: paint([31, 63, 73], [217, 140, 60]) };
const flip = (bits: Uint8Array, n: number) => bits.map((b, i) => (i < n ? 1 - b : b));

describe("cover comparison", () => {
  it("hashes 9×8 gray cells into 64 bits", () => {
    expect(hashFromGray(Array.from({ length: 72 }, (_, i) => 72 - i)).every((b) => b === 1)).toBe(true);
    expect(hamming(base.bits, flip(base.bits, 5))).toBe(5);
  });

  it("sees the same cover at another size as alike, and a different cover or palette as different", () => {
    // Re-encoded: a few bits and a few color steps apart.
    expect(looksAlike(base, { ...base, bits: flip(base.bits, 4), cells: paint([34, 60, 76], [212, 144, 58]) })).toBe(true);
    // Different art.
    expect(looksAlike(base, { ...base, bits: flip(base.bits, 24) })).toBe(false);
    // Same design in another palette: dark teal against dark green is still a different edition.
    const green = paint([47, 74, 43], [233, 226, 207]);
    expect(cellDistance(base.cells, green)).toBeGreaterThan(20);
    expect(looksAlike(base, { ...base, cells: green })).toBe(false);
  });

  it("only takes portrait images of a real size", () => {
    expect(fitsAsCover({ width: 300, height: 450 })).toBe(true);
    expect(fitsAsCover({ width: 500, height: 500 })).toBe(false);
    expect(fitsAsCover({ width: 40, height: 60 })).toBe(false);
  });

  it("keeps covers in order, drops look-alikes, broken and square images, and waits for unchecked ones", () => {
    const checks = new Map<string, CoverCheck>([
      ["a", { status: "ok", print: base }],
      ["b", { status: "ok", print: { ...base, bits: flip(base.bits, 3) } }],
      ["c", { status: "ok", print: { ...base, bits: flip(base.bits, 30), cells: paint([220, 210, 190], [20, 20, 20]) } }],
      ["d", { status: "broken" }],
      ["e", { status: "unreadable" }],
      ["f", { status: "ok", print: { ...base, width: 500, height: 500, cells: paint([0, 0, 0], [0, 0, 0]) } }],
    ]);
    const kept = distinctCovers(["a", "b", "c", "d", "e", "f", "g"].map((url) => ({ url })), checks);
    expect(kept.map((k) => k.url)).toEqual(["a", "c", "e"]);
  });
});
