import type { Book, Genre, ReadingStatus } from "@/types/reading";
import { LENGTH_BUCKETS, type LengthBucket } from "@/lib/stats";

export type SortKey = "added" | "title" | "author" | "genre" | "length" | "rating";
export type SortDir = "asc" | "desc";

export interface LibraryFilters {
  status: ReadingStatus | "all";
  query: string;
  genres: Genre[];
  lengths: LengthBucket[];
  /** Minimum personal rating; 0 means any. */
  minRating: number;
}

export const DEFAULT_FILTERS: LibraryFilters = { status: "all", query: "", genres: [], lengths: [], minRating: 0 };

export function filterBooks(books: Book[], f: LibraryFilters) {
  const q = f.query.trim().toLowerCase();
  return books.filter((b) => {
    if (f.status !== "all" && b.status !== f.status) return false;
    if (q && !`${b.title} ${b.author} ${b.series?.name ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.genres.length && !b.genres.some((g) => f.genres.includes(g))) return false;
    if (f.lengths.length && !f.lengths.some((l) => LENGTH_BUCKETS[l].test(b.pageCount))) return false;
    if (f.minRating > 0 && (b.personalRating ?? 0) < f.minRating) return false;
    return true;
  });
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const sortTitle = (t: string) => t.replace(/^(the|a|an)\s+/i, "");
const surname = (a: string) => a.split(" ").slice(-1)[0];

export function sortBooks(books: Book[], key: SortKey, dir: SortDir) {
  const sign = dir === "asc" ? 1 : -1;
  return [...books].sort((a, b) => {
    let r = 0;
    switch (key) {
      case "added":
        r = a.addedAt.localeCompare(b.addedAt);
        break;
      case "title":
        r = collator.compare(sortTitle(a.title), sortTitle(b.title));
        break;
      case "author":
        r = collator.compare(surname(a.author), surname(b.author));
        break;
      case "genre":
        r = collator.compare(a.genres[0] ?? "", b.genres[0] ?? "");
        break;
      case "length":
        r = a.pageCount - b.pageCount;
        break;
      case "rating":
        // Unrated books sink to the bottom in both directions.
        if (a.personalRating === null || b.personalRating === null) {
          return (a.personalRating === null ? 1 : 0) - (b.personalRating === null ? 1 : 0);
        }
        r = a.personalRating - b.personalRating;
        break;
    }
    return r * sign || collator.compare(sortTitle(a.title), sortTitle(b.title));
  });
}

export const SORT_LABEL: Record<SortKey, string> = {
  added: "Date added",
  title: "Title",
  author: "Author",
  genre: "Genre",
  length: "Length",
  rating: "Rating",
};

/** Natural first direction for each column. */
export const SORT_DEFAULT_DIR: Record<SortKey, SortDir> = {
  added: "desc",
  title: "asc",
  author: "asc",
  genre: "asc",
  length: "desc",
  rating: "desc",
};
