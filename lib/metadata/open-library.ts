import type { BookCandidate, EditionLanguage, PartialDetails } from "./types";
import { endpoints, getJSON } from "./http";
import { htmlToParagraphs, languageCode, MARC_LANGUAGE, normalizeTitle, toIsbn13 } from "./text";

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
  // One edition per work, picked by Open Library to match the `language` filter and `lang`.
  "editions",
  "editions.key",
  "editions.title",
  "editions.subtitle",
  "editions.language",
  "editions.isbn",
  "editions.cover_i",
  "editions.publisher",
].join(",");

export interface EditionDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  language?: string[];
  isbn?: string[];
  cover_i?: number;
  publisher?: string[];
}

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
  editions?: { docs?: EditionDoc[] };
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

function firstIsbn(isbns: string[] | undefined) {
  return toIsbn13(isbns?.find((i) => i.length === 13) ?? isbns?.[0]);
}

/** The edition Open Library matched, when it is in the wanted language. */
export function editionIn(doc: SearchDoc, lang: EditionLanguage | undefined) {
  const edition = doc.editions?.docs?.[0];
  if (!edition || !lang) return undefined;
  return edition.language?.some((l) => languageCode(l) === lang) ? edition : undefined;
}

// Open Library ratings come from a smaller community; below this they say little.
const MIN_RATINGS = 3;

function ratingOf(doc: SearchDoc) {
  return doc.ratings_average && (doc.ratings_count ?? 0) >= MIN_RATINGS
    ? { value: Math.round(doc.ratings_average * 100) / 100, count: doc.ratings_count!, source: "openlibrary" as const }
    : undefined;
}

/**
 * Work-level facts come from the work. ISBN, publisher and cover come only from the edition
 * in the wanted language, since the work's own lists mix every translation. A translated
 * work takes the edition's title ("One Hundred Years of Solitude", not "Cien años de soledad").
 */
export function docToCandidate(doc: SearchDoc, lang?: EditionLanguage, isbn?: string): BookCandidate | null {
  if (!doc.title) return null;
  const edition = editionIn(doc, lang);
  const renamed = edition?.title && normalizeTitle(edition.title) !== normalizeTitle(doc.title);
  return {
    key: `ol:${doc.key}`,
    title: renamed ? edition!.title! : doc.title,
    subtitle: renamed ? edition!.subtitle : doc.subtitle,
    authors: doc.author_name ?? [],
    year: doc.first_publish_year,
    pageCount: doc.number_of_pages_median,
    publisher: edition?.publisher?.[0],
    isbn: isbn ?? firstIsbn(edition?.isbn),
    language: edition ? lang : undefined,
    coverUrl: coverUrl(edition?.cover_i ?? doc.cover_i, "M"),
    editionCount: doc.edition_count,
    rating: ratingOf(doc),
    refs: { openLibraryWork: doc.key, goodreadsIds: doc.id_goodreads?.slice(0, 3), openLibraryCover: edition?.cover_i },
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

/**
 * Title searches only return works with an edition in `lang`, and each work comes back
 * with that edition. An ISBN search returns the edition with that ISBN.
 */
export async function searchOpenLibrary(query: string, opts: { isbn?: string; lang: EditionLanguage }): Promise<BookCandidate[]> {
  const docs = await search(
    opts.isbn
      ? { isbn: opts.isbn, limit: "5", lang: opts.lang }
      : { q: query, limit: "12", language: MARC_LANGUAGE[opts.lang], lang: opts.lang },
  );
  return docs.map((d) => docToCandidate(d, opts.lang, opts.isbn)).filter((c): c is BookCandidate => c !== null);
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
