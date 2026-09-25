"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Book } from "@/types/reading";
import { layoutSpring, swapVariants, type Direction } from "@/lib/motion";
import { Book3D } from "./book-3d";

const ROW = 292;

/**
 * A gallery shelf: each row is a flat plinth drawn with a hairline and a faint ink band,
 * with the books standing on it in 3D. Rows come from a repeating background so they
 * line up with the grid however many books fit across.
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
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${ROW - 22}px, var(--ink-3) ${ROW - 22}px ${ROW - 1}px, var(--border) ${ROW - 1}px ${ROW}px)`,
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
