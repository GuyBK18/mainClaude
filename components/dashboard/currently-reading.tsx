"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { Book } from "@/types/reading";
import { daysBetween, today } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { ProgressControl } from "@/components/book/progress-control";
import { BookCover } from "@/components/book/book-cover";
import { AmbientGlow } from "@/components/book/ambient-glow";

function pace(book: Book) {
  if (!book.startedAt || book.currentPage === 0) return null;
  const days = Math.max(1, daysBetween(book.startedAt, today()));
  const perDay = book.currentPage / days;
  const left = Math.ceil((book.pageCount - book.currentPage) / perDay);
  return { perDay: Math.round(perDay), left };
}

export function CurrentlyReading({ books }: { books: Book[] }) {
  const [activeId, setActiveId] = useState(books[0]?.id);
  const book = books.find((b) => b.id === activeId) ?? books[0];

  if (!book) {
    return (
      <Card className="flex flex-col items-start justify-end p-8">
        <p className="label-meta mb-3">Currently reading</p>
        <p className="font-serif text-2xl">Nothing on the nightstand.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Move a book from <Link href="/library" className="underline underline-offset-4">your library</Link> to Reading to track it here.
        </p>
      </Card>
    );
  }

  const stats = pace(book);

  return (
    <Card className="relative isolate h-full overflow-hidden">
      <AnimatePresence initial={false}>
        <motion.div
          key={book.id}
          className="absolute inset-0 -z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: easeOut }}
        >
          <AmbientGlow palette={book.cover.palette} className="-top-1/4 -left-1/4 h-[150%] w-[90%]" intensity={1.1} />
        </motion.div>
      </AnimatePresence>

      <div className="flex h-full flex-col gap-8 p-6 sm:flex-row sm:gap-10 sm:p-8">
        <div className="relative w-36 shrink-0 self-center sm:w-44 sm:self-start">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={book.id}
              initial={{ opacity: 0, scale: 0.96, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
              transition={{ duration: 0.28, ease: easeOut }}
            >
              <Link href={`/book/${book.id}`} className="block">
                <BookCover book={book} elevated className="w-full" />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-4">
            <p className="label-meta">Currently reading</p>
            {books.length > 1 && (
              <span className="tabular font-display text-xs text-muted-foreground">
                {books.indexOf(book) + 1} / {books.length}
              </span>
            )}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: easeOut }}
              className="mt-4"
            >
              <Link href={`/book/${book.id}`} className="group inline-flex items-start gap-2">
                <h2 className="font-serif text-[28px] leading-[1.1] tracking-[-0.01em] sm:text-[34px]">{book.title}</h2>
                <ArrowUpRight className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </Link>
              <p className="mt-2 text-[15px] text-muted-foreground">{book.author}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-auto pt-10">
            <ProgressControl key={book.id} book={book} />
            <p className="mt-4 text-sm text-muted-foreground">
              {stats
                ? `About ${stats.perDay} pages a day. At this pace you finish in ${stats.left} ${stats.left === 1 ? "day" : "days"}.`
                : "Drag the slider or type a page to log today's reading."}
            </p>
          </div>

          {books.length > 1 && (
            <div className="mt-8 flex gap-3 border-t border-border pt-5" role="tablist" aria-label="Books in progress">
              {books.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={b.id === book.id}
                  aria-label={b.title}
                  onClick={() => setActiveId(b.id)}
                  className={cn(
                    "pressable w-9 transition-opacity duration-200",
                    b.id === book.id ? "opacity-100" : "opacity-45 hover:opacity-80",
                  )}
                >
                  <BookCover book={b} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
