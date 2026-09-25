import type { BookCandidate, SearchResponse, SourceId } from "./types";
import { SOURCE_LABEL } from "./types";
import { describeFailure } from "./http";
import { searchGoogleBooks } from "./google-books";
import { searchOpenLibrary } from "./open-library";
import { cleanIsbn, editionLanguageFor, isIsbnQuery, normalizeTitle, surname, toIsbn13 } from "./text";

const MAX_RESULTS = 10;

function matchKeys(c: BookCandidate) {
  const keys = [`t:${normalizeTitle(c.title)}|${surname(c.authors[0])}`];
  if (c.isbn) keys.push(`i:${c.isbn}`);
  return keys;
}

/** Fills gaps in `a` from `b`. `a` is the higher-ranked record and keeps its values. */
function combine(a: BookCandidate, b: BookCandidate): BookCandidate {
  const ol = a.sources.includes("openlibrary") ? a : b.sources.includes("openlibrary") ? b : undefined;
  const gb = a.sources.includes("googlebooks") ? a : b.sources.includes("googlebooks") ? b : undefined;
  return {
    ...b,
    ...a,
    subtitle: a.subtitle ?? b.subtitle,
    authors: a.authors.length ? a.authors : b.authors,
    // Open Library knows the first publication year; Google only the edition's.
    year: ol?.year ?? a.year ?? b.year,
    // Google's page count is for a real edition; Open Library's is a median.
    pageCount: gb?.pageCount ?? a.pageCount ?? b.pageCount,
    publisher: a.publisher ?? b.publisher,
    isbn: a.isbn ?? b.isbn,
    coverUrl: ol?.coverUrl ?? a.coverUrl ?? b.coverUrl,
    language: a.language ?? b.language,
    snippet: gb?.snippet ?? a.snippet ?? b.snippet,
    editionCount: ol?.editionCount,
    // The average with more votes behind it says more.
    rating: (a.rating?.count ?? 0) >= (b.rating?.count ?? 0) ? (a.rating ?? b.rating) : b.rating,
    refs: { ...b.refs, ...a.refs },
    sources: [...new Set([...a.sources, ...b.sources])],
  };
}

/**
 * Interleaves each catalog's ranking (G1, O1, G2, O2 …) and folds records that share
 * an ISBN or the same title and author surname into one candidate.
 */
export function mergeCandidates(lists: BookCandidate[][]): BookCandidate[] {
  const ordered: BookCandidate[] = [];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) for (const list of lists) if (list[i]) ordered.push(list[i]);

  const merged: BookCandidate[] = [];
  const index = new Map<string, number>();
  for (const candidate of ordered) {
    const keys = matchKeys(candidate);
    const at = keys.map((k) => index.get(k)).find((i) => i !== undefined);
    if (at === undefined) {
      merged.push(candidate);
      keys.forEach((k) => index.set(k, merged.length - 1));
    } else {
      merged[at] = combine(merged[at], candidate);
      matchKeys(merged[at]).forEach((k) => index.set(k, at));
    }
  }
  return merged.slice(0, MAX_RESULTS);
}

export async function searchCatalogs(rawQuery: string): Promise<SearchResponse> {
  const query = rawQuery.trim().replace(/\s+/g, " ");
  const isbn = isIsbnQuery(query) ? toIsbn13(cleanIsbn(query)) : undefined;
  const lang = editionLanguageFor(query);

  const sources: [SourceId, Promise<BookCandidate[]>][] = [
    ["googlebooks", searchGoogleBooks(query, { isbn, lang })],
    ["openlibrary", searchOpenLibrary(query, { isbn, lang })],
  ];
  const settled = await Promise.allSettled(sources.map(([, p]) => p));

  const notes: string[] = [];
  const lists: BookCandidate[][] = [];
  settled.forEach((result, i) => {
    const [source] = sources[i];
    if (result.status === "fulfilled") lists.push(result.value);
    else notes.push(`${SOURCE_LABEL[source]} ${describeFailure(result.reason)}.`);
  });

  if (!lists.length) {
    const error = new Error("No catalog answered.");
    (error as Error & { notes?: string[] }).notes = notes;
    throw error;
  }
  return { candidates: mergeCandidates(lists).map((c) => ({ ...c, lang })), notes, lang };
}
