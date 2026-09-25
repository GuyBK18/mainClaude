import type { CoverOption, CoverQuery, MoreCoversResponse, SourceId } from "./types";
import { goodreadsEnabled } from "./http";
import { goodreadsEditionCovers } from "./goodreads";
import { openLibraryEditionCovers } from "./open-library";
import { googleCovers } from "./google-books";

/** Covers sent with a book's details. The browser shows a few and keeps the rest for "more". */
export const MAX_COVERS = 16;

/**
 * The same image under different addresses: Goodreads serves one file from several hosts
 * and sizes, Open Library in S, M and L.
 */
export function imageKey(url: string) {
  const goodreads = url.match(/\/books\/(\d+[a-z]?\/\d+)(?:\._[^.]+_)?\.\w+$/i);
  if (goodreads) return `gr:${goodreads[1]}`;
  const openLibrary = url.match(/\/b\/id\/(\d+)-[SML]\.jpg$/);
  if (openLibrary) return `ol:${openLibrary[1]}`;
  return url;
}

type Offer = { source: SourceId; url?: string; format?: string };

/** Keeps the first of each image, in order, and drops empty offers. */
export function collectCovers(offers: Offer[], max = MAX_COVERS, seen = new Set<string>()): CoverOption[] {
  const covers: CoverOption[] = [];
  for (const { source, url, format } of offers) {
    if (!url || covers.length >= max) continue;
    const key = imageKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    covers.push(format ? { url, source, format } : { url, source });
  }
  return covers;
}

/**
 * The next page of covers for a book: Goodreads' editions list, Open Library's editions
 * and Google Books volumes. Page 1 is what the details step already sent, so this starts
 * at page 2. `known` holds image addresses the browser already has.
 */
export async function moreCovers(query: CoverQuery, page: number, known: string[]): Promise<MoreCoversResponse> {
  const tasks: Promise<Offer[]>[] = [
    query.goodreadsWorkId && goodreadsEnabled()
      ? goodreadsEditionCovers(query.goodreadsWorkId, query.lang, page).then((eds) =>
          eds.map((e) => ({ source: "goodreads" as const, url: e.coverUrl, format: e.format })),
        )
      : Promise.resolve([]),
    query.openLibraryWork
      ? openLibraryEditionCovers(query.openLibraryWork, query.lang, page - 1).then((eds) =>
          eds.map((e) => ({ source: "openlibrary" as const, url: e.url, format: e.format })),
        )
      : Promise.resolve([]),
    googleCovers({ title: query.title, author: query.author, lang: query.lang, page: page - 1 }).then((urls) =>
      urls.map((url) => ({ source: "googlebooks" as const, url })),
    ),
  ];
  const settled = await Promise.allSettled(tasks);
  const found = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  // Interleave the catalogs so one of them cannot fill the whole page.
  const interleaved: Offer[] = [];
  for (let i = 0; i < Math.max(...found.map((f) => f.length)); i++) for (const list of found) if (list[i]) interleaved.push(list[i]);

  const covers = collectCovers(interleaved, MAX_COVERS, new Set(known.map(imageKey)));
  return { covers, done: found.every((f) => f.length === 0) };
}
