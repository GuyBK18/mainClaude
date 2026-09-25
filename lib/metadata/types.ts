import type { Genre, RatingSource, SeriesInfo } from "@/types/reading";

/** Catalogs the importer reads. Shared by the server routes and the client UI. */
export type SourceId = "googlebooks" | "openlibrary" | "goodreads" | "wikidata";

export const SOURCE_LABEL: Record<SourceId, string> = {
  googlebooks: "Google Books",
  openlibrary: "Open Library",
  goodreads: "Goodreads",
  wikidata: "Wikidata",
};

/**
 * The edition language the reader wants. English unless the search was typed in Hebrew
 * (or is an Israeli ISBN). Search results, description and covers all follow it.
 */
export type EditionLanguage = "en" | "he";

export interface PublicRating {
  value: number;
  count: number;
  source: RatingSource;
}

/** Ids that let the details step go straight to the right record in each catalog. */
export interface CandidateRefs {
  googleId?: string;
  /** Work key, e.g. "/works/OL45804W". */
  openLibraryWork?: string;
  /** Goodreads book ids Open Library links to its works. */
  goodreadsIds?: string[];
  goodreadsUrl?: string;
  /** Cover of the Open Library edition that is in the wanted language. */
  openLibraryCover?: number;
}

/** One search result. Several catalogs' records for the same book merge into one candidate. */
export interface BookCandidate {
  key: string;
  title: string;
  subtitle?: string;
  authors: string[];
  /** First publication year when a catalog knows it, otherwise the edition year. */
  year?: number;
  pageCount?: number;
  publisher?: string;
  isbn?: string;
  /** ISO 639-1 code. */
  language?: string;
  coverUrl?: string;
  snippet?: string;
  editionCount?: number;
  rating?: PublicRating;
  refs: CandidateRefs;
  sources: SourceId[];
  /** The edition language the search asked for; the details step follows it. */
  lang?: EditionLanguage;
}

/** What one catalog knows about a book. Every field is optional; the merge picks per field. */
export interface PartialDetails {
  title?: string;
  subtitle?: string;
  authors?: string[];
  pageCount?: number;
  publishedYear?: number;
  publisher?: string;
  isbn?: string;
  language?: string;
  description?: string;
  categories?: string[];
  series?: SeriesInfo;
  rating?: PublicRating;
  coverUrl?: string;
  url?: string;
  /** Goodreads work id, which leads to the page listing every edition. */
  workId?: string;
  /** More cover images for the same book, beyond `coverUrl`. */
  moreCovers?: string[];
  /**
   * Set when the record is for an edition in another language. Only fields that hold for
   * every edition (rating, series, genres, first publication) are kept.
   */
  workOnly?: boolean;
}

export type DetailField =
  | "pageCount"
  | "publishedYear"
  | "publisher"
  | "isbn"
  | "language"
  | "description"
  | "genres"
  | "series"
  | "rating"
  | "coverUrl";

/** A cover image found in one of the catalogs. */
export interface CoverOption {
  url: string;
  source: SourceId;
  /** The edition's format when the catalog names it, e.g. "Hardcover". */
  format?: string;
}

/** Identifies a book to the "more covers" route. */
export interface CoverQuery {
  title: string;
  author: string;
  lang: EditionLanguage;
  goodreadsWorkId?: string;
  openLibraryWork?: string;
}

export interface MoreCoversResponse {
  covers: CoverOption[];
  /** True when no catalog had anything more. */
  done: boolean;
}

/** The merged record the add-book form is filled from. */
export interface BookDetails {
  title: string;
  subtitle?: string;
  author: string;
  pageCount?: number;
  publishedYear?: number;
  publisher?: string;
  isbn?: string;
  /** Display name, e.g. "Hebrew". */
  language?: string;
  description?: string;
  genres: Genre[];
  series?: SeriesInfo;
  rating?: PublicRating;
  /** The first of `covers`, or nothing when no catalog had an image. */
  coverUrl?: string;
  /**
   * Covers of editions in the wanted language, best first. Different editions often share
   * one image; the browser compares them and keeps the ones that look different.
   */
  covers: CoverOption[];
  lang: EditionLanguage;
  /** What the browser sends back to ask for more covers. */
  coverQuery: CoverQuery;
  sourceUrl?: string;
  /** Which catalog each filled field came from. */
  provenance: Partial<Record<DetailField, SourceId>>;
  /** Plain-language notes about catalogs that did not answer. */
  notes: string[];
}

export interface SearchResponse {
  candidates: BookCandidate[];
  notes: string[];
  lang: EditionLanguage;
}

/** A URL import either resolves to one book or, when the link only names a title, to a list to pick from. */
export type LookupResponse = { details: BookDetails } | SearchResponse;
