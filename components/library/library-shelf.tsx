"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Book } from "@/types/reading";
import { boardEndInset } from "@/lib/leaning-shelf";
import { layoutSpring, swapVariants, type Direction } from "@/lib/motion";
import { Book3D, SHELF_BASE } from "./book-3d";
import { boardClip, shelfBoard } from "./shelf-board";

const ROW = 292;
const BASE = ROW - SHELF_BASE;
// Each book has its own camera, so its front corners reach a few pixels below where it stands.
const BOARD = { back: BASE - 8, front: BASE + 12, edge: BASE + 20, row: ROW };
const MIN_COLUMN = 150;
const GAP = 8;

/**
 * Room at each end of a row, so the first and last book have empty board beside them. The
 * books turn their right side toward the wall, where the board's end slants in, so the right
 * needs more. Phones keep only the slant, so two books still fit across.
 */
export function displayMargins(width: number) {
  const slant = boardEndInset(width);
  const space = width < 640 ? 0 : 16;
  return { left: space + Math.round(slant / 4), right: space + Math.round((slant * 3) / 4) };
}

/** How many columns `repeat(auto-fill, minmax(150px, 1fr))` makes in `inner` pixels. */
export function displayColumns(inner: number) {
  return Math.max(1, Math.floor((inner + GAP) / (MIN_COLUMN + GAP)));
}

const item = swapVariants({ opacity: 0, y: 12 });

/**
 * The Display view: books standing face out in 3D on a shelf board, the way a shop shows
 * them. Each row gets its own board, with ends that slant in toward the wall like the Spines
 * view, so the grid is measured to know how many rows there are.
 */
export function LibraryShelf({ books, direction = 0 }: { books: Book[]; direction?: Direction }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const margins = displayMargins(width);
  const rows = width > 0 && books.length ? Math.ceil(books.length / displayColumns(width - margins.left - margins.right)) : 0;
  const clipPath = boardClip(BOARD, boardEndInset(width));

  return (
    <div ref={ref} className="relative">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} aria-hidden className="absolute inset-x-0" style={{ top: r * ROW, height: ROW, backgroundImage: shelfBoard(BOARD), clipPath }} />
      ))}
      <motion.ul
        layout
        className="relative grid gap-x-2"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${MIN_COLUMN}px, 1fr))`,
          gridAutoRows: ROW,
          paddingLeft: margins.left,
          paddingRight: margins.right,
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={{ direction, index: 0 }}>
          {books.map((book, index) => (
            <motion.li
              layout
              key={book.id}
              variants={item}
              custom={{ direction, index }}
              initial="hidden"
              animate="shown"
              exit="gone"
              transition={layoutSpring}
              className="relative"
            >
              <Book3D book={book} />
            </motion.li>
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}
