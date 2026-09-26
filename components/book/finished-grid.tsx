import Link from "next/link";
import type { Book } from "@/types/reading";
import { formatDate } from "@/lib/dates";
import { BookCover } from "@/components/book/book-cover";

/** Newest finish first. Books dated by year only follow the dated ones of that year. */
export function byFinish(books: Book[]) {
  const key = (b: Book) => b.finishedAt ?? (b.finishedYear ? `${b.finishedYear}-00` : "");
  return [...books].sort((a, b) => key(b).localeCompare(key(a)));
}

function when(book: Book) {
  if (book.finishedAt) return formatDate(book.finishedAt);
  return book.finishedYear ? String(book.finishedYear) : "Date unknown";
}

/** Covers of finished books, each with its title and when it was finished. */
export function FinishedGrid({ books }: { books: Book[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-4 gap-y-8 sm:grid-cols-6 sm:gap-x-6">
      {byFinish(books).map((book) => (
        <Link key={book.id} href={`/book/${book.id}`} className="group block">
          <BookCover
            book={book}
            elevated
            className="transition-transform duration-300 ease-(--ease-out) [@media(hover:hover)]:group-hover:-translate-y-1"
          />
          <p className="mt-3 truncate font-serif text-[15px] leading-tight">{book.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{when(book)}</p>
        </Link>
      ))}
    </div>
  );
}
