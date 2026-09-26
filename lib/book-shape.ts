import type { BookFormat } from "@/types/reading";

/**
 * How far the covers stand past the pages at the top, bottom and fore-edge, in pixels. A
 * hardcover's boards overhang the page block. A paperback is trimmed with its pages, so they
 * are flush. The pages always meet the spine.
 */
export function pageSquare(format: BookFormat) {
  return format === "hardcover" ? 3 : 0;
}

/** Transforms for the page faces of a book W wide, H tall and T thick, centered on the book. */
export function pageFaces(format: BookFormat, W: number, H: number) {
  const s = pageSquare(format);
  return {
    foreEdge: { height: H - 2 * s, transform: `translate(-50%, -50%) rotateY(90deg) translateZ(${W / 2 - s}px)` },
    top: { width: W - s, transform: `translate(-50%, -50%) translateX(${-s / 2}px) rotateX(90deg) translateZ(${H / 2 - s}px)` },
  };
}

/**
 * The inner sides of a hardcover's boards, where they stand past the pages. Each board is one
 * plane drawn from outside only, so without these the far board's overhang is not there when
 * seen from the front. The cover cloth folds over the board's edges, so the strips are drawn
 * as a border in the cover's color, open at the spine and see-through in the middle.
 */
export function boardInsides(format: BookFormat, T: number) {
  const s = pageSquare(format);
  if (!s) return [];
  return [
    // Back board, facing the front. Its left edge is the spine.
    { borderWidth: `${s}px ${s}px ${s}px 0`, transform: `translate(-50%, -50%) translateZ(${-T / 2}px)` },
    // Front board, facing the back. Turned around, its right edge is the spine.
    { borderWidth: `${s}px 0 ${s}px ${s}px`, transform: `translate(-50%, -50%) rotateY(180deg) translateZ(${-T / 2}px)` },
  ];
}
