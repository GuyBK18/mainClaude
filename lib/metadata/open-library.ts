import type { BookCandidate, PartialDetails } from "./types";
import { endpoints, getJSON } from "./http";
import { htmlToParagraphs, languageCode, toIsbn13 } from "./text";

const FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "first_publish_year",
  "number_of_pages_median",
  "cover_i",
  "isbn",
  "publisher",
  "language",
  "subject",
  "edition_count",
  "ratings_average",
  "ratings_count",
  "id_goodreads",
].join(",");

export interface SearchDoc {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
  publisher?: string[];
  language?: string[];
  subject?: string[];
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
  id_goodreads?: string[];
}

interface Work {
  title?: string;
  subtitle?: string;
  description?: string | { type?: string; value: string };
  subjects?: string[];
  covers?: number[];
  first_publish_date?: string;
}

export function coverUrl(coverId: number | undefined, size: "M" | "L" = "L") {
  return coverId && coverId > 0 ? `${endpoints.openLibraryCovers}/b/id/${coverId}-${size}.jpg` : undefined;
}

/** Open Library lists every edition's ISBN; the first valid ISBN-13 stands in for the work. */
function isbnOf(doc: SearchDoc) {
  const isbns = doc.isbn ?? [];
  return toIsbn13(isbns.find((i) => i.length === 13) ?? isbns[0]);
}

// Open Library ratings come from a smaller community; below this they say little.
const MIN_RATINGS = 3;

function ratingOf(doc: SearchDoc) {
  return doc.ratings_average && (doc.ratings_count ?? 0) >= MIN_RATINGS
    ? { value: Math.round(doc.ratings_average * 100) / 100, count: doc.ratings_count!, source: "openlibrary" as const }
    : undefined;
}

export function docToCandidate(doc: SearchDoc): BookCandidate | null {
  if (!doc.title) return null;
  return {
    key: `ol:${doc.key}`,
    title: doc.title,
    subtitle: doc.subtitle,
    authors: doc.author_name ?? [],
    year: doc.first_publish_year,
    pageCount: doc.number_of_pages_median,
    publisher: doc.publisher?.[0],
    isbn: isbnOf(doc),
    language: languageCode(doc.language?.[0]),
    coverUrl: coverUrl(doc.cover_i, "M"),
    editionCount: doc.edition_count,
    rating: ratingOf(doc),
    refs: { openLibraryWork: doc.key, goodreadsIds: doc.id_goodreads?.slice(0, 3) },
    sources: ["openlibrary"],
  };
}

async function search(params: Record<string, string>) {
  const u = new URL(`${endpoints.openLibrary}/search.json`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("fields", FIELDS);
  const data = await getJSON<{ docs?: SearchDoc[] }>(u.toString());
  return data.docs ?? [];
}

export async function searchOpenLibrary(query: string, isbn?: string): Promise<BookCandidate[]> {
  const docs = await search(isbn ? { isbn, limit: "5" } : { q: query, limit: "12" });
  return docs.map(docToCandidate).filter((c): c is BookCandidate => c !== null);
}

function descriptionOf(work: Work) {
  const raw = typeof work.description === "string" ? work.description : work.description?.value;
  // Work descriptions are Markdown-ish; drop link syntax and the "----------" source footers.
  const cleaned = raw
    ?.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n-{3,}[\s\S]*$/, "")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1");
  return htmlToParagraphs(cleaned);
}

export async function openLibraryWork(workKey: string, doc?: SearchDoc): Promise<PartialDetails> {
  const work = await getJSON<Work>(`${endpoints.openLibrary}${workKey}.json`);
  return {
    title: work.title ?? doc?.title,
    subtitle: work.subtitle ?? doc?.subtitle,
    authors: doc?.author_name,
    pageCount: doc?.number_of_pages_median,
    publishedYear: doc?.first_publish_year,
    publisher: doc?.publisher?.[0],
    isbn: doc ? isbnOf(doc) : undefined,
    language: languageCode(doc?.language?.[0]),
    description: descriptionOf(work),
    categories: [...(work.subjects ?? []), ...(doc?.subject ?? [])],
    rating: doc ? ratingOf(doc) : undefined,
    coverUrl: coverUrl(work.covers?.find((c) => c > 0) ?? doc?.cover_i),
    url: `${endpoints.openLibrary}${workKey}`,
  };
}

/** Finds the work behind an ISBN, then reads it. Also returns the search doc for its Goodreads ids. */
export async function openLibraryByIsbn(isbn: string): Promise<{ details: PartialDetails; doc: SearchDoc } | null> {
  const [doc] = await search({ isbn, limit: "1" });
  if (!doc) return null;
  return { details: await openLibraryWork(doc.key, doc), doc };
}
