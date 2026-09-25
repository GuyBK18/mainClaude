import type { Genre, RatingSource, SeriesInfo } from "@/types/reading";

/** Catalogs the importer reads. Shared by the server routes and the client UI. */
export type SourceId = "googlebooks" | "openlibrary" | "goodreads" | "wikidata";

export const SOURCE_LABEL: Record<SourceId, string> = {
  googlebooks: "Google Books",
  openlibrary: "Open Library",
  goodreads: "Goodreads",
  wikidata: "Wikidata",
};

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
  coverUrl?: string;
  sourceUrl?: string;
  /** Which catalog each filled field came from. */
  provenance: Partial<Record<DetailField, SourceId>>;
  /** Plain-language notes about catalogs that did not answer. */
  notes: string[];
}

export interface SearchResponse {
  candidates: BookCandidate[];
  notes: string[];
}

/** A URL import either resolves to one book or, when the link only names a title, to a list to pick from. */
export type LookupResponse = { details: BookDetails } | { candidates: BookCandidate[]; notes: string[] };
