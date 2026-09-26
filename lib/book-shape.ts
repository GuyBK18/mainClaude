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
