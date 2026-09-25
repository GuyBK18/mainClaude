"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Book } from "@/types/reading";
import { layoutSpring, swapVariants, type Direction } from "@/lib/motion";
import { Book3D, SHELF_BASE } from "./book-3d";
import { shelfBoard } from "./shelf-board";

const ROW = 292;
const BASE = ROW - SHELF_BASE;

/**
 * The Display view: books standing face out in 3D on a shelf board, the way a shop shows
 * them. Boards come from a repeating background so they line up with the grid however many
 * books fit across.
 */
const item = swapVariants({ opacity: 0, y: 12 });

export function LibraryShelf({ books, direction = 0 }: { books: Book[]; direction?: Direction }) {
  return (
    <motion.ul
      layout
      className="grid gap-x-2"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gridAutoRows: ROW,
        // Each book has its own camera, so its front corners reach a few pixels below where it stands.
        backgroundImage: shelfBoard({ back: BASE - 8, front: BASE + 12, edge: BASE + 20, row: ROW }),
        backgroundSize: `100% ${ROW}px`,
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
  );
}
