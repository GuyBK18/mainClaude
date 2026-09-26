import { describe, expect, it } from "vitest";
import { pageFaces, pageSquare } from "../book-shape";

describe("book shape", () => {
  it("keeps paperback pages flush with the cover", () => {
    expect(pageSquare("paperback")).toBe(0);
    const faces = pageFaces("paperback", 126, 192);
    expect(faces.top.width).toBe(126);
    expect(faces.top.transform).toContain("translateZ(96px)");
    expect(faces.foreEdge.height).toBe(192);
    expect(faces.foreEdge.transform).toContain("translateZ(63px)");
  });

  it("sets hardcover pages in from the boards, the same at the top and the fore-edge", () => {
    const s = pageSquare("hardcover");
    expect(s).toBeGreaterThan(0);
    const faces = pageFaces("hardcover", 139, 212);
    expect(faces.top.transform).toContain(`translateZ(${106 - s}px)`);
    expect(faces.foreEdge.height).toBe(212 - 2 * s);
    expect(faces.foreEdge.transform).toContain(`translateZ(${69.5 - s}px)`);
    // The top of the pages runs from the spine to the fore-edge, with no gap at the spine.
    expect(faces.top.width).toBe(139 - s);
    expect(faces.top.transform).toContain(`translateX(${-s / 2}px)`);
  });
});
