import { describe, expect, it } from "vitest";
import { displayColumns, displayMargins } from "@/components/library/library-shelf";

describe("Display shelf", () => {
  it("counts columns the way the grid does", () => {
    expect(displayColumns(150)).toBe(1);
    expect(displayColumns(307)).toBe(1);
    expect(displayColumns(308)).toBe(2);
    expect(displayColumns(100)).toBe(1);
  });

  it("leaves empty board at the ends without losing a column on a laptop or a phone", () => {
    const wide = displayMargins(1176);
    expect(wide.left).toBeGreaterThanOrEqual(16);
    expect(wide.right).toBeGreaterThan(wide.left);
    expect(displayColumns(1176 - wide.left - wide.right)).toBe(7);
    const phone = displayMargins(328);
    expect(displayColumns(328 - phone.left - phone.right)).toBe(2);
  });
});
