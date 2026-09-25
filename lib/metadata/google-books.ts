import type { BookCandidate, EditionLanguage, PartialDetails } from "./types";
import { endpoints, getJSON, googleBooksKey } from "./http";
import { htmlToParagraphs, httpsUrl, normalizeTitle, snippetOf, surname, toIsbn13, yearFrom } from "./text";

interface VolumeInfo {
  title?: string;
  subtitle?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  industryIdentifiers?: { type: string; identifier: string }[];
  pageCount?: number;
  printType?: string;
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  imageLinks?: Partial<Record<"smallThumbnail" | "thumbnail" | "small" | "medium" | "large" | "extraLarge", string>>;
  language?: string;
  infoLink?: string;
  canonicalVolumeLink?: string;
}

interface Volume {
  id: string;
  volumeInfo: VolumeInfo;
}

interface VolumesResponse {
  totalItems: number;
  items?: Volume[];
}

function url(path: string, params: Record<string, string> = {}) {
  const u = new URL(`${endpoints.googleBooks}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const key = googleBooksKey();
  if (key) u.searchParams.set("key", key);
  return u.toString();
}

function isbnOf(info: VolumeInfo) {
  const ids = info.industryIdentifiers ?? [];
  return toIsbn13(ids.find((i) => i.type === "ISBN_13")?.identifier ?? ids.find((i) => i.type === "ISBN_10")?.identifier);
}

/** Largest image Google offers, with the page-curl effect removed. */
function coverOf(info: VolumeInfo) {
  const links = info.imageLinks;
  const raw = links?.extraLarge ?? links?.large ?? links?.medium ?? links?.small ?? links?.thumbnail ?? links?.smallThumbnail;
  if (!raw) return undefined;
  const u = new URL(httpsUrl(raw)!);
  u.searchParams.delete("edge");
  u.searchParams.delete("imgtk");
  return u.toString();
}

function toCandidate(v: Volume): BookCandidate | null {
  const info = v.volumeInfo;
  if (!info.title) return null;
  return {
    key: `gb:${v.id}`,
    title: info.title,
    subtitle: info.subtitle,
    authors: info.authors ?? [],
    year: yearFrom(info.publishedDate),
    pageCount: info.pageCount || undefined,
    publisher: info.publisher,
    isbn: isbnOf(info),
    language: info.language,
    coverUrl: coverOf(info),
    snippet: snippetOf(info.description),
    rating:
      info.averageRating && info.ratingsCount
        ? { value: info.averageRating, count: info.ratingsCount, source: "googlebooks" }
        : undefined,
    refs: { googleId: v.id },
    sources: ["googlebooks"],
  };
}

/**
 * Title searches are limited to editions in `lang`. An ISBN names one edition, so it is
 * looked up as is.
 */
export async function searchGoogleBooks(query: string, opts: { isbn?: string; lang: EditionLanguage }): Promise<BookCandidate[]> {
  const params: Record<string, string> = opts.isbn
    ? { q: `isbn:${opts.isbn}`, maxResults: "12", printType: "books" }
    : { q: query, maxResults: "12", printType: "books", langRestrict: opts.lang };
  const data = await getJSON<VolumesResponse>(url("/volumes", params));
  return (data.items ?? []).map(toCandidate).filter((c): c is BookCandidate => c !== null);
}

function toDetails(v: Volume): PartialDetails {
  const info = v.volumeInfo;
  return {
    title: info.title,
    subtitle: info.subtitle,
    authors: info.authors,
    pageCount: info.pageCount || undefined,
    publishedYear: yearFrom(info.publishedDate),
    publisher: info.publisher,
    isbn: isbnOf(info),
    language: info.language,
    description: htmlToParagraphs(info.description),
    // Full volumes carry BISAC paths like "Fiction / Fantasy / General"; split them into labels.
    categories: (info.categories ?? []).flatMap((c) => [c, ...c.split("/").map((s) => s.trim())]),
    rating:
      info.averageRating && info.ratingsCount
        ? { value: info.averageRating, count: info.ratingsCount, source: "googlebooks" }
        : undefined,
    coverUrl: coverOf(info),
    url: httpsUrl(info.canonicalVolumeLink ?? info.infoLink),
  };
}

export async function googleVolume(id: string): Promise<PartialDetails> {
  return toDetails(await getJSON<Volume>(url(`/volumes/${encodeURIComponent(id)}`)));
}

export async function googleByIsbn(isbn: string): Promise<PartialDetails | null> {
  const data = await getJSON<VolumesResponse>(url("/volumes", { q: `isbn:${isbn}`, maxResults: "1" }));
  const first = data.items?.[0];
  return first ? googleVolume(first.id).catch(() => toDetails(first)) : null;
}

/**
 * Finds the edition in `lang`: by ISBN when the ISBN's edition is in that language,
 * otherwise by title and author among editions in that language.
 */
export async function googleFind(q: { isbn?: string; title: string; author?: string; lang: EditionLanguage }): Promise<PartialDetails | null> {
  if (q.isbn) {
    const byIsbn = await googleByIsbn(q.isbn);
    if (byIsbn && (!byIsbn.language || byIsbn.language === q.lang)) return byIsbn;
  }
  const terms = [`intitle:${q.title}`, q.author ? `inauthor:${surname(q.author)}` : ""].filter(Boolean).join(" ");
  const data = await getJSON<VolumesResponse>(url("/volumes", { q: terms, maxResults: "5", printType: "books", langRestrict: q.lang }));
  const want = normalizeTitle(q.title);
  const hit = data.items?.find((v) => v.volumeInfo.title && normalizeTitle(v.volumeInfo.title) === want);
  return hit ? googleVolume(hit.id).catch(() => toDetails(hit)) : null;
}

/** Covers of other volumes of the same book in `lang`, a page of results at a time. */
export async function googleCovers(q: { title: string; author?: string; lang: EditionLanguage; page: number }): Promise<string[]> {
  const terms = [`intitle:${q.title}`, q.author ? `inauthor:${surname(q.author)}` : ""].filter(Boolean).join(" ");
  const data = await getJSON<VolumesResponse>(
    url("/volumes", { q: terms, maxResults: "20", startIndex: String((q.page - 1) * 20), printType: "books", langRestrict: q.lang }),
  );
  const want = normalizeTitle(q.title);
  return (data.items ?? [])
    .filter((v) => v.volumeInfo.title && normalizeTitle(v.volumeInfo.title) === want)
    .map((v) => coverOf(v.volumeInfo))
    .filter((u): u is string => Boolean(u));
}
