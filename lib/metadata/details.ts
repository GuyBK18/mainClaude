import type {
  BookCandidate,
  BookDetails,
  DetailField,
  LookupResponse,
  PartialDetails,
  PublicRating,
  SourceId,
} from "./types";
import { SOURCE_LABEL } from "./types";
import { describeFailure, goodreadsEnabled } from "./http";
import { googleByIsbn, googleVolume } from "./google-books";
import { openLibraryByIsbn, openLibraryWork } from "./open-library";
import { goodreadsLookup } from "./goodreads";
import { wikidataSeries } from "./wikidata";
import { mapGenres } from "./genres";
import { searchCatalogs } from "./search";
import { cleanIsbn, languageName, toIsbn13 } from "./text";

type Offer<T> = [SourceId | undefined, T | undefined];

// Google and Open Library ratings rest on few voters; below this they mislead more than they help.
const MIN_FALLBACK_RATINGS = 5;

/** The candidate's own values came from whichever catalog found it first. */
function candidateSource(c: BookCandidate, prefer: SourceId): SourceId | undefined {
  return c.sources.includes(prefer) ? prefer : c.sources[0];
}

export async function getBookDetails(c: BookCandidate): Promise<BookDetails> {
  const notes: string[] = [];
  const author = c.authors[0];

  const googleTask = c.refs.googleId ? googleVolume(c.refs.googleId) : c.isbn ? googleByIsbn(c.isbn) : Promise.resolve(null);
  const olTask = c.refs.openLibraryWork
    ? openLibraryWork(c.refs.openLibraryWork)
    : c.isbn
      ? openLibraryByIsbn(c.isbn).then((r) => r?.details ?? null)
      : Promise.resolve(null);
  const grTask = goodreadsEnabled()
    ? goodreadsLookup({ url: c.refs.goodreadsUrl, ids: c.refs.goodreadsIds, isbn: c.isbn, title: c.title, author })
    : Promise.resolve(null);

  const [g, o, r] = await Promise.allSettled([googleTask, olTask, grTask]);
  const settle = (result: PromiseSettledResult<PartialDetails | null>, source: SourceId) => {
    if (result.status === "fulfilled") return result.value ?? undefined;
    notes.push(`${SOURCE_LABEL[source]} ${describeFailure(result.reason)}.`);
    return undefined;
  };
  const google = settle(g, "googlebooks");
  const ol = settle(o, "openlibrary");
  const gr = settle(r, "goodreads");
  if (goodreadsEnabled() && r.status === "fulfilled" && !r.value) notes.push("Goodreads has no page that matches this book.");

  let series = gr?.series;
  let seriesSource: SourceId | undefined = series ? "goodreads" : undefined;
  if (!series) {
    try {
      series = await wikidataSeries(c.title, author);
      if (series) seriesSource = "wikidata";
    } catch (error) {
      notes.push(`Wikidata ${describeFailure(error)}, so a series may be missing.`);
    }
  }

  const provenance: BookDetails["provenance"] = {};
  const pick = <T>(field: DetailField, offers: Offer<T>[]): T | undefined => {
    const hit = offers.find(([source, value]) => source && value !== undefined && value !== null && value !== "");
    if (hit) provenance[field] = hit[0];
    return hit?.[1];
  };

  const fromCandidate = <K extends keyof BookCandidate>(key: K, prefer: SourceId): Offer<BookCandidate[K]> => [
    candidateSource(c, prefer),
    c[key],
  ];

  const pageCount = pick("pageCount", [
    ["goodreads", gr?.pageCount],
    ["googlebooks", google?.pageCount],
    ["openlibrary", ol?.pageCount],
    fromCandidate("pageCount", "googlebooks"),
  ]);
  const publishedYear = pick("publishedYear", [
    // Open Library and Goodreads both report first publication; Google reports the edition.
    ["openlibrary", c.sources.includes("openlibrary") ? c.year : ol?.publishedYear],
    ["goodreads", gr?.publishedYear],
    ["googlebooks", google?.publishedYear],
    fromCandidate("year", "googlebooks"),
  ]);
  const publisher = pick("publisher", [
    ["googlebooks", google?.publisher],
    ["goodreads", gr?.publisher],
    ["openlibrary", ol?.publisher],
    fromCandidate("publisher", "googlebooks"),
  ]);
  const isbn = pick("isbn", [fromCandidate("isbn", "googlebooks"), ["googlebooks", google?.isbn], ["goodreads", gr?.isbn], ["openlibrary", ol?.isbn]]);
  const languageCode = pick("language", [
    ["googlebooks", google?.language],
    fromCandidate("language", "googlebooks"),
    ["openlibrary", ol?.language],
    ["goodreads", gr?.language],
  ]);
  const description = pick("description", [
    ["googlebooks", google?.description],
    ["goodreads", gr?.description],
    ["openlibrary", ol?.description],
  ]);
  const enough = (rating: PublicRating | undefined) => (rating && rating.count >= MIN_FALLBACK_RATINGS ? rating : undefined);
  const rating = pick("rating", [
    ["goodreads", gr?.rating],
    ["openlibrary", enough(ol?.rating ?? (c.rating?.source === "openlibrary" ? c.rating : undefined))],
    ["googlebooks", enough(google?.rating ?? (c.rating?.source === "googlebooks" ? c.rating : undefined))],
  ]);
  const coverUrl = pick("coverUrl", [
    ["goodreads", gr?.coverUrl],
    ["openlibrary", ol?.coverUrl],
    ["googlebooks", google?.coverUrl],
    fromCandidate("coverUrl", "openlibrary"),
  ]);
  if (series && seriesSource) provenance.series = seriesSource;

  const genreSources = [
    { source: "goodreads" as const, labels: gr?.categories ?? [], weight: 5 },
    { source: "googlebooks" as const, labels: google?.categories ?? [], weight: 2 },
    { source: "openlibrary" as const, labels: ol?.categories ?? [], weight: 1 },
  ];
  const genres = mapGenres(genreSources);
  const genreSource = genreSources.find((s) => s.labels.length)?.source;
  if (genres.length && genreSource) provenance.genres = genreSource;

  if (goodreadsEnabled() && rating && rating.source !== "goodreads") {
    notes.push(`No Goodreads rating came back, so the rating is the ${SOURCE_LABEL[rating.source]} average.`);
  }

  return {
    title: c.title,
    subtitle: c.subtitle,
    author: c.authors.slice(0, 2).join(" & ") || gr?.authors?.[0] || google?.authors?.[0] || "",
    pageCount,
    publishedYear,
    publisher,
    isbn,
    language: languageName(languageCode),
    description,
    genres,
    series,
    rating,
    coverUrl,
    sourceUrl: gr?.url ?? google?.url ?? ol?.url,
    provenance,
    notes,
  };
}

/** An ISBN standing alone as a path segment: Open Library /isbn/…, Amazon /dp/…, and similar. */
function isbnInPath(url: URL) {
  const segment = url.pathname.split("/").find((s) => /^(97[89])?\d{9}[\dX]$/i.test(s));
  return segment ? toIsbn13(cleanIsbn(segment)) : undefined;
}

function titleFromSlug(url: URL) {
  const segments = url.pathname.split("/").filter(Boolean);
  const dp = segments.indexOf("dp");
  let slug = dp > 0 ? segments[dp - 1] : (segments[segments.length - 1] ?? "");
  slug = decodeURIComponent(slug)
    .replace(/^\d+[.-]?/, "")
    .replace(/\.[a-z]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  return slug || undefined;
}

async function detailsOrChoices(query: string): Promise<LookupResponse> {
  const { candidates, notes } = await searchCatalogs(query);
  if (candidates.length === 1) return { details: await getBookDetails(candidates[0]) };
  return { candidates, notes };
}

/**
 * Resolves a pasted link. Goodreads book pages and links carrying an ISBN resolve to one
 * book; anything else is searched by the title in its address and returned as choices.
 */
export async function lookupUrl(raw: string): Promise<LookupResponse> {
  const url = new URL(raw.trim());

  if (goodreadsEnabled() && /(^|\.)goodreads\.com$/.test(url.hostname) && /\/book\/show\//.test(url.pathname)) {
    url.search = "";
    const page = await goodreadsLookup({ url: url.toString(), title: "" });
    if (page?.title) {
      return {
        details: await getBookDetails({
          key: `gr:${url.pathname}`,
          title: page.title,
          authors: page.authors ?? [],
          isbn: page.isbn,
          refs: { goodreadsUrl: url.toString() },
          sources: ["goodreads"],
        }),
      };
    }
  }

  const isbn = isbnInPath(url);
  if (isbn) return detailsOrChoices(isbn);

  const title = titleFromSlug(url);
  if (!title) throw new Error("That link does not name a book.");
  return { candidates: (await searchCatalogs(title)).candidates, notes: [] };
}
