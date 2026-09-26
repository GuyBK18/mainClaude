/**
 * Central data model for LuminaRead.
 * Single reader, so nothing here carries a user id.
 */

export type ReadingStatus = "tbr" | "reading" | "completed" | "dnf";

export type BookFormat = "hardcover" | "paperback" | "ebook" | "audiobook";

export type Genre =
  | "Literary Fiction"
  | "Science Fiction"
  | "Fantasy"
  | "Mystery"
  | "Historical Fiction"
  | "Non-fiction"
  | "Memoir"
  | "Philosophy"
  | "Poetry"
  | "Essays";

/** Catalog a public rating came from. */
export type RatingSource = "goodreads" | "openlibrary" | "googlebooks";

/** Layout used when a book has no cover image and the cover is typeset instead. */
export type CoverStyle = "band" | "frame" | "disc" | "split" | "type";

export interface CoverArt {
  /** Remote image. Seed books leave this empty and use the typeset cover. */
  url?: string;
  /** Dominant cover colors as [ground, ink, accent]. Feeds the ambient glow. */
  palette: [string, string, string];
  style: CoverStyle;
}

export interface SeriesInfo {
  name: string;
  /** 1-based position in the series. */
  position: number;
  total?: number;
}

export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  genres: Genre[];
  pageCount: number;
  /** Last page reached. Equals pageCount once completed. */
  currentPage: number;
  format: BookFormat;
  status: ReadingStatus;
  /** 0.5 to 5 in half steps, null when unrated. */
  personalRating: number | null;
  /**
   * Public average, 0 to 5. Usually Goodreads; when a book is imported and Goodreads
   * has no answer, `ratingSource` names the catalog the number came from instead.
   */
  goodreadsRating: number | null;
  ratingSource?: RatingSource;
  /** How many ratings the public average is based on. */
  ratingsCount?: number;
  publishedYear?: number;
  publisher?: string;
  isbn?: string;
  language?: string;
  series?: SeriesInfo;
  cover: CoverArt;
  /** ISO date (YYYY-MM-DD). */
  addedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** The year it was finished, when the exact date is not known. Ignored when finishedAt is set. */
  finishedYear?: number;
  /** Rich text (HTML) written in the vault. */
  review: string;
  summary: string;
  /** Publisher's description from a catalog. Plain text, paragraphs split by blank lines. */
  description?: string;
  sourceUrl?: string;
}

export interface Highlight {
  id: string;
  bookId: string;
  text: string;
  page?: number;
  chapter?: string;
  note?: string;
  /** ISO timestamp. */
  createdAt: string;
}

/** One day's reading against one book. Drives the heatmap and velocity stats. */
export interface ReadingSession {
  id: string;
  bookId: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  pages: number;
}

export interface ReadingGoal {
  year: number;
  target: number;
}

export type NewBook = Omit<Book, "id" | "addedAt"> & { addedAt?: string };
export type BookPatch = Partial<Omit<Book, "id">>;
export type NewHighlight = Omit<Highlight, "id" | "createdAt">;
