"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Book } from "@/types/reading";
import { STATUS_LABEL } from "@/lib/labels";
import type { SortDir, SortKey } from "@/lib/library-filter";
import { layoutSpring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BookCover } from "@/components/book/book-cover";
import { RatingStars } from "@/components/book/rating";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author", className: "w-[18%]" },
  { key: "genre", label: "Genre", className: "w-[17%]" },
  { key: "length", label: "Length", className: "w-[9%] text-right" },
  { key: "rating", label: "Rating", className: "w-[12%]" },
];

export function LibraryTable({
  books,
  sort,
  onSort,
}: {
  books: Book[];
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const router = useRouter();

  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[760px] table-fixed border-collapse font-sans text-[13px]">
        <thead>
          <tr className="border-b border-border">
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={cn("h-10 px-3 text-left font-normal first:pl-0", col.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className={cn(
                      "label-meta inline-flex items-center gap-1 transition-colors duration-150 hover:text-foreground",
                      active && "text-foreground",
                      col.className?.includes("text-right") && "flex-row-reverse",
                    )}
                  >
                    {col.label}
                    {active ? (
                      sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                    ) : (
                      <span className="size-3" />
                    )}
                  </button>
                </th>
              );
            })}
            <th scope="col" className="label-meta h-10 w-[11%] px-3 text-left font-normal">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {books.map((book) => (
              <motion.tr
                layout="position"
                key={book.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={layoutSpring}
                onClick={() => router.push(`/book/${book.id}`)}
                className="group cursor-pointer border-b border-border transition-colors duration-100 hover:bg-ink-3"
              >
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-3">
                    <BookCover book={book} className="w-7 shrink-0" />
                    <div className="min-w-0">
                      <Link
                        href={`/book/${book.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium text-foreground underline-offset-4 group-hover:underline"
                      >
                        {book.title}
                      </Link>
                      {book.series && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {book.series.name} #{book.series.position}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="truncate px-3 text-muted-foreground">{book.author}</td>
                <td className="truncate px-3 text-muted-foreground">
                  {book.genres[0]}
                  {book.genres.length > 1 && <span className="text-muted-foreground/70"> +{book.genres.length - 1}</span>}
                </td>
                <td className="tabular px-3 text-right">{book.pageCount.toLocaleString("en")}</td>
                <td className="px-3">
                  {book.personalRating === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <RatingStars value={book.personalRating} size="size-3" />
                  )}
                </td>
                <td className="px-3 text-muted-foreground">{STATUS_LABEL[book.status]}</td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}
