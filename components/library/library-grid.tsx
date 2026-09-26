"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Book } from "@/types/reading";
import { STATUS_LABEL } from "@/lib/labels";
import { layoutSpring, swapVariants, type Direction } from "@/lib/motion";
import { progressOf } from "@/lib/stats";
import { BookCover } from "@/components/book/book-cover";
import { CatalogRating, RatingStars } from "@/components/book/rating";

function Meta({ book }: { book: Book }) {
  if (book.status === "reading") {
    const pct = Math.round(progressOf(book) * 100);
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className="relative h-px flex-1 bg-ink-12">
          <span className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${pct}%` }} />
        </span>
        <span className="tabular font-display text-[11px] text-muted-foreground">{pct}%</span>
      </div>
    );
  }
  if (book.status === "completed" || book.status === "dnf") {
    return (
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <RatingStars value={book.personalRating} size="size-3" />
        {book.status === "dnf" && <span className="font-display text-[11px] text-muted-foreground">DNF</span>}
      </div>
    );
  }
  // Before reading, the public rating is the one that helps. Finished books show your own stars.
  return (
    <p className="mt-2.5 flex items-center gap-1 font-display text-[11px] text-muted-foreground">
      {STATUS_LABEL[book.status]} · {book.pageCount} pp
      {book.goodreadsRating !== null && (
        <>
          {" "}
          · <CatalogRating book={book} />
        </>
      )}
    </p>
  );
}

const item = swapVariants({ opacity: 0, scale: 0.96 });

export function LibraryGrid({
  books,
  direction = 0,
  showSeries = false,
}: {
  books: Book[];
  direction?: Direction;
  /** Names each book's series and number under the author, for the series sort. */
  showSeries?: boolean;
}) {
  return (
    <motion.ul layout className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
          >
            <Link href={`/book/${book.id}`} className="group block outline-none">
              <div className="relative">
                <BookCover
                  book={book}
                  elevated
                  className="transition-transform duration-300 ease-out group-focus-visible:-translate-y-1 [@media(hover:hover)]:group-hover:-translate-y-1.5"
                />
                {/* Genre tags float across the cover's lower edge and stay put when the cover lifts. */}
                <div className="absolute bottom-0 left-2 flex max-w-[calc(100%-16px)] translate-y-1/2 gap-1">
                  {book.genres.slice(0, 2).map((g) => (
                    <span
                      key={g}
                      className="truncate rounded-sm border border-border bg-surface/90 px-1.5 py-0.5 font-display text-[10px] tracking-[0.04em] text-foreground backdrop-blur-sm"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <p className="line-clamp-2 font-serif text-[16px] leading-snug underline-offset-4 group-hover:underline">{book.title}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{book.author}</p>
                {showSeries && book.series && (
                  <p className="mt-0.5 truncate font-display text-[11px] text-muted-foreground">
                    {book.series.name} #{book.series.position}
                  </p>
                )}
                <Meta book={book} />
              </div>
            </Link>
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
